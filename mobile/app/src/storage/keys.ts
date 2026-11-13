/** Имена ключей совпадают с веб-версией (`pageFilterStorage.js`, `repairOrderFormDraft.js`),
 * чтобы поведение фильтров и черновиков было одинаковым на обоих клиентах. */

export function pageFiltersKey(page: string): string {
  return `sgPageFilters:${page}`;
}

export function repairOrderDraftKey(
  mode: "create" | "edit",
  orderId?: number | string | null,
  draftToken?: string,
): string {
  const id =
    orderId === null || orderId === undefined || orderId === ""
      ? "new"
      : String(orderId);
  return `sg:repair-order-form:${mode}:${id}${draftToken ? `:${draftToken}` : ""}`;
}

export const TOKEN_KEYS = {
  access: "sg:auth:access-token",
  refresh: "sg:auth:refresh-token",
} as const;

export const META_CACHE_KEY = "sg:mobile-meta";

export const LAST_LOGIN_KEY = "sg:last-login";

export const THEME_MODE_KEY = "sg:theme-mode";
