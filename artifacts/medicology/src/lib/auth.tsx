import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, useGetCurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { isTokenExpired } from "./tokenUtils";

// --- MONKEY PATCH FETCH TO INJECT JWT TOKEN GLOBALLY ---
// NOTE: { ...headersObj } doesn't work for Headers instances — it returns {}.
// Using new Headers(existing) is the correct way to copy all header types.
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const token = localStorage.getItem("medicology_token");
  if (token) {
    if (isTokenExpired(token)) {
      localStorage.removeItem("medicology_token");
      window.location.href = "/login";
      return new Response(null, { status: 401 });
    }
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${token}`);
    }
    init = { ...(init || {}), headers };
  }
  return originalFetch(input, init);
};

type UserRole = "user" | "editor" | "teacher" | "reviewer" | "admin" | "superadmin";
type CustomPermissions = Record<string, boolean>;

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  customPermissions: CustomPermissions;
  hasPermission: (key: keyof CustomPermissions) => boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  role: "user",
  isSuperAdmin: false,
  isAdmin: false,
  customPermissions: {},
  hasPermission: () => false,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("medicology_token"));
  const [user, setUser] = useState<User | null>(null);

  const { data: currentUser, isLoading, error, refetch } = useGetCurrentUser({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  const logout = React.useCallback(() => {
    localStorage.removeItem("medicology_token");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const t = localStorage.getItem("medicology_token");
      if (t && isTokenExpired(t)) logout();
    }, 60_000);
    return () => clearInterval(id);
  }, [logout]);

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
    if (error) {
      logout();
    }
  }, [currentUser, error, logout]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("medicology_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const refreshUser = () => {
    refetch();
  };

  const role = ((user as any)?.role ?? "user") as UserRole;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = isSuperAdmin || role === "admin" || !!user?.isAdmin;
  const customPermissions: CustomPermissions = ((user as any)?.customPermissions ?? {}) as CustomPermissions;

  const hasPermission = (key: string): boolean => {
    if (isSuperAdmin) return true;
    if (isAdmin && key !== "canManageRoles") return true;
    return customPermissions[key] === true;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading: !!token && isLoading,
      role,
      isSuperAdmin,
      isAdmin,
      customPermissions,
      hasPermission,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      setLocation("/login");
    }
  }, [isLoading, token, setLocation]);

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <Component />;
}

export function AdminRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAdmin, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!token || !isAdmin)) {
      setLocation("/");
    }
  }, [isLoading, token, isAdmin, setLocation]);

  if (isLoading || !token || !isAdmin) {
    return null;
  }

  return <Component />;
}
