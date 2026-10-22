const APP_SHELL_CACHE = "wikicompare-app-shell-v3";
const CORE_ASSETS = ["/", "/index.html", "/favicon.ico"];

self.addEventListener("install", event => {
	event.waitUntil(
		caches
			.open(APP_SHELL_CACHE)
			.then(cache => cache.addAll(CORE_ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches
			.keys()
			.then(keys =>
				Promise.all(
					keys
						.filter(key => key.startsWith("wikicompare-app-shell") && key !== APP_SHELL_CACHE)
						.map(key => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", event => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then(response => {
					const copy = response.clone();
					caches.open(APP_SHELL_CACHE).then(cache => {
						cache.put("/index.html", copy);
					});
					return response;
				})
				.catch(() =>
					caches.match("/index.html").then(response => response || caches.match("/"))
				)
		);
		return;
	}

	if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/experiment_data/")) {
		event.respondWith(fetch(request, { cache: "no-store" }));
		return;
	}

	if (["script", "style", "worker"].includes(request.destination) || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
		event.respondWith(
			fetch(request)
				.then(response => {
					if (response && response.ok) {
						const copy = response.clone();
						caches.open(APP_SHELL_CACHE).then(cache => cache.put(request, copy));
					}
					return response;
				})
				.catch(() => caches.match(request))
		);
		return;
	}

	event.respondWith(
		caches.match(request).then(cached => {
			if (cached) return cached;
			return fetch(request).then(response => {
				if (response && response.ok) {
					const copy = response.clone();
					caches.open(APP_SHELL_CACHE).then(cache => {
						cache.put(request, response.clone());
						cache.put(url.pathname, copy);
					});
				}
				return response;
			});
		})
	);
});
