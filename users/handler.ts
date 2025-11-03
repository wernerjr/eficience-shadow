import { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './schema';
import { createUser, findUserByEmail, findUserByGoogleId, verifyPassword } from './repository';
import { SignJWT } from 'jose';
import { getGoogleAuthUrl, exchangeCodeForTokens, fetchGoogleUser } from './google';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');
  return new TextEncoder().encode(secret);
}

async function signJwt(payload: Record<string, unknown>) {
  const secret = getJwtSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function usersRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const user = await createUser({ email, password });
    const token = await signJwt({ sub: user.id, email: user.email });
    return reply.status(201).send({ token });
  });

  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const token = await signJwt({ sub: user.id, email: user.email });
    return reply.send({ token });
  });

  app.get('/google', async (request, reply) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const origin = `${request.protocol}://${request.headers.host}`;
    const redirectUri = `${origin}/users/google`;

    const code = url.searchParams.get('code');
    if (!code) {
      const authUrl = getGoogleAuthUrl(redirectUri);
      reply.redirect(authUrl);
      return;
    }

    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const profile = await fetchGoogleUser(tokens.access_token);

    let user = await findUserByGoogleId(profile.sub);
    if (!user) {
      // cria usuário novo com email do Google e googleId
      user = await createUser({ email: profile.email, googleId: profile.sub });
    }

    const jwt = await signJwt({ sub: user.id, email: user.email });
    return reply.send({ token: jwt });
  });
}


