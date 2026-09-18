import axios from "axios";
import { API_BASE } from "@/lib/site";

const TOKEN_KEY = "repoverix-token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!path.startsWith("/auth")) {
        setToken(null);
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(err);
  },
);

/** Machine-readable backend error code from the X-Error-Code header
 *  (e.g. EMAIL_NOT_VERIFIED, INVALID_TOKEN, TEMPORARILY_LOCKED). */
export function apiErrorCode(err: unknown): string | null {
  const code = (err as { response?: { headers?: Record<string, string> } })
    ?.response?.headers?.["x-error-code"];
  return typeof code === "string" && code ? code : null;
}
