const formatResponsibleLabel = (person) => {
  if (!person) return '';
  const initials = person.first_name ? `${person.first_name[0]}.` : '';
  const patronymic = person.patronymic ? `${person.patronymic[0]}.` : '';
  return `${person.last_name || ''} ${initials}${patronymic}`.trim();
};

// created_by у запчасти — id пользователя, а карточка сотрудника (organization_employees.id) живёт в своей нумерации.
export function buildResponsibleFilterOptions(employees) {
  const byUser = new Map();
  (employees || []).forEach((person) => {
    if (!person.user_id || byUser.has(person.user_id)) return;
    byUser.set(person.user_id, person);
  });

  return [...byUser.values()]
    .sort((a, b) => formatResponsibleLabel(a).localeCompare(formatResponsibleLabel(b), 'ru'))
    .map((person) => ({ value: String(person.user_id), label: formatResponsibleLabel(person) }));
}
