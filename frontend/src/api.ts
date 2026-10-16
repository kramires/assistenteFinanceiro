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
  if (resp.status === 401 || resp.status === 403) {
    clearToken();
    window.dispatchEvent(new Event('af:unauthorized'));
  }
  return resp;
}

/** Mensagem legível para uma resposta de erro da API (JSON com `detail` ou página HTML do nginx). */
export async function mensagemErro(resp: Response): Promise<string> {
  try {
    const data = await resp.clone().json();
    const detail = data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(d => d?.msg ?? String(d)).join(' | ');
  } catch {
    // corpo não é JSON (ex.: página de erro do nginx)
  }
  switch (resp.status) {
    case 401:
    case 403: return 'Sua sessão expirou. Entre novamente.';
    case 413: return 'Arquivo grande demais (máximo 20 MB).';
    case 429: return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    case 502:
    case 503: return 'O servidor ou a IA está indisponível no momento. Tente novamente em instantes.';
    case 504: return 'A operação demorou demais e foi interrompida. Tente novamente.';
    default:  return `Erro inesperado do servidor (HTTP ${resp.status}).`;
  }
}

/** Mensagem para falha de rede (fetch rejeitado): servidor fora do ar ou sem conexão. */
export const ERRO_REDE = 'Não foi possível falar com o servidor. Verifique se o sistema está rodando e sua conexão.';
