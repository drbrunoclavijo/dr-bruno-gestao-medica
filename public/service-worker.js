/* Majestic Santé PWA: todas as requisições são feitas pela rede. NÃO cachear dados médicos, tokens ou sessões. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Sem handlers fetch, sync ou push: sem acesso offline, sem cópias de informações sensíveis.
