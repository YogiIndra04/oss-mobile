import prisma from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const inv = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      select: { pdf_path: true },
    });
    if (!inv?.pdf_path) {
      return new Response(JSON.stringify({ error: "PDF not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    const upstream = await fetch(inv.pdf_path, { cache: "no-store" });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream fetch failed", detail: text }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        // Disable caching so clients always see the latest content
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "pragma": "no-cache",
        "expires": "0",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Internal Server Error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

