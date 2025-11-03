import { FastifyReply, FastifyRequest } from 'fastify';
import { jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');
  return new TextEncoder().encode(secret);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers['authorization'] || request.headers['Authorization'];
  if (!header || Array.isArray(header)) {
    return reply.status(401).send({ error: 'unauthorized' });
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.status(401).send({ error: 'unauthorized' });
  }
  const token = parts[1];
  try {
    const secret = getJwtSecret();
    await jwtVerify(token, secret);
  } catch {
    return reply.status(401).send({ error: 'unauthorized' });
  }
}


