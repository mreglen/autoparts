export const SETTINGS_INTEGRATION_AVITO_PERMISSION = 'settings.integration.avito';

export function canAccessAvitoIntegration(user, permissionCodes) {
  const hasPermission = (code) => permissionCodes?.includes(code);
  return (
    user?.is_admin ||
    user?.is_director ||
    user?.is_seller ||
    (user?.is_employee && hasPermission(SETTINGS_INTEGRATION_AVITO_PERMISSION))
  );
}
