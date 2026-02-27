// Cloudflare Pages Function: Proxy /api/* requests to backend
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // Build target URL
    const targetUrl = `https://sodamfn.twinverse.org${url.pathname}${url.search}`;

    // Clone headers, forward auth
    const headers = new Headers(request.headers);
    headers.set('Host', 'sodamfn.twinverse.org');
    headers.delete('cookie'); // Don't forward cookies to avoid conflicts

    const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'follow',
    });

    try {
        const response = await fetch(proxyRequest);

        // Clone response and add CORS headers
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: newHeaders,
            });
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Proxy error', detail: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
