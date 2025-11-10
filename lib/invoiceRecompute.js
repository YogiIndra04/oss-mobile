import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function recomputeTotals(invoice_id) {
  try {
    if (!invoice_id) return null;

    const items = await prisma.productdetail.findMany({
      where: { invoice_id },
      select: { line_total_idr: true, total_product_amount: true },
    });
    const sumIdr = items.reduce((acc, it) => {
      const v = it?.line_total_idr ?? it?.total_product_amount ?? 0;
      return acc + Number(v);
    }, 0);

    const invHeader = await prisma.invoices.findUnique({
      where: { invoice_id },
      select: { invoice_discount_type: true, invoice_discount_value: true },
    });

    let discInv = 0;
    if (invHeader?.invoice_discount_type && invHeader?.invoice_discount_value != null) {
      if (invHeader.invoice_discount_type === "PERCENT") {
        discInv = (sumIdr * Number(invHeader.invoice_discount_value)) / 100;
      } else {
        discInv = Number(invHeader.invoice_discount_value);
      }
      if (discInv > sumIdr) discInv = sumIdr;
    }

    const subtotalAfter = sumIdr - discInv;

    const updated = await prisma.invoices.update({
      where: { invoice_id },
      data: {
        subtotal_before_invoice_discount: new Prisma.Decimal(sumIdr).toDecimalPlaces(2),
        invoice_discount_amount: new Prisma.Decimal(discInv).toDecimalPlaces(2),
        subtotal_after_invoice_discount: new Prisma.Decimal(subtotalAfter).toDecimalPlaces(2),
        total_amount: new Prisma.Decimal(subtotalAfter).toDecimalPlaces(2),
      },
    });

    return updated;
  } catch (e) {
    console.error("recomputeTotals error:", e);
    return null;
  }
}

export async function recomputeUnpaidAndStatus(invoice_id) {
  try {
    if (!invoice_id) return null;

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id },
      select: { total_amount: true, unpaid: true, payment_status: true },
    });
    if (!invoice) return null;

    const agg = await prisma.paymentproofs.aggregate({
      where: { invoice_id, proof_status: "Verified" },
      _sum: { proof_amount: true },
    });

    const total = new Prisma.Decimal(invoice.total_amount || 0);
    const paid = new Prisma.Decimal(agg?._sum?.proof_amount || 0);

    let nextUnpaid = total.sub(paid);
    if (nextUnpaid.lessThan(0)) nextUnpaid = new Prisma.Decimal(0);

    let nextStatus;
    if (nextUnpaid.equals(0)) nextStatus = "Lunas";
    else if (paid.greaterThan(0)) nextStatus = "Mencicil";
    else nextStatus = "Belum_dibayar";

    const curUnpaid = invoice.unpaid == null ? null : new Prisma.Decimal(invoice.unpaid);
    const curStatus = String(invoice.payment_status || "");

    if (curUnpaid === null || !curUnpaid.equals(nextUnpaid) || curStatus !== nextStatus) {
      const updated = await prisma.invoices.update({
        where: { invoice_id },
        data: { unpaid: nextUnpaid, payment_status: nextStatus },
      });
      return updated;
    }

    return invoice; // no change
  } catch (e) {
    console.error("recomputeUnpaidAndStatus error:", e);
    return null;
  }
}

export async function recomputeAll(invoice_id) {
  await recomputeTotals(invoice_id);
  return await recomputeUnpaidAndStatus(invoice_id);
}

