const TOKEN_KEY = 'af_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const resp = await fetch(input, { ...init, headers });
  if (resp.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('af:unauthorized'));
  }
  return resp;
}
