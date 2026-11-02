import { put } from "@vercel/blob";
import { hasValidSession, isSameOrigin, unauthorized } from "./_auth.js";

const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxBytes = 4 * 1024 * 1024;

export default async function handler(request) {
  if (!hasValidSession(request)) return unauthorized();
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers, Allow: "POST" } });
  }
  if (!isSameOrigin(request)) return new Response(JSON.stringify({ error: "Request origin rejected." }), { status: 403, headers });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const recordId = String(form.get("recordId") || "");
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(recordId) || !file || typeof file.arrayBuffer !== "function") {
      return new Response(JSON.stringify({ error: "Choose a valid photo or PDF." }), { status: 400, headers });
    }
    if (!allowed.has(file.type)) {
      return new Response(JSON.stringify({ error: "Only JPG, PNG, WEBP and PDF files are allowed." }), { status: 415, headers });
    }
    if (!file.size || file.size > maxBytes) {
      return new Response(JSON.stringify({ error: "File size must be between 1 byte and 4 MB." }), { status: 413, headers });
    }
    const safeName = String(file.name || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const blob = await put("attachments/" + recordId + "/" + safeName, Buffer.from(await file.arrayBuffer()), {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type
    });
    return new Response(JSON.stringify({
      ok: true,
      attachment: { pathname: blob.pathname, filename: safeName, contentType: file.type, size: file.size }
    }), { status: 201, headers });
  } catch (error) {
    console.error("PROOFPOCKET upload API:", error);
    return new Response(JSON.stringify({ error: "Private file upload failed. Please retry." }), { status: 500, headers });
  }
}
