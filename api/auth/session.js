import { authConfigReady, hasValidSession } from "../_auth.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export default async function handler(request) {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers, Allow: "GET" } });
  if (!authConfigReady()) return new Response(JSON.stringify({ authenticated: false, configured: false }), { status: 503, headers });
  return new Response(JSON.stringify({ authenticated: hasValidSession(request), configured: true }), { status: 200, headers });
}
