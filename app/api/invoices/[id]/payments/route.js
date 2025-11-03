import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET payment history for an invoice with running totals
export async function GET(_req, ctx) {
  try {
    const { id: invoiceId } = await ctx.params;
    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: invoiceId },
      select: {
        invoice_id: true,
        invoice_number: true,
        customer_name: true,
        total_amount: true,
        unpaid: true,
        payment_status: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const proofs = await prisma.paymentproofs.findMany({
      where: { invoice_id: invoiceId },
      orderBy: [
        { proof_sequence: "asc" },
        { created_at: "asc" },
      ],
      select: {
        payment_proof_id: true,
        proof_sequence: true,
        proof_status: true,
        proof_amount: true,
        proof_date: true,
        proof_title: true,
        proof_description: true,
        proof_image_path: true,
        created_at: true,
      },
    });

    let cumulativePaid = 0;
    const totalAmount = Number(invoice.total_amount || 0);
    const items = proofs.map((p) => {
      const amount = Number(p.proof_amount || 0);
      if (String(p.proof_status) === "Verified") {
        cumulativePaid += amount;
      }
      const remainingAfter = Math.max(0, totalAmount - cumulativePaid);
      return {
        ...p,
        cumulative_paid: cumulativePaid,
        remaining_after: remainingAfter,
      };
    });

    return NextResponse.json(
      {
        invoice,
        summary: {
          total_amount: totalAmount,
          cumulative_paid: cumulativePaid,
          unpaid: Math.max(0, totalAmount - cumulativePaid),
          payment_status: invoice.payment_status,
        },
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /invoices/[id]/payments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
