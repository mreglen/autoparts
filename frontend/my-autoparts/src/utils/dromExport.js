export function formatDromLocalError(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err.error) return String(err.error);
  const parts = [];
  if (err.row) parts.push(`строка ${err.row}`);
  if (err.article) parts.push(`арт. ${err.article}`);
  const detail = Array.isArray(err.errors) ? err.errors.join(', ') : '';
  if (detail) parts.push(detail);
  return parts.join(': ') || JSON.stringify(err);
}

export function formatDromLocalErrors(errors, limit = 5) {
  if (!Array.isArray(errors) || errors.length === 0) return '';
  return errors
    .slice(0, limit)
    .map(formatDromLocalError)
    .filter(Boolean)
    .join('\n');
}

export function formatDromExportMessage(data) {
  const count = data?.exported_count ?? data?.items?.length ?? 0;
  const base = `Экспорт в Drom выполнен (${count} товар(ов)).`;
  if (data?.local_validation_ok === false && data?.local_errors?.length) {
    const errText = formatDromLocalErrors(data.local_errors);
    return `${base}\n\nЕсть ошибки валидации XLSX:\n${errText}\n\nСкачайте файл в настройках Drom и исправьте данные.`;
  }
  return `${base} Скачайте XLSX в «Настройки → Интеграции → Drom».`;
}
