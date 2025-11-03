import { db } from '../db/index';
import { workItems, people, workItemTypes } from '../db/schema';
import { inArray, sql, eq, asc, and, isNotNull, isNull, ilike, gte, lte, desc } from 'drizzle-orm';

export type WorkItemDbRow = {
  id: number;
  workItemTypeId: string;
  workItemType: string;
  state: string;
  createdDate: Date;
  activatedDate: Date | null;
  closedDate: Date | null;
  title: string;
  description: string | null;
  parentId: number | null;
  assignedToId: string | null;
  assignedTo: string | null; // nome da pessoa
};

export async function findExistingByIds(ids: number[]) {
  if (ids.length === 0) return [] as WorkItemDbRow[];
  return db.select().from(workItems).where(inArray(workItems.id, ids));
}

export async function bulkInsert(values: Array<Omit<WorkItemDbRow, 'createdAt' | 'updatedAt'>>) {
  if (values.length === 0) return 0;
  // createdAt/updatedAt usam default do banco
  const res = await db.insert(workItems)
    .values(values.map((v) => ({
      id: v.id,
      workItemTypeId: v.workItemTypeId,
      state: v.state,
      createdDate: v.createdDate,
      activatedDate: v.activatedDate,
      closedDate: v.closedDate,
      title: v.title,
      description: v.description,
      assignedToId: v.assignedToId,
      parentId: v.parentId,
    })) as any)
    .onConflictDoNothing({ target: workItems.id });
  // Drizzle não retorna count de onConflictDoNothing; como já filtramos, assumimos inserções bem-sucedidas = values.length
  return values.length;
}

// Atualização em lote usando UPDATE ... FROM (VALUES ...)
export async function bulkUpdateChanged(rows: Array<{
  id: number;
  workItemTypeId: string;
  state: string;
  createdDate: Date;
  activatedDate: Date | null;
  closedDate: Date | null;
  title: string;
  description: string | null;
  assignedToId: string | null;
  parentId: number | null;
}>) {
  if (rows.length === 0) return 0;

  const valuesTuples = rows.map((r) => sql`(${r.id}, ${r.workItemTypeId}, ${r.state}, ${r.createdDate}, ${r.activatedDate}, ${r.closedDate}, ${r.title}, ${r.description}, ${r.assignedToId}, ${r.parentId})`);

  await db.execute(sql`
    UPDATE ${workItems} AS wi
    SET
      work_item_type_id = v.work_item_type_id,
      state = v.state,
      created_date = v.created_date,
      activated_date = v.activated_date,
      closed_date = v.closed_date,
      title = v.title,
      description = v.description,
      assigned_to_id = v.assigned_to_id,
      parent_id = v.parent_id,
      "updatedAt" = now()
    FROM (VALUES ${sql.join(valuesTuples, sql`, `)}) AS v(id, work_item_type_id, state, created_date, activated_date, closed_date, title, description, assigned_to_id, parent_id)
    WHERE wi.id = v.id
  `);

  return rows.length;
}

export async function getByTitleNormalizedMapFromPayload(titleToId: Map<string, number>) {
  // Não consulta DB por título (conforme requisito 2-b). Função mantida para simetria.
  return titleToId;
}

export async function listWorkItems(): Promise<WorkItemDbRow[]> {
  const rows = await db
    .select({
      id: workItems.id,
      workItemTypeId: workItems.workItemTypeId,
      workItemType: workItemTypes.name,
      state: workItems.state,
      createdDate: workItems.createdDate,
      activatedDate: workItems.activatedDate,
      closedDate: workItems.closedDate,
      title: workItems.title,
      description: workItems.description,
      parentId: workItems.parentId,
      assignedToId: workItems.assignedToId,
      assignedTo: people.name,
    })
    .from(workItems)
    .leftJoin(people, eq(workItems.assignedToId, people.id))
    .leftJoin(workItemTypes, eq(workItems.workItemTypeId, workItemTypes.id))
    .orderBy(asc(workItems.id));
  return rows as WorkItemDbRow[];
}


export type WorkItemsFilter = {
  id?: number;
  parentId?: number;
  workItemType?: string;
  workItemTypeId?: string;
  state?: string;
  assignedToId?: string;
  assignedTo?: string; // substring (ILIKE)
  titleContains?: string; // substring (ILIKE)
  createdFrom?: Date;
  createdTo?: Date;
  activatedFrom?: Date;
  activatedTo?: Date;
  closedFrom?: Date;
  closedTo?: Date;
  isClosed?: boolean;
  hasParent?: boolean;
};

export type WorkItemsSort = {
  sortBy?: 'id';
  sortDir?: 'asc' | 'desc';
};

function buildWhereClauses(filters: WorkItemsFilter) {
  const clauses = [] as any[];

  if (filters.id !== undefined) clauses.push(eq(workItems.id, filters.id));
  if (filters.parentId !== undefined) clauses.push(eq(workItems.parentId, filters.parentId));
  if (filters.workItemTypeId) clauses.push(eq(workItems.workItemTypeId, filters.workItemTypeId as any));
  // para filtrar por nome do tipo, usamos ilike no join com workItemTypes
  if (filters.workItemType) clauses.push(ilike(workItemTypes.name, `%${filters.workItemType}%`));
  if (filters.state) clauses.push(eq(workItems.state, filters.state));
  if (filters.assignedToId) clauses.push(eq(workItems.assignedToId, filters.assignedToId));
  if (filters.assignedTo) clauses.push(ilike(people.name, `%${filters.assignedTo}%`));
  if (filters.titleContains) clauses.push(ilike(workItems.title, `%${filters.titleContains}%`));

  if (filters.createdFrom) clauses.push(gte(workItems.createdDate, filters.createdFrom));
  if (filters.createdTo) clauses.push(lte(workItems.createdDate, filters.createdTo));
  if (filters.activatedFrom) clauses.push(gte(workItems.activatedDate, filters.activatedFrom));
  if (filters.activatedTo) clauses.push(lte(workItems.activatedDate, filters.activatedTo));
  if (filters.closedFrom) clauses.push(gte(workItems.closedDate, filters.closedFrom));
  if (filters.closedTo) clauses.push(lte(workItems.closedDate, filters.closedTo));

  if (filters.isClosed === true) clauses.push(isNotNull(workItems.closedDate));
  if (filters.isClosed === false) clauses.push(isNull(workItems.closedDate));
  if (filters.hasParent === true) clauses.push(isNotNull(workItems.parentId));
  if (filters.hasParent === false) clauses.push(isNull(workItems.parentId));

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export async function countWorkItemsFiltered(filters: WorkItemsFilter): Promise<number> {
  const where = buildWhereClauses(filters);
  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(workItems)
    .leftJoin(people, eq(workItems.assignedToId, people.id))
    .leftJoin(workItemTypes, eq(workItems.workItemTypeId, workItemTypes.id))
    .where(where as any);
  return (result?.[0]?.count ?? 0) as number;
}

export async function listWorkItemsFiltered(
  filters: WorkItemsFilter,
  limit: number,
  offset: number,
  sort: WorkItemsSort = {}
): Promise<WorkItemDbRow[]> {
  const where = buildWhereClauses(filters);
  const order = (sort.sortBy === 'id' && sort.sortDir === 'desc') ? desc(workItems.id) : asc(workItems.id);

  const rows = await db
    .select({
      id: workItems.id,
      workItemTypeId: workItems.workItemTypeId,
      workItemType: workItemTypes.name,
      state: workItems.state,
      createdDate: workItems.createdDate,
      activatedDate: workItems.activatedDate,
      closedDate: workItems.closedDate,
      title: workItems.title,
      description: workItems.description,
      parentId: workItems.parentId,
      assignedToId: workItems.assignedToId,
      assignedTo: people.name,
    })
    .from(workItems)
    .leftJoin(people, eq(workItems.assignedToId, people.id))
    .leftJoin(workItemTypes, eq(workItems.workItemTypeId, workItemTypes.id))
    .where(where as any)
    .orderBy(order)
    .limit(limit)
    .offset(offset);

  return rows as WorkItemDbRow[];
}

export async function countWorkItemsClosedFiltered(filters: WorkItemsFilter): Promise<number> {
  const baseWhere = buildWhereClauses(filters);
  const closedClause = isNotNull(workItems.closedDate);
  const where = baseWhere ? and(baseWhere as any, closedClause) : closedClause;
  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(workItems)
    .leftJoin(people, eq(workItems.assignedToId, people.id))
    .leftJoin(workItemTypes, eq(workItems.workItemTypeId, workItemTypes.id))
    .where(where as any);
  return (result?.[0]?.count ?? 0) as number;
}

export type WorkItemDatesRow = Pick<WorkItemDbRow, 'id' | 'state' | 'createdDate' | 'activatedDate' | 'closedDate'>;

export async function listWorkItemsDatesForSummary(filters: WorkItemsFilter): Promise<WorkItemDatesRow[]> {
  const where = buildWhereClauses(filters);
  const rows = await db
    .select({
      id: workItems.id,
      state: workItems.state,
      createdDate: workItems.createdDate,
      activatedDate: workItems.activatedDate,
      closedDate: workItems.closedDate,
    })
    .from(workItems)
    .leftJoin(people, eq(workItems.assignedToId, people.id))
    .leftJoin(workItemTypes, eq(workItems.workItemTypeId, workItemTypes.id))
    .where(where as any);
  return rows as WorkItemDatesRow[];
}


