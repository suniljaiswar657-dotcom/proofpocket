import { get } from "@vercel/blob";
import { hasValidSession, unauthorized } from "./_auth.js";

export default async function handler(request) {
  if (!hasValidSession(request)) return unauthorized();
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
  const pathname = new URL(request.url).searchParams.get("pathname") || "";
  if (!pathname.startsWith("attachments/") || pathname.split("/").some(part => !part || part === "." || part === "..")) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
    const contentType = result.blob.contentType || "application/octet-stream";
    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    console.error("PROOFPOCKET file API:", error);
    return new Response("Unable to load this private file.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
