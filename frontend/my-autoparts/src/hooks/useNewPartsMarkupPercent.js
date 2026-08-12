import { useSelector } from 'react-redux';
import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  DEFAULT_BUYER_MARKUP_PERCENT,
  DEFAULT_SELLER_MARKUP_PERCENT,
} from '../redux/slices/PublicInfoSlice';
import { userHasAutoserviceOrganization } from '../utils/sellerAutoserviceMode';

function isOrganizationStaff(user) {
  if (!user) return false;
  return Boolean(user.is_seller || user.is_director || user.is_employee || user.is_admin);
}

function markupForTier(tier, { buyerMarkup, sellerMarkup, autoserviceMarkup }) {
  if (tier === 'buyer') return buyerMarkup;
  if (tier === 'autoservice') return autoserviceMarkup;
  if (tier === 'seller') return sellerMarkup;
  return null;
}

/**
 * Контекст наценки для новых запчастей Rossko:
 * - public / buyer: наценка покупателя (публичный каталог)
 * - autoservice: наценка автосервиса (заказ-наряды)
 * - seller: наценка продавца
 * - auto: по организации пользователя — индивидуальная > автосервис > продавец > покупатель
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

  const tierMarkups = { buyerMarkup, sellerMarkup, autoserviceMarkup };

  if (context === 'public' || context === 'buyer') {
    return buyerMarkup;
  }

  if (context === 'autoservice') {
    return autoserviceMarkup;
  }

  const tierOverride = user?.organization_new_parts_markup_tier;
  if (tierOverride) {
    const overridePercent = markupForTier(tierOverride, tierMarkups);
    if (overridePercent != null) {
      return overridePercent;
    }
  }

  if (userHasAutoserviceOrganization(user)) {
    return autoserviceMarkup;
  }

  if (adminCtx?.markupPercent != null) {
    return adminCtx.markupPercent;
  }

  if (context === 'seller' || (isOrganizationStaff(user) && user.organization_id)) {
    return sellerMarkup;
  }

  return buyerMarkup;
}

export default useNewPartsMarkupPercent;
