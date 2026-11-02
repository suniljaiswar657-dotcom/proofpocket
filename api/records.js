import { get, list, put } from "@vercel/blob";

const PRIVATE = { access: "private" };
const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export default async function handler(request) {
  try {
    if (request.method === "GET") {
      let cursor;
      const entries = [];
      do {
        const page = await list({ prefix: "records/", limit: 1000, cursor });
        entries.push(...page.blobs);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);

      const records = [];
      for (const entry of entries) {
        const result = await get(entry.pathname, PRIVATE);
        if (!result || result.statusCode !== 200) continue;
        try {
          const record = JSON.parse(await new Response(result.stream).text());
          if (record && record.id && record.title) records.push(record);
        } catch {}
      }
      records.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
      return new Response(JSON.stringify(records), { status: 200, headers });
    }

    if (request.method === "POST") {
      const input = await request.json();
      const id = String(input.id || "");
      const title = String(input.title || "").trim();
      const types = ["Receipt", "Warranty", "Document"];
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || !title || title.length > 70 || !types.includes(input.type)) {
        return new Response(JSON.stringify({ error: "Invalid record details." }), { status: 400, headers });
      }
      let attachment = null;
      if (input.attachment) {
        const pathname = String(input.attachment.pathname || "");
        if (!pathname.startsWith("attachments/" + id + "/")) {
          return new Response(JSON.stringify({ error: "Invalid attachment reference." }), { status: 400, headers });
        }
        attachment = {
          pathname,
          filename: String(input.attachment.filename || "attachment").slice(0, 120),
          contentType: String(input.attachment.contentType || ""),
          size: Number(input.attachment.size || 0)
        };
      }
      const record = {
        id, title, type: input.type,
        date: String(input.date || "").slice(0, 10),
        warrantyEnd: String(input.warrantyEnd || "").slice(0, 10),
        notes: String(input.notes || "").slice(0, 300),
        attachment,
        createdAt: String(input.createdAt || new Date().toISOString())
      };
      const pathname = "records/" + id + ".json";
      const existing = await get(pathname, PRIVATE);
      if (existing && existing.statusCode === 200) {
        return new Response(JSON.stringify({ error: "This record already exists." }), { status: 409, headers });
      }
      await put(pathname, JSON.stringify(record), { ...PRIVATE, addRandomSuffix: false, contentType: "application/json" });
      return new Response(JSON.stringify({ ok: true, record }), { status: 201, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { ...headers, Allow: "GET, POST" } });
  } catch (error) {
    console.error("PROOFPOCKET records API:", error);
    return new Response(JSON.stringify({ error: "Cloud storage request failed. Please retry." }), { status: 500, headers });
  }
}
