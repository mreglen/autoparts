import { apiRequest } from './apiClient';

export const PERSON_TYPES = [
  { id: 'individual', label: 'Физлицо' },
  { id: 'ie', label: 'ИП' },
  { id: 'legal', label: 'Юрлицо' },
];

export const CLIENT_PLACEHOLDERS = {
  name: 'Иванов Иван Иванович',
  phone: '+7 (___) ___-__-__',
  legal_name: 'ООО «Ромашка»',
  legal_name_ie: 'ИП Иванов Иван Иванович',
  address: 'г. Москва, ул. Ленина, д. 1',
  inn_individual: '12 цифр',
  inn_legal: '10 цифр',
  kpp: '9 цифр',
  ogrn: '13 цифр',
  ogrnip: '15 цифр',
};

const REQUISITE_KEYS = ['name', 'phone', 'person_type', 'legal_name', 'address', 'inn', 'kpp', 'ogrn'];

export function normalizePersonType(value) {
  if (value === 'ie' || value === 'legal') return value;
  return 'individual';
}

export function personTypeLabel(value) {
  const type = normalizePersonType(value);
  return PERSON_TYPES.find((item) => item.id === type)?.label || 'Физлицо';
}

export function isGuestClient(client) {
  return Boolean(client) && !client.user_id;
}

export function emptyClientRequisites(client) {
  return {
    name: client?.name || '',
    phone: client?.phone || '',
    person_type: normalizePersonType(client?.person_type),
    legal_name: client?.legal_name || '',
    address: client?.address || '',
    inn: client?.inn || '',
    kpp: client?.kpp || '',
    ogrn: client?.ogrn || '',
  };
}

export function clientBuyerName(client) {
  const type = normalizePersonType(client?.person_type);
  const name = String(client?.name || '').trim();
  const legal = String(client?.legal_name || '').trim();
  if (type === 'legal') return legal || name;
  if (type === 'ie') return legal || (name ? `ИП ${name}` : '');
  return name;
}

export function clientToBuyerFields(client) {
  const type = normalizePersonType(client?.person_type);
  return {
    buyerName: clientBuyerName(client),
    buyerAddress: String(client?.address || '').trim(),
    buyerInn: String(client?.inn || '').trim(),
    buyerKpp: type === 'legal' ? String(client?.kpp || '').trim() : '',
  };
}

export function clientToOrderCustomer(client) {
  return {
    clientName: clientBuyerName(client) || String(client?.name || '').trim(),
    clientPhone: String(client?.phone || '').trim(),
  };
}

export function clientRequisitesPatchPayload(form, { isGuest } = {}) {
  const personType = normalizePersonType(form?.person_type);
  const payload = {
    person_type: personType,
    legal_name: String(form?.legal_name || '').trim() || null,
    address: String(form?.address || '').trim() || null,
    inn: String(form?.inn || '').trim() || null,
    kpp: personType === 'legal' ? String(form?.kpp || '').trim() || null : null,
    ogrn: personType === 'individual' ? null : String(form?.ogrn || '').trim() || null,
  };
  if (isGuest) {
    payload.name = String(form?.name || '').trim();
    payload.phone = form?.phone || '';
  }
  return payload;
}

export function clientRequisitesChanged(a, b) {
  return REQUISITE_KEYS.some(
    (key) => String(a?.[key] || '').trim() !== String(b?.[key] || '').trim(),
  );
}

export function mergeLegacyBuyerIntoClient(client, buyer) {
  if (!client || !buyer) return client;
  const next = { ...client };
  if (!String(next.address || '').trim() && buyer.address) next.address = buyer.address;
  if (!String(next.inn || '').trim() && buyer.inn) next.inn = buyer.inn;
  if (!String(next.kpp || '').trim() && buyer.kpp) {
    next.kpp = buyer.kpp;
    if (normalizePersonType(next.person_type) === 'individual') {
      next.person_type = 'legal';
    }
  }
  const buyerName = String(buyer.name || '').trim();
  if (
    buyerName &&
    buyerName.toLowerCase() !== String(next.name || '').trim().toLowerCase() &&
    !String(next.legal_name || '').trim()
  ) {
    next.legal_name = buyerName;
  }
  return next;
}

export function findLegacyBuyerForClient(client, buyers) {
  const name = String(client?.name || '').trim().toLowerCase();
  const legal = String(client?.legal_name || '').trim().toLowerCase();
  if (!Array.isArray(buyers) || (!name && !legal)) return null;
  return (
    buyers.find((row) => {
      const rowName = String(row?.name || '').trim().toLowerCase();
      return rowName && (rowName === name || (legal && rowName === legal));
    }) || null
  );
}

export async function saveAutoserviceClientRequisites(clientId, form, { isGuest } = {}) {
  return apiRequest(`/autoservice/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(clientRequisitesPatchPayload(form, { isGuest })),
  });
}

export async function resolveClientForDocuments(orderClient) {
  if (!orderClient?.id) return orderClient || null;
  const hasRequisites =
    Boolean(String(orderClient.address || '').trim()) || Boolean(String(orderClient.inn || '').trim());
  if (hasRequisites) return orderClient;
  try {
    const buyers = await apiRequest('/autoservice/document-buyers').catch(() => []);
    const matched = findLegacyBuyerForClient(orderClient, buyers);
    if (!matched) return orderClient;
    const merged = mergeLegacyBuyerIntoClient(orderClient, matched);
    if (!clientRequisitesChanged(emptyClientRequisites(merged), emptyClientRequisites(orderClient))) {
      return orderClient;
    }
    try {
      return await saveAutoserviceClientRequisites(
        orderClient.id,
        emptyClientRequisites(merged),
        { isGuest: isGuestClient(orderClient) },
      );
    } catch {
      return merged;
    }
  } catch {
    return orderClient;
  }
}
