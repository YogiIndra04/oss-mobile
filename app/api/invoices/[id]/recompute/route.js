import {
  recomputeTotals,
  recomputeUnpaidAndStatus,
} from "@/lib/invoiceRecompute";
import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = params?.id;
    if (!id)
      return NextResponse.json(
        { error: "invoice_id wajib diisi" },
        { status: 400 }
      );

    const inv = await prisma.invoices.findUnique({ where: { invoice_id: id } });
    if (!inv)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    await recomputeTotals(id);
    const updated2 = await recomputeUnpaidAndStatus(id);
    const latest = await prisma.invoices.findUnique({
      where: { invoice_id: id },
    });
    return NextResponse.json(latest || updated2 || inv, { status: 200 });
  } catch (error) {
    console.error("POST /invoices/:id/recompute error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
