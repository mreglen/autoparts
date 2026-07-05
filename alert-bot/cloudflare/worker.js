/** Cloudflare Worker: reverse proxy to Telegram Bot API (for blocked regions). */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL("https://api.telegram.org" + url.pathname + url.search);

    const headers = new Headers(request.headers);
    headers.delete("host");

    const init = {
      method: request.method,
      headers,
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const response = await fetch(target.toString(), init);
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  },
};
