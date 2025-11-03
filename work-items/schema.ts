import { z } from 'zod';

// Util: normalizar título para matching robusto (minusculas, sem acentos, espaços colapsados, remove colchetes nas pontas)
export function normalizeTitle(input: string | null | undefined): string | null {
  if (!input) return null;
  const lower = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\[|\]$/g, '');
  return lower || null;
}

// Util: parse "DD-MM-YYYY HH:mm" para Date UTC
export function parseUtcDate(input: string): Date {
  const m = input.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid date format: ${input}`);
  const [, dd, mm, yyyy, HH, MM] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM)));
  return date;
}

// Schema bruto com chaves contendo espaços, conforme OpenAPI
export const workItemRawSchema = z.object({
  id: z.string().min(1),
  'work item type': z.string().min(1),
  'assigned to': z.string().optional().nullable(),
  state: z.string().min(1),
  'created date': z.string().min(1),
  'activated date': z.string().optional().nullable(),
  'closed date': z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  title: z.string().min(1),
  parent: z.string().optional().nullable(),
});

export type WorkItemRaw = z.infer<typeof workItemRawSchema>;

// Aceita também camelCase e converte para o formato com espaços
const workItemCamelCaseSchema = z
  .object({
    id: z.string().min(1),
    workItemType: z.string().min(1),
    assignedTo: z.string().optional().nullable(),
    state: z.string().min(1),
    createdDate: z.string().min(1),
    activatedDate: z.string().optional().nullable(),
    closedDate: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    title: z.string().min(1),
    parent: z.string().optional().nullable(),
  })
  .transform((m) => ({
    id: m.id,
    'work item type': m.workItemType,
    'assigned to': m.assignedTo ?? null,
    state: m.state,
    'created date': m.createdDate,
    'activated date': m.activatedDate ?? null,
    'closed date': m.closedDate ?? null,
    description: m.description ?? null,
    title: m.title,
    parent: m.parent ?? null,
  }));

export const workItemInputSchema = z.union([workItemRawSchema, workItemCamelCaseSchema]);

// DTO normalizado para domínio/DB
export type WorkItemDTO = {
  id: number;
  workItemType: string;
  state: string;
  createdDate: Date;
  activatedDate: Date | null;
  closedDate: Date | null;
  title: string;
  titleNormalized: string; // para matching
  description: string | null;
  assignedToName: string | null;
  parentTitleNormalized: string | null;
};

export function toDTO(raw: WorkItemRaw): WorkItemDTO {
  const closed = raw['closed date'] ? parseUtcDate(raw['closed date']) : null;
  const activated = raw['activated date'] ? parseUtcDate(raw['activated date']) : null;
  const titleNorm = normalizeTitle(raw.title) as string; // title é obrigatório
  const parentNorm = normalizeTitle(raw.parent ?? null);
  return {
    id: Number(raw.id),
    workItemType: raw['work item type'],
    state: raw.state,
    createdDate: parseUtcDate(raw['created date']),
    activatedDate: activated,
    closedDate: closed,
    title: raw.title,
    titleNormalized: titleNorm,
    description: raw.description ?? null,
    assignedToName: raw['assigned to'] ?? null,
    parentTitleNormalized: parentNorm,
  };
}


