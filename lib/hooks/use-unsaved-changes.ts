"use client";

import { useEffect } from "react";

// Aviso nativo do navegador ao recarregar, fechar a aba ou sair do site com
// algo digitado e ainda não salvo (achado G-06: F5 ou o gesto de voltar do
// trackpad apagavam o formulário/check-in sem perguntar).
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
