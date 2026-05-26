/** Публичные страницы профиля участников и чатов. */

export function getUserProfilePath(publicCode) {
  const raw = (publicCode || '').trim();
  if (!raw) return null;
  const code = /^[A-Za-z]/.test(raw) ? raw.toUpperCase() : raw;
  return `/users/${encodeURIComponent(code)}`;
}

/** @deprecated Используйте getUserProfilePath */
export function getSellerProfilePath(publicCode) {
  return getUserProfilePath(publicCode);
}

/** @deprecated Используйте getUserProfilePath */
export function getBuyerProfilePath(publicCode) {
  return getUserProfilePath(publicCode);
}

export function getProfilePathForParticipant(participant) {
  return getUserProfilePath(participant?.public_code);
}

/** Ссылка на собеседника в личном чате гаража. */
export function getGarageCounterpartyProfilePath(chat, currentUserId) {
  if (!chat || !currentUserId) return null;
  const iAmSeller = Number(chat.seller_id) === Number(currentUserId);
  const code = iAmSeller ? chat.buyer_public_code : chat.seller_public_code;
  return getUserProfilePath(code);
}
