// Limite de tentativas de login por e-mail, em memória do processo (o app
// roda num processo só — server.ts). Sem isso dava pra testar senhas sem
// parar (achado G-17 da auditoria Gengar). Reiniciar o serviço zera a conta.
const MAX_FALHAS = 8;
const JANELA_MS = 15 * 60 * 1000;

type Registro = { falhas: number; desde: number };

declare global {
  var __loginThrottle: Map<string, Registro> | undefined;
}

const registros: Map<string, Registro> = globalThis.__loginThrottle ?? new Map();
globalThis.__loginThrottle = registros;

function atual(email: string): Registro | undefined {
  const r = registros.get(email);
  if (r && Date.now() - r.desde > JANELA_MS) {
    registros.delete(email);
    return undefined;
  }
  return r;
}

export function loginBloqueado(email: string): boolean {
  return (atual(email)?.falhas ?? 0) >= MAX_FALHAS;
}

export function registrarFalhaLogin(email: string) {
  const r = atual(email);
  if (r) r.falhas += 1;
  else registros.set(email, { falhas: 1, desde: Date.now() });
}

export function limparFalhasLogin(email: string) {
  registros.delete(email);
}
