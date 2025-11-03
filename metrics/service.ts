import { type BaseQueryParams } from './schema';
import {
  queryThroughput,
  queryArrivalVsThroughput,
  queryWipSnapshot,
  queryLeadCycle,
  querySla,
  queryStuckTop20,
  queryHierarchy,
  queryCapacityByPerson,
} from './repository';

export async function getThroughput(params: BaseQueryParams) {
  const rows = await queryThroughput({ 
    from: params.fromDate, 
    to: params.toDate, 
    groupBy: params.groupBy,
    workItemTypeId: params.workItemTypeId
  });
  return rows;
}

export async function getArrival(params: BaseQueryParams) {
  const rows = await queryArrivalVsThroughput({ from: params.fromDate, to: params.toDate, groupBy: params.groupBy });
  return rows;
}

export async function getWip() {
  const rows = await queryWipSnapshot();
  const out = { total: null as any, byType: [] as any[], byPerson: [] as any[] };
  for (const r of rows) {
    if (r.dimension === 'total') out.total = r;
    else if (r.dimension === 'type') out.byType.push(r);
    else if (r.dimension === 'person') out.byPerson.push(r);
  }
  return out;
}

export async function getLeadCycle(params: BaseQueryParams) {
  const rows = await queryLeadCycle({ 
    from: params.fromDate, 
    to: params.toDate, 
    groupBy: params.groupBy,
    workItemTypeId: params.workItemTypeId,
    personId: params.personId,
    dimension: params.dimension
  });
  return rows;
}

export async function getSla(params: BaseQueryParams) {
  const rows = await querySla({ from: params.fromDate, to: params.toDate, groupBy: params.groupBy });
  return rows;
}

export async function getStuck() {
  return queryStuckTop20();
}

export async function getHierarchy() {
  return queryHierarchy();
}

export async function getCapacityByPerson(params: BaseQueryParams) {
  return queryCapacityByPerson({ 
    from: params.fromDate, 
    to: params.toDate, 
    groupBy: params.groupBy,
    personId: params.personId
  });
}


