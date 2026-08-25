import { buildStorageCellsForDisplay } from '../components/StorageCellsTable/StorageCellsDisplayTable';

describe('buildStorageCellsForDisplay', () => {
  const catalog = [
    { id: 10, name: 'Полка A1' },
    { id: 11, name: 'Полка B2' },
  ];

  it('skips empty values and resolves cell names from catalog', () => {
    const cells = buildStorageCellsForDisplay([
      { storage_cell_id: 10, value: ' 3 ' },
      { storage_cell_id: 11, value: '' },
      { storage_cell_id: 99, value: '1' },
    ], catalog);

    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({
      id: 10,
      valueFull: '3',
    });
    expect(cells[0].nameFull).toContain('Полка');
  });

  it('returns empty list when no links', () => {
    expect(buildStorageCellsForDisplay([], catalog)).toEqual([]);
    expect(buildStorageCellsForDisplay(null, catalog)).toEqual([]);
  });
});
