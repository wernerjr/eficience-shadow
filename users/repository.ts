import { db } from '../db/index';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByGoogleId(googleId: string) {
  const rows = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(params: { email: string; password?: string; googleId?: string }) {
  const passwordHash = params.password ? await bcrypt.hash(params.password, 10) : null;
  const [row] = await db.insert(users).values({
    email: params.email,
    passwordHash: passwordHash ?? undefined,
    googleId: params.googleId,
  }).returning();
  return row;
}

export async function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}


