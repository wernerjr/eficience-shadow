import { describe, it, expect } from 'vitest';
import { normalizeTitle, parseUtcDate, toDTO, workItemRawSchema } from '../../work-items/schema';

describe('normalizeTitle', () => {
  it('normaliza acentos, caixa e espaços', () => {
    expect(normalizeTitle('  Árvore   de  TÍTULO ')).toBe('arvore de titulo');
  });
  it('remove colchetes de ponta', () => {
    expect(normalizeTitle('[Estoque]')).toBe('estoque');
  });
});

describe('parseUtcDate', () => {
  it('parseia DD-MM-YYYY HH:mm como UTC', () => {
    const d = parseUtcDate('05-06-2025 11:03');
    expect(d.toISOString()).toBe('2025-06-05T11:03:00.000Z');
  });
});

describe('toDTO', () => {
  it('converte raw para DTO com normalização', () => {
    const raw = {
      id: '123',
      'work item type': 'Feature',
      'assigned to': 'Alguem',
      state: 'Closed',
      'created date': '26-03-2025 08:47',
      'activated date': '23-04-2025 11:33',
      'closed date': '05-06-2025 11:03',
      description: 'Desc',
      title: '[Estoque] Entrada',
      parent: '[Estoque] Raiz'
    };
    const parsed = workItemRawSchema.parse(raw);
    const dto = toDTO(parsed);
    expect(dto.id).toBe(123);
    expect(dto.titleNormalized).toBe('estoque entrada');
    expect(dto.parentTitleNormalized).toBe('estoque raiz');
  });
});


