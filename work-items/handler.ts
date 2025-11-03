import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workItemInputSchema } from './schema';
import { importWorkItems, listWorkItemsWithDevelopmentTime } from './service';
import { requireAuth } from '../auth';

export async function workItemsRoutes(app: FastifyInstance) {
  app.post('/import', { preHandler: requireAuth }, async (request, reply) => {
    const arraySchema = z.array(workItemInputSchema).min(1);
    const parsed = arraySchema.safeParse(request.body);
    if (!parsed.success) {
      const issues = parsed.error.issues.flatMap((i) => {
        const buildPathStr = (pathArr: Array<string | number | symbol>) =>
          ['items']
            .concat(
              pathArr.map((p) => {
                if (typeof p === 'number') return `[${p}]`;
                const key = String(p);
                return `.${key.includes(' ') ? `"${key}"` : key}`;
              })
            )
            .join('');

        const makeOut = (pathArr: Array<string | number | symbol>, msg: string, code: string, extra?: any) => {
          const out: any = { path: buildPathStr(pathArr), message: msg, code };
          if (extra?.received) out.received = extra.received;
          if (extra?.expected) out.expected = extra.expected;
          return out;
        };

        // Desdobrar invalid_union para mostrar erros internos de cada ramo
        if ((i as any).code === 'invalid_union' && Array.isArray((i as any).unionErrors)) {
          const unionErrors: any[] = (i as any).unionErrors as any[];
          const innerIssues = unionErrors.flatMap((ue: any) => Array.isArray(ue.issues) ? ue.issues : []);
          if (innerIssues.length > 0) {
            return innerIssues.map((inner: any) => {
              const fullPath = [...(i.path as Array<string | number | symbol>), ...(inner.path as Array<string | number | symbol>)];
              return makeOut(fullPath, inner.message, inner.code, inner);
            });
          }
          // Se não houver detalhes, mantenha o erro do nível superior
          return [makeOut(i.path, i.message, (i as any).code, i)];
        }

        // Padrão: erro simples
        return [makeOut(i.path, i.message, (i as any).code, i)];
      });
      return reply.status(400).send({ error: 'Invalid input', errors: issues });
    }

    try {
      const result = await importWorkItems(parsed.data);
      return reply.send(result);
    } catch (err: any) {
      request.log.error({ err }, 'work-items import failed');
      return reply.status(500).send({ error: 'internal_error' });
    }
  });

  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const querySchema = z.object({
      // paginação
      limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      offset: z.coerce.number().int().min(0).optional().default(0),
      sortBy: z.enum(['id']).optional().default('id'),
      sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
      // filtros
      id: z.coerce.number().int().optional(),
      parentId: z.coerce.number().int().optional(),
      workItemType: z.string().min(1).optional(),
      workItemTypeId: z.string().uuid().optional(),
      state: z.string().min(1).optional(),
      assignedToId: z.string().uuid().optional(),
      assignedTo: z.string().min(1).optional(),
      titleContains: z.string().min(1).optional(),
      createdFrom: z.string().datetime().optional(),
      createdTo: z.string().datetime().optional(),
      activatedFrom: z.string().datetime().optional(),
      activatedTo: z.string().datetime().optional(),
      closedFrom: z.string().datetime().optional(),
      closedTo: z.string().datetime().optional(),
      isClosed: z.coerce.boolean().optional(),
      hasParent: z.coerce.boolean().optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    const q = parsed.data;
    try {
      const { items, total, summary } = await listWorkItemsWithDevelopmentTime(
        {
          id: q.id,
          parentId: q.parentId,
          workItemType: q.workItemType,
          workItemTypeId: q.workItemTypeId,
          state: q.state,
          assignedToId: q.assignedToId,
          assignedTo: q.assignedTo,
          titleContains: q.titleContains,
          createdFrom: q.createdFrom ? new Date(q.createdFrom) : undefined,
          createdTo: q.createdTo ? new Date(q.createdTo) : undefined,
          activatedFrom: q.activatedFrom ? new Date(q.activatedFrom) : undefined,
          activatedTo: q.activatedTo ? new Date(q.activatedTo) : undefined,
          closedFrom: q.closedFrom ? new Date(q.closedFrom) : undefined,
          closedTo: q.closedTo ? new Date(q.closedTo) : undefined,
          isClosed: q.isClosed,
          hasParent: q.hasParent,
        },
        q.limit,
        q.offset,
        { sortBy: q.sortBy, sortDir: q.sortDir }
      );
      return reply.send({ items, total, summary });
    } catch (err: any) {
      request.log.error({ err }, 'work-items list failed');
      return reply.status(500).send({ error: 'internal_error' });
    }
  });
}


