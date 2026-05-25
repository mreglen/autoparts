import { normalizeImageUrl } from '../../utils/apiClient';

export function formatOrganizationPhone(value) {
  if (!value) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7') && digits.length === 10) digits = `7${digits}`;
  if (digits.length < 11) return value;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

export function getOrganizationInitials(name) {
  if (!name) return 'ОР';
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
}

export function getOrganizationLogoUrl(logoPath) {
  return logoPath ? normalizeImageUrl(logoPath) : null;
}

export function getOrganizationDisplayName(name) {
  return (name || '').trim() || 'Организация без названия';
}
