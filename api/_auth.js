import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "pp_session";
const SESSION_SECONDS = 8 * 60 * 60;

function secret() {
  const value = process.env.PP_SESSION_SECRET || "";
  if (value.length < 32) throw new Error("PP_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function safeEqual(a, b) {
  const left = createHash("sha256").update(String(a)).digest();
  const right = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(left, right);
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function getHeader(request, name) {
  const headers = request?.headers;
  if (headers && typeof headers.get === "function") return headers.get(name) || "";
  const value = headers?.[name.toLowerCase()] ?? headers?.[name] ?? "";
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

export function requestUrl(request) {
  const raw = request?.url || "/";
  if (/^https?:\/\//i.test(raw)) return new URL(raw);
  const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host") || "localhost";
  const proto = getHeader(request, "x-forwarded-proto") || "https";
  return new URL(raw, proto + "://" + host);
}

export async function readJsonBody(request) {
  if (typeof request?.json === "function") return request.json();
  if (request?.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request?.body === "string") return JSON.parse(request.body);
  if (typeof request?.[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  }
  return {};
}

function readCookie(request, name) {
  const raw = getHeader(request, "cookie");
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return "";
}

export function isSameOrigin(request) {
  const origin = getHeader(request, "origin");
  const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

export function sessionCookie(request, clear = false) {
  const secure = requestUrl(request).protocol === "https:" ? "; Secure" : "";
  return clear
    ? `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
    : null;
}

export function createSessionCookie(request) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })).toString("base64url");
  const value = payload + "." + sign(payload);
  const secure = requestUrl(request).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function hasValidSession(request) {
  try {
    const token = readCookie(request, COOKIE);
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    if (!safeEqual(signature, sign(payload))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function verifyVaultPassword(candidate) {
  const expected = process.env.PP_VAULT_PASSWORD || "";
  if (expected.length < 16) throw new Error("PP_VAULT_PASSWORD must contain at least 16 characters.");
  return safeEqual(candidate, expected);
}

export function authConfigReady() {
  return (process.env.PP_VAULT_PASSWORD || "").length >= 16 &&
    (process.env.PP_SESSION_SECRET || "").length >= 32;
}
