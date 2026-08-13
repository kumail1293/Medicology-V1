import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, useGetCurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { isTokenExpired } from "./tokenUtils";

// --- MONKEY PATCH FETCH TO INJECT JWT TOKEN GLOBALLY ---
// NOTE: { ...headersObj } doesn't work for Headers instances — it returns {}.
// Using new Headers(existing) is the correct way to copy all header types.
const originalFetch = window.fetch;

function getStoredToken() {
  try {
    return localStorage.getItem("medicology_token") || sessionStorage.getItem("medicology_token") || null;
  } catch {
    return null;
  }
}

function persistToken(token: string, remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem("medicology_token", token);
      sessionStorage.removeItem("medicology_token");
    } else {
      sessionStorage.setItem("medicology_token", token);
      localStorage.removeItem("medicology_token");
    }
  } catch {}
}

window.fetch = async (input, init) => {
  const token = getStoredToken();
  if (token) {
    if (isTokenExpired(token)) {
      try {
        localStorage.removeItem("medicology_token");
        sessionStorage.removeItem("medicology_token");
      } catch {}
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
  login: (token: string, user: User, remember?: boolean) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  role: "user",
  isSuperAdmin: true,
  isAdmin: true,
  customPermissions: {},
  hasPermission: () => true,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<User | null>(null);

  const { data: currentUser, isLoading, isFetching, error, refetch } = useGetCurrentUser({
    query: {
      queryKey: ["current-user"],
      enabled: !!token && !user,
      retry: false,
    },
  });

  const logout = React.useCallback(() => {
    localStorage.removeItem("medicology_token");
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token && isTokenExpired(token)) {
      logout();
    }
  }, [token, logout]);

useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
    // Only logout on API error if we don't already have a user from login()
    if (error && !user) {
      console.warn("Failed to fetch user and no local user available", error);
      logout();
    }
  }, [currentUser, error, user, logout]);
  
  const login = (newToken: string, newUser: User, remember: boolean = true) => {
    persistToken(newToken, remember);
    setToken(newToken);
    setUser(newUser);
  };

  const refreshUser = () => {
    refetch();
  };

  // The current-user query populates `currentUser` before the effect that copies
  // it into `user` runs. Deriving role/admin from both avoids a one-render window
  // where an admin reloading an admin page looks like a plain user and gets
  // redirected by AdminRoute.
  const activeUser = (user ?? currentUser) ?? null;
  const role = ((activeUser as any)?.role ?? "user") as UserRole;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = isSuperAdmin || role === "admin" || !!activeUser?.isAdmin;
  const customPermissions: CustomPermissions = ((activeUser as any)?.customPermissions ?? {}) as CustomPermissions;

  const hasPermission = (key: string): boolean => {
    if (isSuperAdmin) return true;
    if (isAdmin && key !== "canManageRoles") return true;
    return customPermissions[key] === true;
  };

  // Only block on loading while we have a token but no user yet. Once `login()`
  // sets the user locally, the current-user query is disabled, so we must not
  // wait for it (otherwise the app spins forever after mock login).
  const authLoading = !!token && !user && (isLoading || isFetching || (!currentUser && !error));

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading: authLoading,
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
  const { isLoading, token } = useAuth();
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

