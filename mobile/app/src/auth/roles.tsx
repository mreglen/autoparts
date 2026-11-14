import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMyClientOrgs, type MyClientOrg } from "../api/clientAccount";
import { ACTIVE_ROLE_KEY } from "../storage/keys";
import { readJson, writeJson } from "../storage/kv";
import { hasAnyPermission } from "./access";
import { currentPermissionCodes } from "./permissions";
import { useSession } from "./session";

export type AppRole = "staff" | "client";

interface RoleContextValue {
  canUseStaff: boolean;
  canUseClient: boolean;
  /** Клиентские организации догружены — роли можно считать финальными. */
  rolesReady: boolean;
  clientOrgs: MyClientOrg[];
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
  refreshClientOrgs: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const [clientOrgs, setClientOrgs] = useState<MyClientOrg[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [storedRole, setStoredRole] = useState<AppRole | null>(null);

  const refreshClientOrgs = useCallback(async () => {
    try {
      const result = await fetchMyClientOrgs();
      setClientOrgs(result.data ?? []);
    } catch {
      // Нет сети/ошибка — считаем, что клиентских карточек нет;
      // при офлайне кэш вернёт данные через cachedGet.
      setClientOrgs([]);
    } finally {
      setOrgsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (status !== "signedIn") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при выходе
      setClientOrgs([]);
      setOrgsLoaded(false);
      setStoredRole(null);
      return;
    }
    void (async () => {
      const saved = await readJson<AppRole | null>(ACTIVE_ROLE_KEY, null);
      setStoredRole(
        saved === "client" ? "client" : saved === "staff" ? "staff" : null,
      );
    })();
    void refreshClientOrgs();
  }, [status, refreshClientOrgs]);

  const canUseStaff = Boolean(
    user && hasAnyPermission(user, currentPermissionCodes()),
  );
  const canUseClient = clientOrgs.length > 0;

  const activeRole: AppRole = useMemo(() => {
    if (storedRole === "client" && canUseClient) return "client";
    if (storedRole === "staff" && canUseStaff) return "staff";
    if (canUseStaff) return "staff";
    if (canUseClient) return "client";
    return "staff";
  }, [storedRole, canUseStaff, canUseClient]);

  const setActiveRole = useCallback((role: AppRole) => {
    setStoredRole(role);
    void writeJson(ACTIVE_ROLE_KEY, role);
  }, []);

  const value = useMemo(
    () => ({
      canUseStaff,
      canUseClient,
      rolesReady: orgsLoaded,
      clientOrgs,
      activeRole,
      setActiveRole,
      refreshClientOrgs,
    }),
    [
      canUseStaff,
      canUseClient,
      orgsLoaded,
      clientOrgs,
      activeRole,
      setActiveRole,
      refreshClientOrgs,
    ],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAppRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useAppRole вне RoleProvider");
  return ctx;
}
