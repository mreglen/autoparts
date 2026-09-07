import { applyMarkup } from '../pages/AutoParts/NewParts/newPartStockUtils';

export function computeClientPrices(supplierPrice, siteMarkupPercent, clientMarkupPercent) {
  const purchasePrice = applyMarkup(supplierPrice, siteMarkupPercent);
  const clientPrice = applyMarkup(purchasePrice, clientMarkupPercent);
  return { purchasePrice, clientPrice };
}

export function isOrganizationStaff(user) {
  if (!user) return false;
  return Boolean(
    user.is_seller
    || user.is_director
    || user.is_employee
    || (user.is_admin && user.organization_id),
  );
}

export function canUseClientMarkup(user) {
  return isOrganizationStaff(user) && user?.organization_is_autoservice === true;
}

/** Названия складов Rossko — только для главной организации (директор с is_admin) и админов. */
export function canSeeRosskoWarehouseNames(user) {
  if (!user) return false;
  if (user.is_admin) return true;
  if (!user.organization_has_admin_director) return false;
  return isOrganizationStaff(user);
}
