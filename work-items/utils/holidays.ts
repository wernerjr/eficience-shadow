const cache = new Map<number, Set<string>>();

function toIsoDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function fetchBrazilHolidays(year: number): Promise<Set<string>> {
  const url = `https://brasilapi.com.br/api/feriados/v1/${year}`;
  const doFetch = async () => {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error(`BrasilAPI error ${res.status}`);
    const data: Array<{ date: string }> = await res.json();
    const out = new Set<string>();
    for (const h of data) {
      // BrasilAPI retorna YYYY-MM-DD
      if (h?.date) out.add(h.date);
    }
    return out;
  };

  try {
    return await doFetch();
  } catch (_e) {
    // retry simples
    await new Promise((r) => setTimeout(r, 200));
    try {
      return await doFetch();
    } catch (e) {
      console.warn(`[holidays] Falha ao buscar feriados ${year}:`, e);
      return new Set();
    }
  }
}

export async function getBrazilPublicHolidays(year: number): Promise<Set<string>> {
  const cached = cache.get(year);
  if (cached) return cached;
  const set = await fetchBrazilHolidays(year);
  cache.set(year, set);
  return set;
}

export function isHolidayFactory(setsByYear: Map<number, Set<string>>) {
  return (isoDate: string) => {
    const [yStr] = isoDate.split('-');
    const y = Number(yStr);
    const set = setsByYear.get(y);
    return set ? set.has(isoDate) : false;
  };
}

export function truncateToUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function toIsoUTC(date: Date): string {
  return toIsoDateUTC(date);
}


