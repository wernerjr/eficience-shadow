import { z } from 'zod';

export const groupByEnum = z.enum(['day', 'week', 'month', 'quarter']);
export const dimensionEnum = z.enum(['type', 'person']);

export const baseQueryParamsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  groupBy: groupByEnum.default('week'),
  workItemTypeId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  dimension: dimensionEnum.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
}).refine(
  (data) => {
    const hasBothFilters = data.workItemTypeId && data.personId;
    // Se ambos os filtros estão presentes, dimension é obrigatório
    if (hasBothFilters && !data.dimension) {
      return false;
    }
    return true;
  },
  {
    message: 'dimension é obrigatório quando tanto workItemTypeId quanto personId estão presentes',
    path: ['dimension'],
  }
);

export type BaseQueryParams = z.infer<typeof baseQueryParamsSchema> & {
  fromDate: Date;
  toDate: Date;
};

export function normalizeWindow(params: z.infer<typeof baseQueryParamsSchema>): BaseQueryParams {
  const now = new Date();
  const toDate = params.to ? new Date(params.to) : now;
  const fromDate = params.from ? new Date(params.from) : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { ...params, fromDate, toDate } as BaseQueryParams;
}


