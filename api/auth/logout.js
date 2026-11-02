import { isSameOrigin, sessionCookie } from "../_auth.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export default async function handler(request) {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers, Allow: "POST" } });
  if (!isSameOrigin(request)) return new Response(JSON.stringify({ error: "Request origin rejected." }), { status: 403, headers });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, "Set-Cookie": sessionCookie(request, true) } });
}
