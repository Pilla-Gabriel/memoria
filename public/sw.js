// Service worker mínimo só para Web Push — recebe o evento em segundo plano
// (com a aba fechada) e mostra a notificação na área de trabalho; ao clicar,
// foca uma aba já aberta do app ou abre uma nova na URL do alerta.
self.addEventListener("push", (event) => {
  let payload = { title: "MEMÓRIA", body: "Você tem uma novidade." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload não veio em JSON — mantém o texto padrão em vez de quebrar a notificação
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientsList.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
