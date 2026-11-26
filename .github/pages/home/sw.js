// The root of the site used to serve the hands-on lab with the Simspace runtime, whose service
// worker was scoped to the whole site and served everything cache-first. The root is now a plain
// landing page, and the lab is in lab/. When a returning visitor's browser checks the old worker for
// an update, it gets this one instead: it drops what the old worker cached for the root (lab/ and
// simspace/ have their own workers), unregisters itself, and reloads the open pages.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const scope = new URL(self.registration.scope).pathname;
      const keep = ["lab/", "simspace/"].map((p) => new URL(p, self.registration.scope).pathname);
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const path = new URL(req.url).pathname;
          if (path.startsWith(scope) && !keep.some((k) => path.startsWith(k))) await cache.delete(req);
        }
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })(),
  );
});
