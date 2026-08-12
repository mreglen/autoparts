import { useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  DEFAULT_BUYER_MARKUP_PERCENT,
  DEFAULT_SELLER_MARKUP_PERCENT,
} from '../redux/slices/PublicInfoSlice';
import {
  getSellerAutoserviceMode,
  SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
  SELLER_AUTOSERVICE_MODE_SELLER,
  subscribeSellerAutoserviceMode,
  userHasAutoserviceOrganization,
} from '../utils/sellerAutoserviceMode';

function isSellerStaff(user) {
  if (!user) return false;
  return Boolean(user.is_seller || user.is_director || user.is_employee);
}

function selectSellerStaffMarkup(user, mode, sellerMarkup, autoserviceMarkup) {
  if (userHasAutoserviceOrganization(user) && mode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE) {
    return autoserviceMarkup;
  }
  return sellerMarkup;
}

/**
 * Контекст наценки для новых запчастей Rossko:
 * - public: только наценка покупателя (публичный каталог)
 * - seller: наценка продавца (кабинет продавца)
 * - autoservice: наценка автосервиса (заказ-наряды)
 * - auto: buyer для гостей; seller/autoservice для staff организации
 */
export function useNewPartsMarkupPercent(context = 'auto') {
  const user = useSelector((state) => state.auth.user);
  const buyerMarkup = useSelector(
    (state) => state.publicInfo.newPartsMarkupPercent ?? DEFAULT_BUYER_MARKUP_PERCENT,
  );
  const sellerMarkup = useSelector(
    (state) => state.publicInfo.sellerMarkupPercent ?? DEFAULT_SELLER_MARKUP_PERCENT,
  );
  const autoserviceMarkup = useSelector(
    (state) => state.publicInfo.autoserviceMarkupPercent ?? DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  );
  const adminCtx = useSelector((state) => state.publicInfo.adminSellerMarkupContext);
  const sellerAutoserviceMode = useSyncExternalStore(
    subscribeSellerAutoserviceMode,
    getSellerAutoserviceMode,
    () => SELLER_AUTOSERVICE_MODE_SELLER,
  );

  if (context === 'public' || context === 'buyer') {
    return buyerMarkup;
  }

  if (context === 'autoservice') {
    return autoserviceMarkup;
  }

  if (adminCtx?.markupPercent != null) {
    return adminCtx.markupPercent;
  }

  if (isSellerStaff(user) && user.organization_id) {
    return selectSellerStaffMarkup(user, sellerAutoserviceMode, sellerMarkup, autoserviceMarkup);
  }

  // seller: наценка продавца даже вне организации; auto: публичный каталог — buyer
  return context === 'seller' ? sellerMarkup : buyerMarkup;
}

export default useNewPartsMarkupPercent;
