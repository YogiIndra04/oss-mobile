import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";

function isValidYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user || decoded?.role_user !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params?.id;
    if (!id) return NextResponse.json({ error: "invoice_id wajib diisi" }, { status: 400 });

    const inv = await prisma.invoices.findUnique({ where: { invoice_id: id } });
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (inv.payment_status === "Lunas") {
      return NextResponse.json({ error: "Invoice already paid; cannot reprice" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const useLatest = !!body?.useLatest;
    let newRate = null;
    let newDate = null;

    if (useLatest) {
      // lookup latest for invoice currency
      const latest = await prisma.currency_rates.findFirst({
        where: { currency_code: String(inv.currency_accepted).toUpperCase() },
        orderBy: { effective_date: "desc" },
      });
      if (!latest) return NextResponse.json({ error: `No rate for ${inv.currency_accepted}` }, { status: 400 });
      newRate = Number(latest.rate);
      newDate = latest.effective_date;
    } else {
      const rateRaw = body?.rate;
      const dateStr = body?.date || body?.effective_date;
      if (rateRaw == null || rateRaw === "" || !dateStr) {
        return NextResponse.json({ error: "Provide useLatest=true or rate + date" }, { status: 400 });
      }
      const r = Number(rateRaw);
      if (!Number.isFinite(r) || r <= 0) return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
      if (!isValidYMD(dateStr)) return NextResponse.json({ error: "Invalid date, use YYYY-MM-DD" }, { status: 400 });
      newRate = Number(r.toFixed(4));
      newDate = new Date(dateStr);
    }

    const prevRate = inv.currency_exchange_rate ?? null;
    const prevDate = inv.currency_exchange_rate_date ?? null;

    const updated = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        currency_exchange_rate: newRate,
        currency_exchange_rate_date: newDate,
        updated_at: new Date(),
      },
    });

    await prisma.invoice_rate_audit.create({
      data: {
        invoice_id: id,
        old_rate: prevRate,
        old_date: prevDate,
        new_rate: newRate,
        new_date: newDate,
        changed_by: decoded.id_user,
        notes: useLatest ? "reprice: latest" : "reprice: manual",
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("POST /invoices/[id]/reprice error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
