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

/**
 * Контекст наценки для новых запчастей Rossko:
 * - public / buyer: наценка покупателя (публичный каталог)
 * - autoservice: наценка автосервиса (заказ-наряды)
 * - seller: наценка продавца
 * - auto: по организации пользователя — автосервис > продавец > покупатель
 *
 * Организация с активным тарифом «Автосервис» получает наценку автосервиса везде,
 * независимо от режима меню «Продавец/Автосервис». На паузе backend снимает флаг
 * organization_is_autoservice, и наценка возвращается к продавцу.
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
