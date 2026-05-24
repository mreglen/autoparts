export function canUseAvitoProFeatures(status) {
  return Boolean(status?.integration_enabled && status?.pro_active !== false);
}

export function shouldShowAvitoProExpiredBanner(status) {
  return Boolean(
    status?.credentials_configured
    && status?.integration_enabled
    && status?.pro_active === false
  );
}
