/** Публичные страницы профиля (без конфликта с /sellers в кабинете). */

export function getSellerProfilePath(publicCode) {
  const code = (publicCode || '').trim().toUpperCase();
  return code ? `/seller/${encodeURIComponent(code)}` : null;
}

export function getBuyerProfilePath(publicCode) {
  const code = (publicCode || '').trim().toUpperCase();
  return code ? `/buyer/${encodeURIComponent(code)}` : null;
}

export function getProfilePathForParticipant(participant) {
  if (!participant?.public_code) return null;
  if (participant.is_seller) return getSellerProfilePath(participant.public_code);
  if (participant.is_buyer) return getBuyerProfilePath(participant.public_code);
  return null;
}

/** Ссылка на собеседника в личном чате гаража. */
export function getGarageCounterpartyProfilePath(chat, currentUserId) {
  if (!chat || !currentUserId) return null;
  const iAmSeller = Number(chat.seller_id) === Number(currentUserId);
  if (iAmSeller && chat.buyer_public_code) {
    return getBuyerProfilePath(chat.buyer_public_code);
  }
  if (!iAmSeller && chat.seller_public_code) {
    return getSellerProfilePath(chat.seller_public_code);
  }
  return null;
}
