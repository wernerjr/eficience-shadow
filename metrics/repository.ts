import { pool } from '../db/index';

export type GroupByUnit = 'day' | 'week' | 'month' | 'quarter';

function toPgUnit(groupBy: GroupByUnit): string {
  if (groupBy === 'day') return 'day';
  if (groupBy === 'week') return 'week';
  if (groupBy === 'month') return 'month';
  return 'quarter';
}

type CommonParams = {
  from: Date;
  to: Date;
  groupBy: GroupByUnit;
  workItemTypeId?: string;
  personId?: string;
  dimension?: 'type' | 'person';
  limit?: number;
  offset?: number;
};

export async function queryThroughput(params: CommonParams) {
  const unit = toPgUnit(params.groupBy);
  const hasTypeFilter = params.workItemTypeId !== undefined && params.workItemTypeId !== null;
  
  const q = hasTypeFilter
    ? `
    WITH base AS (
      SELECT wi.id, wi.closed_date, wt.id AS work_item_type_id, wt.name AS type_name
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      WHERE wi.closed_date >= $1 AND wi.closed_date < $2
        AND wi.work_item_type_id = $3
    )
    SELECT DATE_TRUNC($4, closed_date) AS period,
           work_item_type_id,
           MAX(type_name) AS type_name,
           COUNT(*) AS closed_count
    FROM base
    GROUP BY 1, work_item_type_id
    ORDER BY period;
  `
    : `
    WITH base AS (
      SELECT wi.id, wi.closed_date, wt.name AS type_name
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      WHERE wi.closed_date >= $1 AND wi.closed_date < $2
    )
    SELECT DATE_TRUNC($3, closed_date) AS period,
           type_name,
           COUNT(*) AS closed_count
    FROM base
    GROUP BY 1,2
    ORDER BY period;
  `;
  
  const res = hasTypeFilter
    ? await pool.query(q, [params.from, params.to, params.workItemTypeId, unit])
    : await pool.query(q, [params.from, params.to, unit]);
  return res.rows;
}

export async function queryArrivalVsThroughput(params: CommonParams) {
  const unit = toPgUnit(params.groupBy);
  const q = `
    WITH arrivals AS (
      SELECT DATE_TRUNC($3, wi.created_date) AS period,
             COUNT(*) AS created_count
      FROM work_items wi
      WHERE wi.created_date >= $1 AND wi.created_date < $2
      GROUP BY 1
    ), throughput AS (
      SELECT DATE_TRUNC($3, wi.closed_date) AS period,
             COUNT(*) AS closed_count
      FROM work_items wi
      WHERE wi.closed_date >= $1 AND wi.closed_date < $2
      GROUP BY 1
    )
    SELECT COALESCE(a.period, t.period) AS period,
           COALESCE(created_count, 0) AS created,
           COALESCE(closed_count, 0) AS closed,
           COALESCE(created_count, 0) - COALESCE(closed_count, 0) AS delta
    FROM arrivals a
    FULL OUTER JOIN throughput t ON a.period = t.period
    ORDER BY period;
  `;
  const res = await pool.query(q, [params.from, params.to, unit]);
  return res.rows;
}

export async function queryWipSnapshot() {
  const q = `
    WITH wip AS (
      SELECT wi.id, wi.work_item_type_id, wt.name AS type_name,
             wi.assigned_to_id, p.name AS person_name,
             NOW() - COALESCE(wi.activated_date, wi.created_date) AS aging_interval
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      LEFT JOIN people p ON p.id = wi.assigned_to_id
      WHERE wi.closed_date IS NULL
    )
    SELECT 'total' AS dimension, NULL::text AS name,
           COUNT(*) AS wip_count,
           CEIL(EXTRACT(EPOCH FROM AVG(aging_interval)) / 86400.0)::integer AS aging_avg,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer AS p50,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer AS p75,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.85) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer AS p85,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer AS p90,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.95) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer AS p95
    FROM wip
    UNION ALL
    SELECT 'type', type_name, COUNT(*), CEIL(EXTRACT(EPOCH FROM AVG(aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.85) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.95) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer
    FROM wip GROUP BY 1,2
    UNION ALL
    SELECT 'person', COALESCE(person_name,'(unassigned)'), COUNT(*), CEIL(EXTRACT(EPOCH FROM AVG(aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.85) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.95) WITHIN GROUP (ORDER BY aging_interval)) / 86400.0)::integer
    FROM wip GROUP BY 1,2;
  `;
  const res = await pool.query(q);
  return res.rows;
}

export async function queryLeadCycle(params: CommonParams) {
  const unit = toPgUnit(params.groupBy);
  const hasTypeFilter = params.workItemTypeId !== undefined && params.workItemTypeId !== null;
  const hasPersonFilter = params.personId !== undefined && params.personId !== null;
  const dimension = params.dimension;
  
  // Construir WHERE clause dinamicamente
  let whereClause = 'WHERE wi.closed_date >= $1 AND wi.closed_date < $2';
  let paramIndex = 3;
  const queryParams: any[] = [params.from, params.to];
  
  if (hasTypeFilter) {
    whereClause += ` AND wi.work_item_type_id = $${paramIndex}`;
    queryParams.push(params.workItemTypeId);
    paramIndex++;
  }
  
  if (hasPersonFilter) {
    whereClause += ` AND wi.assigned_to_id = $${paramIndex}`;
    queryParams.push(params.personId);
    paramIndex++;
  }
  
  // unit é sempre o último parâmetro
  queryParams.push(unit);
  const unitParam = `$${paramIndex}`;
  
  // Selecionar qual dimensão retornar baseado no parâmetro dimension
  // Se dimension não for especificado, retorna ambas (comportamento padrão)
  const typeSelectBase = `
    SELECT 'type' AS dimension, type_name AS name,
           DATE_TRUNC(${unitParam}, closed_date) AS period,
           COUNT(*) AS n,
           CEIL(EXTRACT(EPOCH FROM AVG(lead_interval)) / 86400.0)::integer AS lead_avg,
           STDDEV_SAMP(lead_days) AS lead_std,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p50,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p75,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.85) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p85,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p90,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.95) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p95,
           CASE WHEN AVG(cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM AVG(cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_avg,
           CASE WHEN percentile_disc(0.5) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p50,
           CASE WHEN percentile_disc(0.75) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p75,
           CASE WHEN percentile_disc(0.90) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p90
    FROM closed
    GROUP BY 1,2,3
  `;
  
  const personSelectBase = `
    SELECT 'person' AS dimension, COALESCE(person_name,'(unassigned)') AS name,
           DATE_TRUNC(${unitParam}, closed_date) AS period,
           COUNT(*) AS n,
           CEIL(EXTRACT(EPOCH FROM AVG(lead_interval)) / 86400.0)::integer AS lead_avg,
           STDDEV_SAMP(lead_days) AS lead_std,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p50,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p75,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.85) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p85,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p90,
           CEIL(EXTRACT(EPOCH FROM percentile_disc(0.95) WITHIN GROUP (ORDER BY lead_interval)) / 86400.0)::integer AS lead_p95,
           CASE WHEN AVG(cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM AVG(cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_avg,
           CASE WHEN percentile_disc(0.5) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.5) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p50,
           CASE WHEN percentile_disc(0.75) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.75) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p75,
           CASE WHEN percentile_disc(0.90) WITHIN GROUP (ORDER BY cycle_interval) IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM percentile_disc(0.90) WITHIN GROUP (ORDER BY cycle_interval)) / 86400.0)::integer ELSE NULL END AS cycle_p90
    FROM closed
    GROUP BY 1,2,3
  `;
  
  // Construir query baseado na dimensão especificada
  let selectClause = '';
  if (dimension === 'type') {
    selectClause = `${typeSelectBase} ORDER BY period`;
  } else if (dimension === 'person') {
    selectClause = `${personSelectBase} ORDER BY period`;
  } else {
    // Se dimension não for especificado, retorna ambas
    // Para UNION ALL, precisamos envolver em uma query externa para ordenar
    selectClause = `
      SELECT * FROM (
        ${typeSelectBase}
        UNION ALL
        ${personSelectBase}
      ) AS combined
      ORDER BY period
    `;
  }
  
  const q = `
    WITH closed AS (
      SELECT wi.id, wi.work_item_type_id, wt.name AS type_name,
             wi.assigned_to_id, p.name AS person_name,
             wi.created_date, wi.activated_date, wi.closed_date,
             (wi.closed_date - wi.created_date) AS lead_interval,
             CASE WHEN wi.activated_date IS NOT NULL THEN (wi.closed_date - wi.activated_date) END AS cycle_interval,
             EXTRACT(EPOCH FROM (wi.closed_date - wi.created_date)) / 86400.0 AS lead_days
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      LEFT JOIN people p ON p.id = wi.assigned_to_id
      ${whereClause}
    )
    ${selectClause}
  `;
  const res = await pool.query(q, queryParams);
  return res.rows;
}

export async function querySla(params: CommonParams) {
  const unit = toPgUnit(params.groupBy);
  const q = `
    WITH prev_q AS (
      SELECT wt.id AS type_id,
             percentile_disc(0.85) WITHIN GROUP (ORDER BY (wi.closed_date - COALESCE(wi.activated_date, wi.created_date))) AS sla_target_interval
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      WHERE wi.closed_date >= DATE_TRUNC('quarter', $1) - INTERVAL '1 quarter'
        AND wi.closed_date <  DATE_TRUNC('quarter', $1)
      GROUP BY wt.id
    ), current AS (
      SELECT wi.id, wt.id AS type_id,
             wi.closed_date,
             (wi.closed_date - COALESCE(wi.activated_date, wi.created_date)) AS cycle_or_lead
      FROM work_items wi
      JOIN work_item_types wt ON wt.id = wi.work_item_type_id
      WHERE wi.closed_date >= $1 AND wi.closed_date < $2
    )
    SELECT DATE_TRUNC($3, c.closed_date) AS period,
           wt.name AS type_name,
           COUNT(*) AS total,
           SUM(CASE WHEN c.cycle_or_lead <= pq.sla_target_interval THEN 1 ELSE 0 END) AS met,
           ROUND(100.0 * SUM(CASE WHEN c.cycle_or_lead <= pq.sla_target_interval THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS met_pct,
           CASE WHEN pq.sla_target_interval IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM pq.sla_target_interval) / 86400.0)::integer ELSE NULL END AS sla_target
    FROM current c
    JOIN work_item_types wt ON wt.id = c.type_id
    LEFT JOIN prev_q pq ON pq.type_id = c.type_id
    GROUP BY 1,2, pq.sla_target_interval
    ORDER BY period;
  `;
  const res = await pool.query(q, [params.from, params.to, unit]);
  return res.rows;
}

export async function queryStuckTop20() {
  const q = `
    SELECT wi.id, wi.title, wt.name AS type_name,
           COALESCE(p.name,'(unassigned)') AS person_name,
           EXTRACT(EPOCH FROM (NOW() - COALESCE(wi.activated_date, wi.created_date))) / 86400.0 AS aging_days
    FROM work_items wi
    JOIN work_item_types wt ON wt.id = wi.work_item_type_id
    LEFT JOIN people p ON p.id = wi.assigned_to_id
    WHERE wi.closed_date IS NULL
    ORDER BY aging_days DESC
    LIMIT 20;
  `;
  const res = await pool.query(q);
  return res.rows;
}

export async function queryHierarchy() {
  const q = `
    WITH children AS (
      SELECT child.id, child.parent_id, child.created_date, child.closed_date,
             (child.closed_date - child.created_date) AS lead_interval
      FROM work_items child
      WHERE child.parent_id IS NOT NULL
    ), agg AS (
      SELECT parent_id,
             COUNT(*) AS total_children,
             SUM(CASE WHEN closed_date IS NOT NULL THEN 1 ELSE 0 END) AS closed_children,
             AVG(lead_interval) FILTER (WHERE closed_date IS NOT NULL) AS avg_lead_interval
      FROM children
      GROUP BY parent_id
    )
    SELECT a.parent_id,
           p.title AS parent_title,
           a.total_children,
           a.closed_children,
           ROUND(100.0 * a.closed_children / NULLIF(a.total_children,0), 1) AS percent_closed,
           CASE WHEN a.avg_lead_interval IS NOT NULL THEN CEIL(EXTRACT(EPOCH FROM a.avg_lead_interval) / 86400.0)::integer ELSE NULL END AS avg_lead
    FROM agg a
    LEFT JOIN work_items p ON p.id = a.parent_id
    ORDER BY percent_closed DESC NULLS LAST;
  `;
  const res = await pool.query(q);
  return res.rows;
}

export async function queryCapacityByPerson(params: CommonParams) {
  const unit = toPgUnit(params.groupBy);
  const hasPersonFilter = params.personId !== undefined && params.personId !== null;
  
  const whereClause = hasPersonFilter
    ? 'WHERE wi.closed_date >= $1 AND wi.closed_date < $2 AND wi.assigned_to_id = $3'
    : 'WHERE wi.closed_date >= $1 AND wi.closed_date < $2';
  
  const unitParam = hasPersonFilter ? '$4' : '$3';
  
  const q = `
    SELECT DATE_TRUNC(${unitParam}, wi.closed_date) AS period,
           COALESCE(p.name,'(unassigned)') AS person_name,
           COUNT(*) AS closed_count
    FROM work_items wi
    LEFT JOIN people p ON p.id = wi.assigned_to_id
    ${whereClause}
    GROUP BY 1,2
    ORDER BY period;
  `;
  
  const queryParams = hasPersonFilter
    ? [params.from, params.to, params.personId, unit]
    : [params.from, params.to, unit];
  
  const res = await pool.query(q, queryParams);
  return res.rows;
}


