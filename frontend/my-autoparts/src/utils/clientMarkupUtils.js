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
