import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDevelopmentBusinessDays } from '../../work-items/service';

function iso(y: number, m: number, d: number) {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function d(y: number, m: number, day: number, hh = 0, mm = 0) {
  return new Date(Date.UTC(y, m - 1, day, hh, mm));
}

describe('computeDevelopmentBusinessDays', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch as any;
  });

  it('retorna null quando não há closedDate', async () => {
    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 5, 2),
      activatedDate: null,
      closedDate: null,
    } as any);
    expect(res).toBeNull();
  });

  it('conta dias úteis simples sem feriados (inclui início e fim)', async () => {
    // 2025-05-05 (seg) até 2025-05-09 (sex) => 5 dias úteis
    vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 5, 5),
      activatedDate: null,
      closedDate: d(2025, 5, 9),
    } as any);
    expect(res).toBe(5);
  });

  it('ignora fins de semana', async () => {
    // 2025-05-09 (sex) até 2025-05-12 (seg) => dias úteis: sex, seg = 2
    vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 5, 9),
      activatedDate: null,
      closedDate: d(2025, 5, 12),
    } as any);
    expect(res).toBe(2);
  });

  it('exclui feriado nacional retornado pela BrasilAPI', async () => {
    // Suponha 2025-05-08 é feriado devolvido pela API
    vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ date: iso(2025, 5, 8) }],
    });
    // Janela: 2025-05-07 (qua) a 2025-05-09 (sex) => úteis: 7(quarta), 9(sexta) = 2
    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 5, 7, 10, 30),
      activatedDate: null,
      closedDate: d(2025, 5, 9, 18, 0),
    } as any);
    expect(res).toBe(2);
  });

  it('usa activatedDate quando presente', async () => {
    vi.spyOn(globalThis as any, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 5, 5),
      activatedDate: d(2025, 5, 6),
      closedDate: d(2025, 5, 9),
    } as any);
    // 6(ter) a 9(sex) => 4 úteis
    expect(res).toBe(4);
  });

  it('atravessa anos buscando feriados de múltiplos anos', async () => {
    const fetchMock = vi.fn()
      // 2025
      .mockResolvedValueOnce({ ok: true, json: async () => [{ date: iso(2025, 12, 31) }] })
      // 2026
      .mockResolvedValueOnce({ ok: true, json: async () => [{ date: iso(2026, 1, 2) }] });
    (globalThis as any).fetch = fetchMock;

    const res = await computeDevelopmentBusinessDays({
      createdDate: d(2025, 12, 31),
      activatedDate: null,
      closedDate: d(2026, 1, 2),
    } as any);

    // Considerando que 31/12/2025 e 02/01/2026 são feriados, e 01/01/2026 é feriado nacional
    // úteis entre 2025-12-31 e 2026-01-02:
    // 2025-12-31 (feriado) -> 0
    // 2026-01-01 (qui, feriado) -> 0
    // 2026-01-02 (sex, feriado) -> 0
    expect(res).toBe(0);
  });
});


