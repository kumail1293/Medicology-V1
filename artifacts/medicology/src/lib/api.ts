import { isTokenExpired } from "./tokenUtils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("medicology_token");

  if (token && isTokenExpired(token)) {
    localStorage.removeItem("medicology_token");
    window.location.href = `${BASE}/login`;
    return new Response(null, { status: 401 });
  }

  const headers = new Headers(init?.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : path;
  return fetch(url, { ...init, headers });
}
