import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  apiGet,
  apiSend,
  bootstrapAccessToken,
  onSessionExpired,
  setAccessToken,
  type SessionEndReason,
} from "../api/client";
import { queryClient } from "../api/queryClient";
import { describeError } from "../api/errors";
import { deviceInfo } from "../app/appIdentity";
import { readJson, writeJson } from "../storage/kv";
import { LAST_LOGIN_KEY } from "../storage/keys";
import { clearTokens, readTokens, saveTokens } from "./tokenStore";

export type SessionStatus = "loading" | "signedOut" | "signedIn";
export type SessionNotice = "rights" | "expired" | null;

export interface SessionUser {
  email: string;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isDirector: boolean;
  isSeller: boolean;
  isEmployee: boolean;
  canSeeRosskoSalesReport: boolean;
}

interface SessionContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  notice: SessionNotice;
  lastLogin: string;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearNotice: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: {
    email?: string;
    must_change_password?: boolean;
    is_admin?: boolean;
    is_director?: boolean;
    is_seller?: boolean;
    is_employee?: boolean;
    can_see_rossko_sales_report?: boolean;
  } | null;
}

interface ProfileResponse {
  email?: string;
  must_change_password?: boolean;
  is_admin?: boolean;
  is_director?: boolean;
  is_seller?: boolean;
  is_employee?: boolean;
  can_see_rossko_sales_report?: boolean;
}

function toSessionUser(
  profile: ProfileResponse | null | undefined,
): SessionUser | null {
  if (!profile?.email) return null;
  return {
    email: profile.email,
    mustChangePassword: Boolean(profile.must_change_password),
    isAdmin: Boolean(profile.is_admin),
    isDirector: Boolean(profile.is_director),
    isSeller: Boolean(profile.is_seller),
    isEmployee: Boolean(profile.is_employee),
    canSeeRosskoSalesReport: Boolean(profile.can_see_rossko_sales_report),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [notice, setNotice] = useState<SessionNotice>(null);
  const [lastLogin, setLastLogin] = useState("");

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiGet<ProfileResponse>("/auth/profile");
      setUser(toSessionUser(profile));
    } catch {
      // Сеть/сервер недоступны — остаёмся в текущем состоянии.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [tokens, savedLogin] = await Promise.all([
        readTokens(),
        readJson<string>(LAST_LOGIN_KEY, ""),
      ]);
      if (!alive) return;
      setLastLogin(savedLogin);
      await bootstrapAccessToken();
      if (!alive) return;
      if (tokens.access) {
        setStatus("signedIn");
        // Профиль догружаем отдельно: при офлайне вход всё равно сохраняется.
        void refreshProfile();
      } else {
        setStatus("signedOut");
      }
    })();
    const unsubscribe = onSessionExpired((reason: SessionEndReason) => {
      setUser(null);
      setNotice(reason === "session" ? "rights" : "expired");
      setStatus("signedOut");
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(async (login: string, password: string) => {
    const trimmed = login.trim();
    const data = await apiSend<LoginResponse>("POST", "/auth/login", {
      form: {
        username: trimmed,
        password,
        user_agent: "sg-autoservice-mobile",
        device_info: deviceInfo(),
      },
      auth: false,
      retryOnUnauthorized: false,
    });
    await saveTokens({
      access: data.access_token,
      refresh: data.refresh_token,
    });
    setAccessToken(data.access_token);
    queryClient.clear();
    setUser(toSessionUser(data.user));
    setNotice(null);
    setStatus("signedIn");
    void writeJson(LAST_LOGIN_KEY, trimmed);
    setLastLogin(trimmed);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiSend("POST", "/auth/logout", {
        auth: true,
        retryOnUnauthorized: false,
      });
    } catch {
      // Выход локальный в любом случае: токены стираем и на ошибке сети.
    }
    await clearTokens();
    setAccessToken(null);
    queryClient.clear();
    setUser(null);
    setNotice(null);
    setStatus("signedOut");
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiSend("POST", "/auth/change-password", {
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
    },
    [],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      notice,
      lastLogin,
      signIn,
      signOut,
      changePassword,
      refreshProfile,
      clearNotice,
    }),
    [
      status,
      user,
      notice,
      lastLogin,
      signIn,
      signOut,
      changePassword,
      refreshProfile,
      clearNotice,
    ],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession вне SessionProvider");
  return ctx;
}

export { describeError };
