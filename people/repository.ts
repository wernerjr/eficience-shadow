import { db } from '../db/index';
import { people } from '../db/schema';
import { eq, and, ilike, asc } from 'drizzle-orm';

export type PeopleFilter = {
  id?: string;
  name?: string; // substring (ILIKE)
};

export async function listPeople(filter: PeopleFilter = {}) {
  const clauses = [];

  if (filter.id) {
    clauses.push(eq(people.id, filter.id));
  }

  if (filter.name) {
    clauses.push(ilike(people.name, `%${filter.name}%`));
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const rows = await db
    .select()
    .from(people)
    .where(where as any)
    .orderBy(asc(people.name));

  return rows;
}
