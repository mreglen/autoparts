function normalizeComparable(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function formatBrandDisplayName(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';

  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) {
    return text;
  }

  return text
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      if (word.length <= 4 && word === word.toUpperCase() && /^[A-Z0-9]+$/.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function wizardCatalogDisplayLabel(catalog) {
  const brand = String(catalog?.brand || '').trim();
  const name = String(catalog?.name || '').trim();
  const code = String(catalog?.code || '').trim();

  if (brand && name && normalizeComparable(brand) === normalizeComparable(name)) {
    return formatBrandDisplayName(name);
  }
  if (name) return formatBrandDisplayName(name);
  if (brand) return formatBrandDisplayName(brand);
  return code;
}

export function buildWizardCatalogSelectOptions(catalogs) {
  return (catalogs || [])
    .map((catalog) => {
      const label = wizardCatalogDisplayLabel(catalog);
      const brand = String(catalog?.brand || '').trim();
      const name = String(catalog?.name || '').trim();
      const code = String(catalog?.code || '').trim();
      return {
        value: code,
        label,
        searchText: [label, brand, name, code].filter(Boolean).join(' ').toLowerCase(),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}
