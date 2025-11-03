import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listPeople } from './repository';
import { requireAuth } from '../auth';

export async function peopleRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const querySchema = z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).optional(),
    });

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }

    try {
      const items = await listPeople({
        id: parsed.data.id,
        name: parsed.data.name,
      });
      return reply.send({ items });
    } catch (err: any) {
      request.log.error({ err }, 'people list failed');
      return reply.status(500).send({ error: 'internal_error' });
    }
  });
}
