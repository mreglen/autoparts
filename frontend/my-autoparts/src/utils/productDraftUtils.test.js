import {
  clearPartFormSessionCache,
  partFormCacheKey,
  partFormSnapshotHasContent,
  readPartFormSessionCache,
  writePartFormSessionCache,
} from './productDraftUtils';

describe('productDraftUtils part-form cache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('builds stable cache keys per mode and id', () => {
    expect(partFormCacheKey('edit', 42)).toBe('sg:part-form:edit:42');
    expect(partFormCacheKey('pending', '7')).toBe('sg:part-form:pending:7');
    expect(partFormCacheKey('add', null)).toBe('sg:part-form:add:new');
  });

  it('writes and reads session cache snapshots', () => {
    const snapshot = {
      formData: { article: 'ABC', name: 'Filter', brand: 'OEM' },
      cellQuantities: { 1: '2' },
    };
    writePartFormSessionCache('edit', 5, snapshot);
    const cached = readPartFormSessionCache('edit', 5);
    expect(cached.formData.article).toBe('ABC');
    expect(cached.savedAt).toEqual(expect.any(Number));
  });

  it('detects content from cellValues alias used in EditPart', () => {
    expect(partFormSnapshotHasContent({
      formData: {},
      cellValues: { 3: '1' },
    })).toBe(true);
  });

  it('clears cache entry', () => {
    writePartFormSessionCache('resubmit', 9, {
      formData: { article: 'X' },
    });
    clearPartFormSessionCache('resubmit', 9);
    expect(readPartFormSessionCache('resubmit', 9)).toBeNull();
  });
});
