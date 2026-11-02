import { createSessionCookie, isSameOrigin, readJsonBody, verifyVaultPassword } from "../_auth.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export default async function handler(request) {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers, Allow: "POST" } });
  if (!isSameOrigin(request)) return new Response(JSON.stringify({ error: "Request origin rejected." }), { status: 403, headers });
  try {
    const input = await readJsonBody(request);
    const password = typeof input?.password === "string" ? input.password : "";
    if (!verifyVaultPassword(password)) return new Response(JSON.stringify({ error: "Incorrect password." }), { status: 401, headers });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, "Set-Cookie": createSessionCookie(request) } });
  } catch (error) {
    const status = error.message && error.message.includes("must contain") ? 503 : 400;
    return new Response(JSON.stringify({ error: status === 503 ? "Vault authentication is not configured in Vercel yet." : "Invalid login request." }), { status, headers });
  }
}
