import {
  clearRepairOrderFormDraft,
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
    expect(repairOrderFormCacheKey('edit', 42)).toBe('sg:repair-order-form:edit:42');
  });

  it('detects meaningful form snapshots', () => {
    expect(repairOrderFormSnapshotHasContent({ works: [], clientParts: [] })).toBe(false);
    expect(repairOrderFormSnapshotHasContent({ clientId: '5' })).toBe(true);
    expect(repairOrderFormSnapshotHasContent({ works: [{ title: 'Oil change' }] })).toBe(true);
  });

  it('writes, reads and clears drafts', () => {
    const snapshot = { clientId: '1', works: [{ title: 'Brakes' }] };
    writeRepairOrderFormDraft('create', null, snapshot);
    const cached = readRepairOrderFormDraft('create');
    expect(cached.form.clientId).toBe('1');
    expect(cached.savedAt).toEqual(expect.any(Number));
    clearRepairOrderFormDraft('create');
    expect(readRepairOrderFormDraft('create')).toBeNull();
  });
});
