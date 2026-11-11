// Customer reviews API for View Canada Immigration Services.
//
//   GET    /api/reviews            -> approved reviews (public; submission dates are not included)
//   POST   /api/reviews            -> submit a review; stored as "pending" until approved
//   GET    /api/reviews?all=1      -> every review, including pending   (admin)
//   PATCH  /api/reviews            -> { id, action: "approve" | "unpublish" } (admin)
//   DELETE /api/reviews?id=...     -> delete a review                    (admin)
//
// Admin requests send "Authorization: Bearer <ADMIN_PASSWORD>".
// Set ADMIN_PASSWORD in Netlify: Site configuration > Environment variables.

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const SERVICES = [
  "Family sponsorship", "Refugee sponsorship", "Express Entry", "Provincial Nominee Program",
  "Work, study or visitor permit", "Business immigration", "Caregiver program", "PR card / PR services",
  "Citizenship", "Travel documents", "Status extension", "Other",
];
const MAX_PENDING = 300;

const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

// Collapse whitespace and strip control characters; keep line breaks in the review text.
const cleanLine = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanText = (v, max) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

const env = (name) => (globalThis.Netlify?.env?.get(name)) ?? process.env[name];

function isAdmin(req) {
  const expected = env("ADMIN_PASSWORD");
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function allReviews(store) {
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return items.filter(Boolean).sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
}

// What visitors see. The submission date stays private (admin only).
const publicView = (r) => ({
  id: r.id, name: r.name, location: r.location, service: r.service,
  rating: r.rating, text: r.text, approved: r.approved || "",
});

// Approval date from the form: "YYYY-MM", "YYYY", "in-progress" or "" (not given).
function parseApproved(monthValue, yearValue) {
  if (yearValue === "in-progress") return "in-progress";
  const year = Number.parseInt(yearValue, 10);
  if (!(year >= 2000 && year <= new Date().getFullYear())) return "";
  const month = Number.parseInt(monthValue, 10);
  return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : String(year);
}

export default async (req) => {
  const store = getStore({ name: "reviews", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("all") === "1") {
      if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);
      return json({ reviews: await allReviews(store) });
    }
    const approved = (await allReviews(store)).filter((r) => r.status === "approved").map(publicView);
    return json({ reviews: approved }, 200, "public, max-age=60");
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

    // Honeypot: real visitors never fill this hidden field.
    if (body.website) return json({ ok: true }, 201);

    const name = cleanLine(body.name, 60);
    const location = cleanLine(body.location, 60);
    const service = SERVICES.includes(body.service) ? body.service : "";
    const rating = Number.parseInt(body.rating, 10);
    const text = cleanText(body.text, 1500);
    const approved = parseApproved(body.approvedMonth, body.approvedYear);

    const errors = {};
    if (name.length < 2) errors.name = "Please enter your name.";
    if (!(rating >= 1 && rating <= 5)) errors.rating = "Please choose a rating.";
    if (text.length < 20) errors.text = "Please write at least 20 characters.";
    if (body.consent !== true) errors.consent = "Please confirm we may publish your review.";
    if (Object.keys(errors).length) return json({ error: "Please check the form.", errors }, 422);

    const existing = await allReviews(store);
    if (existing.filter((r) => r.status === "pending").length >= MAX_PENDING) {
      return json({ error: "We can't accept new reviews right now. Please try again later." }, 503);
    }

    const review = {
      id: crypto.randomUUID(),
      name, location, service, rating, text, approved,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await store.setJSON(review.id, review);
    return json({ ok: true }, 201);
  }

  if (req.method === "PATCH") {
    if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const review = body.id ? await store.get(String(body.id), { type: "json" }) : null;
    if (!review) return json({ error: "Review not found." }, 404);
    if (body.action === "approve") review.status = "approved";
    else if (body.action === "unpublish") review.status = "pending";
    else return json({ error: "Unknown action." }, 400);
    review.updatedAt = new Date().toISOString();
    await store.setJSON(review.id, review);
    return json({ ok: true, review });
  }

  if (req.method === "DELETE") {
    if (!isAdmin(req)) return json({ error: "Unauthorized" }, 401);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Missing id." }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed." }, 405);
};

export const config = { path: "/api/reviews" };
