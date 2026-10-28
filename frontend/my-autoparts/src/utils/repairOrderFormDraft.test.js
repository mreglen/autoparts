import {
  clearRepairOrderFormDraft,
  listRepairOrderFormDrafts,
  newRepairOrderDraftToken,
  readRepairOrderFormDraft,
  repairOrderFormCacheKey,
  repairOrderFormSnapshotHasContent,
  writeRepairOrderFormDraft,
} from './repairOrderFormDraft';

describe('repairOrderFormDraft', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('builds stable cache keys', () => {
    expect(repairOrderFormCacheKey('create')).toBe('sg:repair-order-form:create');
    expect(repairOrderFormCacheKey('create', null, 'tok1')).toBe('sg:repair-order-form:create:tok1');
    expect(repairOrderFormCacheKey('edit', 42)).toBe('sg:repair-order-form:edit:42');
  });

  it('detects meaningful form snapshots', () => {
    expect(repairOrderFormSnapshotHasContent({ works: [], clientParts: [] })).toBe(false);
    expect(repairOrderFormSnapshotHasContent({ clientId: '5' })).toBe(true);
    expect(repairOrderFormSnapshotHasContent({ works: [{ title: 'Oil change' }] })).toBe(true);
  });

  it('writes, reads and clears drafts', () => {
    const snapshot = { clientId: '1', works: [{ title: 'Brakes' }] };
    writeRepairOrderFormDraft('create', null, 'tok2', snapshot);
    const cached = readRepairOrderFormDraft('create', null, 'tok2');
    expect(cached.form.clientId).toBe('1');
    expect(cached.savedAt).toEqual(expect.any(Number));
    clearRepairOrderFormDraft('create', null, 'tok2');
    expect(readRepairOrderFormDraft('create', null, 'tok2')).toBeNull();
  });

  it('keeps every new-order draft in its own slot', () => {
    writeRepairOrderFormDraft('create', null, newRepairOrderDraftToken(), { clientId: '11' });
    writeRepairOrderFormDraft('create', null, newRepairOrderDraftToken(), { clientId: '22' });

    expect(readRepairOrderFormDraft('create', null, 'fresh-slot')).toBeNull();

    const drafts = listRepairOrderFormDrafts();
    expect(drafts).toHaveLength(2);
    expect(new Set(drafts.map((draft) => draft.createToken)).size).toBe(2);
    expect(drafts.map((draft) => draft.form.clientId).sort()).toEqual(['11', '22']);
    drafts.forEach((draft) => {
      expect(draft.mode).toBe('create');
      expect(draft.createToken).toBeTruthy();
      clearRepairOrderFormDraft(draft.mode, draft.orderId, draft.createToken);
    });
    expect(listRepairOrderFormDrafts()).toHaveLength(0);
  });

  it('reads the legacy shared slot as a tokenless draft', () => {
    sessionStorage.setItem(
      'sg:repair-order-form:create',
      JSON.stringify({ form: { clientId: '7' }, savedAt: 1 }),
    );

    const [draft] = listRepairOrderFormDrafts();
    expect(draft.mode).toBe('create');
    expect(draft.createToken).toBe('');
    expect(readRepairOrderFormDraft('create', null, null).form.clientId).toBe('7');
  });
});
