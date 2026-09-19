/* HAFID — service worker
   Guarda o app no aparelho para que ele abra sem internet.
   As imagens têm nome derivado do conteúdo (ex.: a3f9....webp), então nunca
   mudam: podem ser servidas do cache para sempre. Já o index.html muda a cada
   publicação, por isso vai primeiro à rede e só cai no cache se ela falhar. */

const VERSAO = "hafid-v1";
const ESSENCIAIS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo-192.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(VERSAO)
      .then(c => c.addAll(ESSENCIAIS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())        // se algo falhar, instala mesmo assim
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // o Supabase nunca é cacheado: dado velho seria pior que erro de rede
  if (url.hostname.endsWith("supabase.co")) return;

  // imagens e a biblioteca: cache primeiro, porque o nome garante a versão
  const fixo = url.pathname.includes("/img/") ||
               url.hostname === "cdn.jsdelivr.net" ||
               /\.(png|jpe?g|webp|gif|svg|woff2?)$/i.test(url.pathname);

  if (fixo) {
    ev.respondWith(
      caches.match(req).then(achou => achou || fetch(req).then(resp => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }))
    );
    return;
  }

  // o resto (index.html à frente): rede primeiro, cache como rede de segurança
  ev.respondWith(
    fetch(req)
      .then(resp => {
        if (resp && resp.ok && url.origin === self.location.origin) {
          const copia = resp.clone();
          caches.open(VERSAO).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then(achou => achou || caches.match("./index.html")))
  );
});
