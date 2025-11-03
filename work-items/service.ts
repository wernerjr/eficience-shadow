import { db } from '../db/index';
import { workItems as workItemsTable, people, workItemTypes } from '../db/schema';
import { toDTO, WorkItemRaw, WorkItemDTO, normalizeTitle } from './schema';
import { findExistingByIds, bulkInsert, bulkUpdateChanged, listWorkItems, WorkItemDbRow, listWorkItemsFiltered, countWorkItemsFiltered, WorkItemsFilter, WorkItemsSort, countWorkItemsClosedFiltered, listWorkItemsDatesForSummary } from './repository';
import { getBrazilPublicHolidays, isHolidayFactory, truncateToUTC } from './utils/holidays';
import { countBusinessDaysInclusive, listYearsBetween } from './utils/businessDays';

type ImportResult = { inserted: number; updated: number; ignored: number };

export async function importWorkItems(rawItems: WorkItemRaw[]): Promise<ImportResult> {
  if (!Array.isArray(rawItems)) {
    throw new Error('Payload must be an array');
  }

  const dtos = rawItems.map(toDTO);

  // Preparar upsert de pessoas por nome normalizado
  const distinctNames = Array.from(
    new Set(
      dtos
        .map((d) => (d.assignedToName ? d.assignedToName.trim() : ''))
        .filter((v) => v && v.length > 0)
    )
  );
  const normalizedPairs = distinctNames.map((name) => ({
    name,
    norm: normalizeTitle(name)!,
  }));

  if (normalizedPairs.length > 0) {
    await db
      .insert(people)
      .values(normalizedPairs.map((p) => ({ name: p.name, nameNormalized: p.norm })) as any)
      .onConflictDoNothing({ target: people.nameNormalized });
  }

  // Buscar pessoas e montar mapa norm -> id
  const peopleRows = normalizedPairs.length > 0 ? await db.select().from(people) : [];
  const normToId = new Map<string, string>();
  for (const pr of peopleRows) {
    normToId.set(pr.nameNormalized, pr.id);
  }

  // Preparar upsert de tipos por nome normalizado
  const distinctTypes = Array.from(
    new Set(
      dtos
        .map((d) => (d.workItemType ? d.workItemType.trim() : ''))
        .filter((v) => v && v.length > 0)
    )
  );
  const typePairs = distinctTypes.map((name) => ({ name, norm: normalizeTitle(name)! }));

  if (typePairs.length > 0) {
    await db
      .insert(workItemTypes)
      .values(typePairs.map((t) => ({ name: t.name, nameNormalized: t.norm })) as any)
      .onConflictDoNothing({ target: workItemTypes.nameNormalized });
  }

  // Buscar tipos e montar mapa norm -> id
  const typeRows = typePairs.length > 0 ? await db.select().from(workItemTypes) : [];
  const typeNormToId = new Map<string, string>();
  for (const tr of typeRows) {
    typeNormToId.set(tr.nameNormalized, tr.id);
  }

  // Mapa titleNormalized -> id (apenas do payload)
  const titleToId = new Map<string, number>();
  for (const item of dtos) {
    if (item.titleNormalized) {
      titleToId.set(item.titleNormalized, item.id);
    }
  }

  // Resolver parentId usando apenas o payload
  const withParents = dtos.map((i) => ({
    ...i,
    parentId: i.parentTitleNormalized ? (titleToId.get(i.parentTitleNormalized) ?? null) : null,
    assignedToId: i.assignedToName ? (normToId.get(normalizeTitle(i.assignedToName)!) ?? null) : null,
    workItemTypeId: i.workItemType ? (typeNormToId.get(normalizeTitle(i.workItemType)!) ?? null) : null,
  }));

  const ids = withParents.map((i) => i.id);
  const existing = await findExistingByIds(ids);
  const existingById = new Map(existing.map((e) => [e.id, e] as const));

  const toInsert: any[] = [];
  const toUpdate: any[] = [];
  let ignored = 0;

  for (const i of withParents) {
    const current = existingById.get(i.id);
    if (!current) {
      toInsert.push({
        id: i.id,
        workItemTypeId: i.workItemTypeId!,
        state: i.state,
        createdDate: i.createdDate,
        activatedDate: i.activatedDate,
        closedDate: i.closedDate,
        title: i.title,
        description: i.description,
        assignedToId: i.assignedToId ?? null,
        parentId: i.parentId,
      });
      continue;
    }

    // Comparar campo a campo; se algum difere, preparar update
    const changed = (
      current.workItemTypeId !== i.workItemTypeId ||
      current.state !== i.state ||
      +new Date(current.createdDate) !== +new Date(i.createdDate) ||
      (current.activatedDate ? +new Date(current.activatedDate) : null) !== (i.activatedDate ? +new Date(i.activatedDate) : null) ||
      (current.closedDate ? +new Date(current.closedDate) : null) !== (i.closedDate ? +new Date(i.closedDate) : null) ||
      current.title !== i.title ||
      (current.description ?? null) !== (i.description ?? null) ||
      (current.assignedToId ?? null) !== (i.assignedToId ?? null) ||
      (current.parentId ?? null) !== (i.parentId ?? null)
    );

    if (changed) {
      toUpdate.push({
        id: i.id,
        workItemTypeId: i.workItemTypeId!,
        state: i.state,
        createdDate: i.createdDate,
        activatedDate: i.activatedDate,
        closedDate: i.closedDate,
        title: i.title,
        description: i.description,
        assignedToId: i.assignedToId ?? null,
        parentId: i.parentId,
      });
    } else {
      ignored += 1;
    }
  }

  let inserted = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    if (toInsert.length > 0) {
      // Usa conexão tx via override de db.execute? Simplificado: como find/compare já ocorreu, podemos inserir via db global
      inserted = await bulkInsert(toInsert);
    }
    if (toUpdate.length > 0) {
      updated = await bulkUpdateChanged(toUpdate);
    }
  });

  return { inserted, updated, ignored };
}


type WorkItemDates = Pick<WorkItemDTO, 'createdDate' | 'activatedDate' | 'closedDate'>;

export async function computeDevelopmentBusinessDays(item: WorkItemDates): Promise<number | null> {
  const end = item.closedDate ? truncateToUTC(item.closedDate) : null;
  if (!end) return null;
  const startSource = item.activatedDate ?? item.createdDate;
  const start = truncateToUTC(startSource);
  const years = listYearsBetween(start, end);
  const setsByYear = new Map<number, Set<string>>();
  await Promise.all(
    years.map(async (y) => {
      const set = await getBrazilPublicHolidays(y);
      setsByYear.set(y, set);
    })
  );
  const isHoliday = isHolidayFactory(setsByYear);
  return countBusinessDaysInclusive(start, end, isHoliday);
}

export type WorkItemWithDevelopmentTime = WorkItemDbRow & {
  developmentBusinessDays: number | null;
};

export type WorkItemsSummary = {
  total: number;
  closed: number;
  avgDevelopmentBusinessDays: number | null;
};

export type ListWithTotal<T> = { items: T[]; total: number; summary: WorkItemsSummary };

export async function listWorkItemsWithDevelopmentTime(
  filters: WorkItemsFilter = {},
  limit = 50,
  offset = 0,
  sort: WorkItemsSort = { sortBy: 'id', sortDir: 'asc' }
): Promise<ListWithTotal<WorkItemWithDevelopmentTime>> {
  const [items, total, closed, datesForSummary] = await Promise.all([
    listWorkItemsFiltered(filters, limit, offset, sort),
    countWorkItemsFiltered(filters),
    countWorkItemsClosedFiltered(filters),
    listWorkItemsDatesForSummary(filters),
  ]);

  const allYears = new Set<number>();
  for (const item of items) {
    if (item.closedDate) {
      const startSource = item.activatedDate ?? item.createdDate;
      const start = truncateToUTC(startSource);
      const end = truncateToUTC(item.closedDate);
      const years = listYearsBetween(start, end);
      years.forEach((y) => allYears.add(y));
    }
  }

  const setsByYear = new Map<number, Set<string>>();
  await Promise.all(
    Array.from(allYears).map(async (y) => {
      const set = await getBrazilPublicHolidays(y);
      setsByYear.set(y, set);
    })
  );

  const isHoliday = isHolidayFactory(setsByYear);

  const mapped = items.map((item) => {
    let developmentBusinessDays: number | null = null;
    if (item.closedDate) {
      const end = truncateToUTC(item.closedDate);
      const startSource = item.activatedDate ?? item.createdDate;
      const start = truncateToUTC(startSource);
      developmentBusinessDays = countBusinessDaysInclusive(start, end, isHoliday);
    }
    return { ...item, developmentBusinessDays };
  });

  // Calcular média sobre o conjunto completo filtrado (ignora paginação)
  const closedItemsForAvg = datesForSummary.filter((d) => !!d.closedDate && d.state === 'Closed');
  const yearsForSummary = new Set<number>();
  for (const d of closedItemsForAvg) {
    const startSource = d.activatedDate ?? d.createdDate;
    const start = truncateToUTC(startSource);
    const end = truncateToUTC(d.closedDate!);
    const years = listYearsBetween(start, end);
    years.forEach((y) => yearsForSummary.add(y));
  }
  // garantir feriados para todos anos necessários ao summary
  await Promise.all(
    Array.from(yearsForSummary).map(async (y) => {
      if (!setsByYear.has(y)) {
        const set = await getBrazilPublicHolidays(y);
        setsByYear.set(y, set);
      }
    })
  );
  const isHolidayForSummary = isHolidayFactory(setsByYear);

  let avgDevelopmentBusinessDays: number | null = null;
  if (closedItemsForAvg.length > 0) {
    let sum = 0;
    for (const d of closedItemsForAvg) {
      const end = truncateToUTC(d.closedDate!);
      const startSource = d.activatedDate ?? d.createdDate;
      const start = truncateToUTC(startSource);
      sum += countBusinessDaysInclusive(start, end, isHolidayForSummary);
    }
    avgDevelopmentBusinessDays = Math.ceil(sum / closedItemsForAvg.length);
  }

  const summary = { total, closed, avgDevelopmentBusinessDays };
  return { items: mapped, total, summary };
}

