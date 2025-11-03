import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from './db/index';
import { usersRoutes } from './users/handler';
import { workItemsRoutes } from './work-items/handler';
import { metricsRoutes } from './metrics/handler';
import { peopleRoutes } from './people/handler';
import { workItemTypesRoutes } from './work-item-types/handler';

const app = Fastify({ 
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }
});

// CORS antes das rotas
await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Registra rotas do vertical slice de usuários
app.register(usersRoutes, { prefix: '/users' });

// Registra rotas do vertical slice de work-items
app.register(workItemsRoutes, { prefix: '/work-items' });

// Registra rotas do vertical slice de métricas
app.register(metricsRoutes, { prefix: '/metrics' });

// Registra rotas do vertical slice de pessoas
app.register(peopleRoutes, { prefix: '/people' });

// Registra rotas do vertical slice de work item types
app.register(workItemTypesRoutes, { prefix: '/work-item-types' });

// Servir OpenAPI e Swagger UI (spec externo)
app.get('/openapi.yaml', async (_req, reply) => {
  // serve como arquivo estático simples
  const fs = await import('node:fs/promises');
  const data = await fs.readFile(new URL('./openapi.yaml', import.meta.url));
  reply.type('application/yaml').send(data);
});

app.get('/docs', async (_req, reply) => {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Eficience Shadow Backend - Docs</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script>
        window.onload = () => {
          SwaggerUIBundle({
            url: '/openapi.yaml',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis],
            layout: 'BaseLayout'
          });
        }
      </script>
    </body>
  </html>`;
  reply.type('text/html').send(html);
});

// Healthcheck (liveness)
app.head('/health', async (_req, reply) => {
  reply.header('cache-control', 'no-store').status(200).send();
});

app.get('/health', async (_req, reply) => {
  reply
    .header('cache-control', 'no-store')
    .send({ status: 'ok', uptime: Math.round(process.uptime()), now: new Date().toISOString() });
});

// Readiness (verifica dependências essenciais, ex: DB)
app.get('/ready', async (_req, reply) => {
  try {
    await pool.query('select 1');
    reply.header('cache-control', 'no-store').send({ status: 'ready' });
  } catch {
    reply.header('cache-control', 'no-store').status(503).send({ status: 'degraded', error: 'database_unreachable' });
  }
});

const port = Number(process.env.PORT || 3000);
const host = '127.0.0.1';

async function start() {
  try {
    await app.listen({ port, host });
    console.log(`🚀 Server listening on http://${host}:${port}`);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Validação básica de envs críticos
function assertEnv(name: string) {
  if (!process.env[name]) {
    throw new Error(`Env var ${name} is required`);
  }
}

assertEnv('DATABASE_URL');
assertEnv('JWT_SECRET');
assertEnv('GOOGLE_CLIENT_ID');
assertEnv('GOOGLE_CLIENT_SECRET');

start();


