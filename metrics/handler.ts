import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { requireAuth } from '../auth';
import { baseQueryParamsSchema, normalizeWindow } from './schema';
import { getArrival, getCapacityByPerson, getHierarchy, getLeadCycle, getSla, getStuck, getThroughput, getWip } from './service';

export async function metricsRoutes(app: FastifyInstance) {
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  app.addHook('onRequest', requireAuth);
  app.addHook('onResponse', async (request, _reply) => {
    try {
      const start = (request as any).startTime as number | undefined;
      const durationMs = start ? Date.now() - start : undefined;
      request.log.info({ endpoint: request.routeOptions?.url, query: request.query, durationMs }, 'metrics request');
    } catch {}
  });
  app.addHook('preHandler', async (request) => { (request as any).startTime = Date.now(); });

  app.get('/throughput', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getThroughput(params);
    return reply.send(data);
  });

  app.get('/arrival', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getArrival(params);
    return reply.send(data);
  });

  app.get('/wip', async (_request, reply) => {
    const data = await getWip();
    return reply.send(data);
  });

  app.get('/lead-time', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getLeadCycle(params);
    return reply.send(data);
  });

  app.get('/cycle-time', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getLeadCycle(params);
    return reply.send(data);
  });

  app.get('/sla', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getSla(params);
    return reply.send(data);
  });

  app.get('/stuck', async (_request, reply) => {
    const data = await getStuck();
    return reply.send(data);
  });

  app.get('/hierarchy', async (_request, reply) => {
    const data = await getHierarchy();
    return reply.send(data);
  });

  app.get('/capacity', async (request, reply) => {
    const parsed = baseQueryParamsSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    const params = normalizeWindow(parsed.data);
    const data = await getCapacityByPerson(params);
    return reply.send(data);
  });
}


