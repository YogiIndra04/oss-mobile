import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";
import { Prisma } from "@prisma/client";

export async function POST(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = params?.id;
    if (!id) return NextResponse.json({ error: "invoice_id wajib diisi" }, { status: 400 });

    const inv = await prisma.invoices.findUnique({ where: { invoice_id: id } });
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const items = await prisma.productdetail.findMany({
      where: { invoice_id: id },
      select: { line_total_idr: true, total_product_amount: true },
    });
    const sumIdr = items.reduce((acc, it) => {
      const v = it.line_total_idr ?? it.total_product_amount ?? 0;
      return acc + Number(v);
    }, 0);
    let discInv = 0;
    if (inv.invoice_discount_type && inv.invoice_discount_value != null) {
      if (inv.invoice_discount_type === 'PERCENT') {
        discInv = sumIdr * Number(inv.invoice_discount_value) / 100;
      } else {
        discInv = Number(inv.invoice_discount_value);
      }
      if (discInv > sumIdr) discInv = sumIdr;
    }
    const subtotalAfter = sumIdr - discInv;
    const updated = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        subtotal_before_invoice_discount: new Prisma.Decimal(sumIdr).toDecimalPlaces(2),
        invoice_discount_amount: new Prisma.Decimal(discInv).toDecimalPlaces(2),
        subtotal_after_invoice_discount: new Prisma.Decimal(subtotalAfter).toDecimalPlaces(2),
        total_amount: new Prisma.Decimal(subtotalAfter).toDecimalPlaces(2),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("POST /invoices/:id/recompute error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

