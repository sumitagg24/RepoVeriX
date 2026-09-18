"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, apiErrorCode, getToken, setToken } from "@/services/api";
import type { TokenResponse, UserRead } from "@/types/api";
import { apiErrorMessage } from "@/lib/utils";

export interface PendingVerification {
  email: string;
  /** Console-mail dev shortcut (local dev only — never present with SMTP). */
  devUrl: string | null;
}

interface AuthState {
  user: UserRead | null;
  loading: boolean;
  error: string | null;
  pendingVerification: PendingVerification | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  verifyEmail: (uid: string, token: string) => Promise<string>;
  resendVerification: (email: string) => Promise<PendingVerification>;
}

const AuthContext = createContext<AuthState | null>(null);

function toPending(email: string, devUrl?: string | null): PendingVerification {
  return { email, devUrl: devUrl ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<UserRead>("/auth/me");
      setUser(res.data);
      setError(null);
    } catch (e) {
      setToken(null);
      setUser(null);
      setError(apiErrorMessage(e, "Session expired"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goVerify = useCallback(
    (pending: PendingVerification) => {
      // Preserve a console-mail dev shortcut already captured for the same
      // mailbox (e.g. from the signup response) when the new state has none.
      setPendingVerification((prev) =>
        prev &&
        prev.email.toLowerCase() === pending.email.toLowerCase() &&
        prev.devUrl &&
        !pending.devUrl
          ? prev
          : pending,
      );
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(pending.email)}`,
      );
    },
    [router],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<TokenResponse>("/auth/login", {
          email,
          password,
        });
        setToken(res.data.access_token);
        const me = await api.get<UserRead>("/auth/me");
        setUser(me.data);
        setPendingVerification(null);
        router.push("/dashboard");
      } catch (e) {
        // Unverified mailbox: the backend blocks login with 403 +
        // X-Error-Code: EMAIL_NOT_VERIFIED. The header needs CORS exposure
        // (older servers may hide it), so also match the stable copy.
        const status = (e as { response?: { status?: number } })?.response
          ?.status;
        const msg = apiErrorMessage(e, "");
        const unverified =
          apiErrorCode(e) === "EMAIL_NOT_VERIFIED" ||
          (status === 403 && /verify your email/i.test(msg));
        if (unverified) {
          // Account exists but the mailbox isn't confirmed — the backend
          // blocks login until verification. Route to the verify screen.
          goVerify(toPending(email.trim()));
          throw new Error("Please verify your email before continuing.");
        }
        setError(apiErrorMessage(e, "Login failed"));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [router, goVerify],
  );

  const signup = useCallback(
    async (fullName: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      let routed = false;
      try {
        const res = await api.post<TokenResponse>("/auth/signup", {
          full_name: fullName,
          email,
          password,
        });
        // Signup succeeds but the account starts unverified. When the
        // deployment enforces verification, login would 403 — go straight
        // to the verify screen instead. Otherwise finish signing in.
        if (res.data.email_verified) {
          setToken(res.data.access_token);
          const me = await api.get<UserRead>("/auth/me");
          setUser(me.data);
          router.push("/dashboard");
          routed = true;
          return;
        }
        // Keep the console-mail dev shortcut when the backend provides one.
        if (res.data.dev_verification_url) {
          setPendingVerification(
            toPending(email.trim(), res.data.dev_verification_url),
          );
        }
        try {
          await login(email, password);
          routed = true;
        } catch (loginErr) {
          const loginMsg = apiErrorMessage(loginErr, "");
          if (
            apiErrorCode(loginErr) === "EMAIL_NOT_VERIFIED" ||
            /verify your email/i.test(loginMsg)
          ) {
            // login() already routed to the verify screen.
            routed = true;
            return;
          }
          // Account created but sign-in failed for another reason (e.g.
          // rate limit) — send to login with the account ready.
          router.push(
            `/auth/login?email=${encodeURIComponent(email.trim())}&created=1`,
          );
          routed = true;
          throw new Error("Account created. Please log in to continue.");
        }
      } catch (e) {
        // login()/navigation paths handle themselves; surface real failures.
        if (!routed) {
          setError(apiErrorMessage(e, "Signup failed"));
        }
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [router, login],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setPendingVerification(null);
    router.push("/");
  }, [router]);

  const verifyEmail = useCallback(async (uid: string, token: string) => {
    const res = await api.post<{ detail: string }>("/auth/verify-email", {
      uid,
      token,
    });
    setPendingVerification(null);
    return res.data.detail || "Your email is verified.";
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const res = await api.post<{ detail: string; dev_verification_url?: string }>(
      "/auth/resend-verification",
      { email },
    );
    const pending = toPending(email.trim(), res.data.dev_verification_url);
    setPendingVerification(pending);
    return pending;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      pendingVerification,
      login,
      signup,
      logout,
      refresh,
      verifyEmail,
      resendVerification,
    }),
    [
      user,
      loading,
      error,
      pendingVerification,
      login,
      signup,
      logout,
      refresh,
      verifyEmail,
      resendVerification,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
