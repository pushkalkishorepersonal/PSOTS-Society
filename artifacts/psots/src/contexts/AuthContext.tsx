import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type Role = "resident" | "committee" | "admin";

export interface AuthUser {
  sub: number;
  role: Role;
  name: string;
  flatNumber: string | null;
  email: string;
  exp?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
  hasRole: (minRole: Role) => boolean;
}

const ROLE_LEVELS: Record<Role, number> = { resident: 1, committee: 2, admin: 3 };
const TOKEN_KEY = "psots_auth_token";

function decodeJwt(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as AuthUser & { exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? decodeJwt(t) : null;
  });

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    return () => setAuthTokenGetter(null);
  }, []);

  const login = useCallback((token: string) => {
    const decoded = decodeJwt(token);
    if (!decoded) return;
    localStorage.setItem(TOKEN_KEY, token);
    setUser(decoded);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (minRole: Role) => !!user && ROLE_LEVELS[user.role] >= ROLE_LEVELS[minRole],
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
