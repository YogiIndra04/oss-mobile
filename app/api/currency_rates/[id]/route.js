import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

function isValidYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function toDate(s) {
  return new Date(s);
}

// PUT /api/currency_rates/:id (admin)
export async function PUT(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user || decoded?.role_user !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = params?.id;
    const body = await req.json();
    const updates = {};
    if (body.currency_code)
      updates.currency_code = body.currency_code.trim().toUpperCase();
    const rateRaw = body.rate_to_base ?? body.rate;
    if (rateRaw != null && rateRaw !== "") {
      const r = Number(rateRaw);
      if (!Number.isFinite(r) || r <= 0)
        return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
      updates.rate_to_base = Number(r.toFixed(6));
    }
    if (body.effective_date) {
      if (!isValidYMD(body.effective_date))
        return NextResponse.json(
          { error: "Invalid effective_date" },
          { status: 400 }
        );
      updates.effective_date = toDate(body.effective_date);
    }

    // enforce uniqueness
    if (updates.currency_code || updates.effective_date) {
      const current = await prisma.currency_rates.findUnique({
        where: { rate_id: id },
      });
      if (!current)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      const nextCode = updates.currency_code || current.currency_code;
      const nextDate = updates.effective_date || current.effective_date;
      const clash = await prisma.currency_rates.findFirst({
        where: {
          rate_id: { not: id },
          currency_code: nextCode,
          effective_date: nextDate,
        },
      });
      if (clash)
        return NextResponse.json(
          { error: "Duplicate (currency_code, effective_date)" },
          { status: 409 }
        );
    }

    if (body.source !== undefined)
      updates.source = body.source ? String(body.source).trim() : null;
    if (body.notes !== undefined)
      updates.notes = body.notes ? String(body.notes) : null;

    const updated = await prisma.currency_rates.update({
      where: { rate_id: id },
      data: updates,
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /currency_rates/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/currency_rates/:id (admin; batasi jika sudah dipakai)
export async function DELETE(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user || decoded?.role_user !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = params?.id;
    const rate = await prisma.currency_rates.findUnique({
      where: { rate_id: id },
    });
    if (!rate)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Batasi jika sudah dipakai oleh invoice snapshot (match by currency + date)
    const used = await prisma.invoices.count({
      where: {
        currency_accepted: rate.currency_code,
        currency_exchange_rate_date: rate.effective_date,
      },
    });
    if (used > 0) {
      return NextResponse.json(
        { error: "Cannot delete: rate already used by invoices" },
        { status: 409 }
      );
    }

    await prisma.currency_rates.delete({ where: { rate_id: id } });
    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /currency_rates/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
