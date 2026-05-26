function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeArticle(value) {
  if (!value) return '';
  return String(value).replace(/[^A-Za-z0-9А-Яа-яЁё]/gi, '').toUpperCase();
}

function stripLeadingArticle(text, article) {
  let result = String(text || '').trim();
  const articleStr = String(article || '').trim();
  if (!result || !articleStr) return result;

  const articleNorm = normalizeArticle(articleStr);
  const exactRe = new RegExp(`^${escapeRegex(articleStr)}(?:\\s+|$)`, 'i');
  result = result.replace(exactRe, '').trim();

  const firstToken = result.split(/\s+/)[0] || '';
  if (articleNorm && normalizeArticle(firstToken) === articleNorm) {
    result = result.split(/\s+/).slice(1).join(' ').trim();
  }

  return result;
}

function stripLeadingBrand(text, brand) {
  const brandStr = String(brand || '').trim();
  if (!text || !brandStr) return String(text || '').trim();

  const brandRe = new RegExp(`^${escapeRegex(brandStr)}\\s+`, 'i');
  return String(text).replace(brandRe, '').trim();
}

/**
 * Извлекает описание без категории, бренда и артикула (формат Rossko: «Категория BRAND / ARTICLE Описание»).
 */
export function extractProductDescription(rawName, brand, article) {
  let name = String(rawName || '').trim();
  if (!name) return '';

  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();

  const slashParts = name.split('/').map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    const afterSlash = slashParts.slice(1).join(' / ').trim();
    const words = afterSlash.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const withoutLeadingArticle = stripLeadingArticle(afterSlash, articleStr);
      if (withoutLeadingArticle) return withoutLeadingArticle;
      return words.slice(1).join(' ').trim();
    }
    return stripLeadingArticle(afterSlash, articleStr);
  }

  if (brandStr) {
    const brandSuffixRe = new RegExp(`^(?:.+?\\s+)?${escapeRegex(brandStr)}\\s*`, 'i');
    name = name.replace(brandSuffixRe, '').trim();
  }

  name = stripLeadingArticle(name, articleStr);
  name = stripLeadingBrand(name, brandStr);
  name = stripLeadingArticle(name, articleStr);

  return name.trim();
}

/**
 * Заголовок товара: «Бренд Артикул Название».
 */
export function formatProductDisplayTitle(brand, article, rawName) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  const raw = String(rawName || '').trim();

  if (!brandStr && !articleStr) {
    return raw || '—';
  }

  const description =
    extractProductDescription(raw, brandStr, articleStr) || raw;

  const parts = [brandStr, articleStr, description].filter(Boolean);
  const formatted = parts.join(' ').replace(/\s+/g, ' ').trim();

  return formatted || '—';
}
