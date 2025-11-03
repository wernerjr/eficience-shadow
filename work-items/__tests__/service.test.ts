import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as repo from '../../work-items/repository';
import { importWorkItems } from '../../work-items/service';

const payload = [
  {
    id: '1916409',
    'work item type': 'Feature',
    'assigned to': 'Bruno',
    state: 'Closed',
    'created date': '26-03-2025 08:47',
    'activated date': '23-04-2025 11:33',
    'closed date': '05-06-2025 11:03',
    description: 'Fluxo',
    title: '[Estoque] Raiz'
  },
  {
    id: '1916421',
    'work item type': 'User Story',
    'assigned to': 'Bruno',
    state: 'Closed',
    'created date': '26-03-2025 08:50',
    'activated date': '22-04-2025 15:35',
    'closed date': '05-05-2025 14:28',
    description: 'Confirmação',
    title: '[Estoque] Filho',
    parent: '[Estoque] Raiz'
  }
];

describe('importWorkItems', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('insere ambos quando não existem e resolve parentId via payload', async () => {
    vi.spyOn(repo, 'findExistingByIds').mockResolvedValue([] as any);
    const ins = vi.spyOn(repo, 'bulkInsert').mockResolvedValue(2);
    const upd = vi.spyOn(repo, 'bulkUpdateChanged').mockResolvedValue(0);

    const res = await importWorkItems(payload as any);
    expect(res).toEqual({ inserted: 2, updated: 0, ignored: 0 });
    expect(ins).toHaveBeenCalledTimes(1);
    expect(upd).toHaveBeenCalledTimes(0);
  });

  it('atualiza quando há mudança e ignora quando igual', async () => {
    vi.spyOn(repo, 'findExistingByIds').mockResolvedValue([
      { id: 1916409, workItemTypeId: '11111111-1111-1111-1111-111111111111', state: 'Closed', createdDate: new Date('2025-03-26T08:47:00Z'), activatedDate: new Date('2025-04-23T11:33:00Z'), closedDate: new Date('2025-06-05T11:03:00Z'), title: '[Estoque] Raiz', description: 'Fluxo', assignedTo: 'Bruno', parentId: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 1916421, workItemTypeId: '22222222-2222-2222-2222-222222222222', state: 'Closed', createdDate: new Date('2025-03-26T08:50:00Z'), activatedDate: new Date('2025-04-22T15:35:00Z'), closedDate: new Date('2025-05-05T14:28:00Z'), title: '[Estoque] Filho', description: 'Confirmação', assignedTo: 'Bruno', parentId: 1916409, createdAt: new Date(), updatedAt: new Date() }
    ] as any);
    const ins = vi.spyOn(repo, 'bulkInsert').mockResolvedValue(0);
    const upd = vi.spyOn(repo, 'bulkUpdateChanged').mockResolvedValue(1);

    // altera um campo do segundo item para disparar update
    const mod = JSON.parse(JSON.stringify(payload));
    mod[1].description = 'Nova desc';

    const res = await importWorkItems(mod as any);
    expect(res).toEqual({ inserted: 0, updated: 1, ignored: 1 });
    expect(ins).toHaveBeenCalledTimes(0);
    expect(upd).toHaveBeenCalledTimes(1);
  });
});


