import { AsyncLocalStorage } from "node:async_hooks";

type BaseContext = { baseId: string };

declare global {
  // eslint-disable-next-line no-var
  var __baseStorage: AsyncLocalStorage<BaseContext> | undefined;
}

// Guardado em globalThis pelo mesmo motivo do singleton do Prisma
// (lib/prisma.ts): em dev, o Next recompila cada rota/página como uma
// unidade quase independente, e um `const storage = new AsyncLocalStorage()`
// a nível de módulo pode acabar duplicado entre esses bundles — cada cópia
// com seu próprio contexto, nunca vendo o que a outra gravou. Preso em
// globalThis, todas as cópias do módulo compartilham a mesma instância.
const storage: AsyncLocalStorage<BaseContext> = globalThis.__baseStorage ?? new AsyncLocalStorage<BaseContext>();
globalThis.__baseStorage = storage;

// Fail-closed: quando não há base no contexto (requisição sem cookie válido,
// cron sem escopo explícito), este id nunca bate com nada — nenhum registro
// vaza. Ver lib/prisma.ts, onde toda leitura/escrita das 7 entidades raiz é
// filtrada por baseId automaticamente.
export const NO_BASE_SENTINEL = "__no-base__";

export function getCurrentBaseId(): string | undefined {
  return storage.getStore()?.baseId;
}

export function requireBaseId(): string {
  const baseId = getCurrentBaseId();
  if (!baseId) {
    throw new Error("Nenhuma base ativa no contexto atual — operação exige uma base selecionada.");
  }
  return baseId;
}

export function runWithBase<T>(baseId: string, fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(storage.run({ baseId }, fn));
}

// Escape hatch explícito para operações de sistema que legitimamente
// precisam iterar todas as bases (ex.: o cron descobrindo quais bases
// existem antes de rodar cada job dentro de runWithBase). Nunca usar para
// servir dados de usuário — o objetivo é deixar esses pontos grep-áveis e
// óbvios em vez de um "esquecimento" silencioso de escopo.
export function runUnscoped<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(fn());
}
