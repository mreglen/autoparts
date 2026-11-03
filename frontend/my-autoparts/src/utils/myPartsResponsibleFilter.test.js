import { buildResponsibleFilterOptions } from './myPartsResponsibleFilter';

const cards = [
  { id: 12, user_id: 51, last_name: 'Храмцова', first_name: 'Анастасия', patronymic: 'Ивановна' },
  { id: 6, user_id: 2, last_name: 'Храмцов', first_name: 'Александр', patronymic: 'Васильевич' },
  { id: 14, user_id: null, last_name: '', first_name: 'Константин' },
  { id: 19, user_id: null, last_name: '', first_name: 'Стас (Эвакуатор)' },
];

describe('buildResponsibleFilterOptions', () => {
  it('values filter by the creator user id, not the employee card id', () => {
    const options = buildResponsibleFilterOptions(cards);
    expect(options.map((option) => option.value)).toEqual(['2', '51']);
  });

  it('skips cards that have no linked account', () => {
    const options = buildResponsibleFilterOptions(cards);
    expect(options.some((option) => option.value === '14' || option.value === '19')).toBe(false);
  });

  it('keeps one option per user and sorts labels by name', () => {
    const options = buildResponsibleFilterOptions([
      ...cards,
      { id: 33, user_id: 51, last_name: 'Храмцова', first_name: 'Анастасия', patronymic: 'Ивановна' },
    ]);
    expect(options.map((option) => option.label)).toEqual(['Храмцов А.В.', 'Храмцова А.И.']);
  });

  it('returns only the placeholder for an empty roster', () => {
    expect(buildResponsibleFilterOptions([])).toEqual([]);
    expect(buildResponsibleFilterOptions(undefined)).toEqual([]);
  });
});
