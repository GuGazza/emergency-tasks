// Cloudflare Worker: sirve los archivos estáticos y hace de proxy mismo-origen
// hacia el backend de Google Apps Script. Así el navegador nunca habla con
// Apps Script directo (evita CORS / CORB / redirect 302), y la respuesta vuelve
// legible para poder detectar errores de escritura.

const APPS_SCRIPT =
  "https://script.google.com/macros/s/AKfycbxqKW2VHxCNrKuYlSyHSG6squo4e5RTLwH06gUogjFkP3YXL3-9QbRsZpxFCCiRKmvY/exec";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api  ->  proxy hacia Apps Script (lectura GET y escritura POST)
    if (url.pathname === "/api") {
      const init = {
        method: request.method,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
      };
      if (request.method === "POST") {
        init.body = await request.text();
      }
      try {
        const upstream = await fetch(APPS_SCRIPT + url.search, init);
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": "application/json;charset=utf-8" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), {
          status: 502,
          headers: { "Content-Type": "application/json;charset=utf-8" },
        });
      }
    }

    // resto -> archivos estáticos (index.html, etc.)
    const asset = await env.ASSETS.fetch(request);
    const ct = asset.headers.get("Content-Type") || "";
    if (ct.includes("text/html") || ct.includes("javascript")) {
      const headers = new Headers(asset.headers);
      headers.set("Cache-Control", "no-cache");
      return new Response(asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers,
      });
    }
    return asset;
  },
};
