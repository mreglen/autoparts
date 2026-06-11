const TRANSLIT_MAP = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function transliterateRu(text) {
  if (!text) return '';
  return Array.from(text)
    .map((char) => {
      const lower = char.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(TRANSLIT_MAP, lower)) {
        const mapped = TRANSLIT_MAP[lower];
        if (char !== lower && mapped) {
          return mapped.length === 1 ? mapped.toUpperCase() : mapped[0].toUpperCase() + mapped.slice(1);
        }
        return mapped;
      }
      return char;
    })
    .join('');
}

function normalizeSlugText(text, preserveHyphens) {
  let result = transliterateRu(text).toLowerCase();
  result = preserveHyphens
    ? result.replace(/[^a-z0-9-]+/g, '-')
    : result.replace(/[^a-z0-9]+/g, '-');
  result = result.replace(/-{2,}/g, '-');
  return result.replace(/^-+|-+$/g, '');
}

export function slugify(text) {
  return normalizeSlugText(text, false);
}

export function slugifyBrand(text) {
  return normalizeSlugText(text, true);
}

export function isValidSlug(slug) {
  return Boolean(slug && SLUG_RE.test(slug));
}
