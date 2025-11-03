import { db } from '../db/index';
import { workItemTypes } from '../db/schema';
import { eq, and, ilike, asc } from 'drizzle-orm';

export type WorkItemTypesFilter = {
  id?: string;
  name?: string; // substring (ILIKE)
};

export async function listWorkItemTypes(filter: WorkItemTypesFilter = {}) {
  const clauses = [];

  if (filter.id) {
    clauses.push(eq(workItemTypes.id, filter.id));
  }

  if (filter.name) {
    clauses.push(ilike(workItemTypes.name, `%${filter.name}%`));
  }

  const where = clauses.length > 0 ? and(...clauses) : undefined;

  const rows = await db
    .select()
    .from(workItemTypes)
    .where(where as any)
    .orderBy(asc(workItemTypes.name));

  return rows;
}
