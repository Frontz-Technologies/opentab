import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRegisteredQueues } from "@/lib/jobs/queues";

// Bull Board's Express adapter doesn't bridge cleanly into Next App
// Router (Express's req/res shape vs the fetch Request/Response). For
// v1 this route renders a thin status page (queues + counts). Full
// Bull Board UI lands in a v1.1 PR that runs Bull Board on its own
// HTTP server inside the worker process and exposes a reverse-proxy
// here. The double-gate (env flag + owner|admin role) and the queue
// adapters are wired today so v1.1 is a UI-only swap.

async function gate(): Promise<{ ok: true } | { ok: false; status: number }> {
  if (process.env.ENABLE_QUEUE_DASHBOARD !== "true") {
    return { ok: false, status: 404 };
  }
  const session = await getSession();
  if (!session) return { ok: false, status: 404 };
  if (session.role !== "owner" && session.role !== "admin") {
    return { ok: false, status: 404 };
  }
  return { ok: true };
}

async function statusPage(): Promise<Response> {
  const queues = getRegisteredQueues();
  const rows = await Promise.all(
    queues.map(async (q) => {
      try {
        const counts = await q.getJobCounts(
          "wait",
          "active",
          "completed",
          "failed",
          "delayed",
        );
        return { name: q.name, counts };
      } catch (err) {
        return {
          name: q.name,
          counts: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    }),
  );

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Queue admin (#85)</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system; padding: 2rem; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
  .note { color: #6b7280; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #f9fafb; font-weight: 600; font-size: 0.85rem; }
  td.counts { font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .empty { color: #9ca3af; font-style: italic; padding: 1rem 0; }
</style>
</head>
<body>
<h1>Queue admin (#85)</h1>
<p class="note">Queues registered in this Node process. Full Bull Board UI lands in v1.1.</p>
${
  rows.length === 0
    ? '<p class="empty">No queues registered yet — enqueue a job from the app to populate this page.</p>'
    : `<table>
  <thead><tr><th>Queue</th><th>Counts</th></tr></thead>
  <tbody>
    ${rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td class="counts">${escapeHtml(JSON.stringify(r.counts))}</td></tr>`,
      )
      .join("")}
  </tbody>
</table>`
}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(_req: Request) {
  const g = await gate();
  if (!g.ok) return new NextResponse(null, { status: g.status });
  return statusPage();
}

export async function POST(_req: Request) {
  // Reserved for v1.1 — retry / clean buttons. Gate-only for now.
  const g = await gate();
  if (!g.ok) return new NextResponse(null, { status: g.status });
  return new NextResponse(null, { status: 405 });
}
