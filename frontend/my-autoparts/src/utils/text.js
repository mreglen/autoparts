export const stripHtmlTags = (value) => {
  if (value == null) return '';

  const text = String(value)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .trim();

  return text;
};
