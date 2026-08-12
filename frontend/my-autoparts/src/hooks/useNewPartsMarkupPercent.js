import { useSelector } from 'react-redux';
import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  DEFAULT_BUYER_MARKUP_PERCENT,
  DEFAULT_SELLER_MARKUP_PERCENT,
} from '../redux/slices/PublicInfoSlice';
import {
  getSellerAutoserviceMode,
  SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
  userHasAutoserviceOrganization,
} from '../utils/sellerAutoserviceMode';

function isSellerStaff(user) {
  if (!user) return false;
  return Boolean(user.is_seller || user.is_director || user.is_employee);
}

function selectSellerStaffMarkup(user, sellerMarkup, autoserviceMarkup) {
  if (
    userHasAutoserviceOrganization(user)
    && getSellerAutoserviceMode() === SELLER_AUTOSERVICE_MODE_AUTOSERVICE
  ) {
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

  if (context === 'public' || context === 'buyer') {
    return buyerMarkup;
  }

  if (context === 'autoservice') {
    return autoserviceMarkup;
  }

  if (context === 'seller') {
    if (adminCtx?.markupPercent != null) {
      return adminCtx.markupPercent;
    }
    if (isSellerStaff(user) && user.organization_id) {
      return selectSellerStaffMarkup(user, sellerMarkup, autoserviceMarkup);
    }
    return sellerMarkup;
  }

  // auto: публичный каталог — buyer; staff организации — seller/autoservice
  if (adminCtx?.markupPercent != null) {
    return adminCtx.markupPercent;
  }

  if (isSellerStaff(user) && user.organization_id) {
    return selectSellerStaffMarkup(user, sellerMarkup, autoserviceMarkup);
  }

  return buyerMarkup;
}

export default useNewPartsMarkupPercent;
