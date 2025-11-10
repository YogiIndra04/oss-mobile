import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { recomputeTotals, recomputeUnpaidAndStatus } from "@/lib/invoiceRecompute";

// GET by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const base = await prisma.productdetail.findUnique({
      where: { product_detail_id: id },
      select: {
        product_detail_id: true,
        invoice_id: true,
        product_id: true,
        quantity: true,
        total_product_amount: true,
        discount_type: true,
        discount_value: true,
        line_total_before_discount: true,
        line_discount_amount: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!base) {
      return new Response(
        JSON.stringify({ error: "ProductDetail not found" }),
        { status: 404 }
      );
    }

    const [invoice, product] = await Promise.all([
      prisma.invoices.findUnique({ where: { invoice_id: base.invoice_id } }),
      prisma.product.findUnique({ where: { product_id: base.product_id } }),
    ]);

    return new Response(JSON.stringify({ ...base, invoice, product }), {
      status: 200,
    });
  } catch (error) {
    console.error("GET /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// UPDATE (recompute totals)
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    const existing = await prisma.productdetail.findUnique({
      where: { product_detail_id: id },
    });
    if (!existing) {
      return new Response(
        JSON.stringify({ error: "ProductDetail not found" }),
        { status: 404 }
      );
    }

    const nextInvoiceId = body.invoice_id || existing.invoice_id;
    const nextProductId = body.product_id || existing.product_id;
    const qty =
      body.quantity != null ? Number(body.quantity) : existing.quantity;

    const prod = await prisma.product.findUnique({
      where: { product_id: nextProductId },
    });
    if (!prod) {
      return new Response(JSON.stringify({ error: "Produk tidak ditemukan" }), {
        status: 404,
      });
    }
    const discountType = Object.prototype.hasOwnProperty.call(
      body,
      "discount_type"
    )
      ? body.discount_type
      : existing.discount_type;
    const discountValue = Object.prototype.hasOwnProperty.call(
      body,
      "discount_value"
    )
      ? body.discount_value != null
        ? Number(body.discount_value)
        : null
      : existing.discount_value;
    const inv = await prisma.invoices.findUnique({
      where: { invoice_id: nextInvoiceId },
    });
    const currencyCode = (
      body.currency_code?.toString() ||
      existing.currency_code ||
      inv?.currency_accepted ||
      "IDR"
    ).toUpperCase();
    const unitPriceForeign =
      body.unit_price_foreign != null
        ? Number(body.unit_price_foreign)
        : existing.unit_price_foreign != null
        ? Number(existing.unit_price_foreign)
        : Number(prod.product_amount);

    const baseForeign = new Prisma.Decimal(qty).mul(
      new Prisma.Decimal(unitPriceForeign)
    );
    let discForeign = new Prisma.Decimal(0);
    if (discountType && discountValue != null) {
      if (discountType === "PERCENT") {
        discForeign = baseForeign.mul(
          new Prisma.Decimal(discountValue).div(new Prisma.Decimal(100))
        );
      } else {
        const raw = new Prisma.Decimal(discountValue);
        discForeign = raw.lessThan(baseForeign) ? raw : baseForeign;
      }
    }
    const afterForeign = baseForeign.sub(discForeign);
    const rate =
      currencyCode === "IDR"
        ? new Prisma.Decimal(1)
        : new Prisma.Decimal(inv?.currency_exchange_rate || 0);
    const baseIdr = baseForeign.mul(rate);
    const discIdr = discForeign.mul(rate);
    const afterIdr = afterForeign.mul(rate);

    const updated = await prisma.productdetail.update({
      where: { product_detail_id: id },
      data: {
        invoice_id: nextInvoiceId,
        product_id: nextProductId,
        quantity: qty,
        currency_code: currencyCode,
        unit_price_foreign: unitPriceForeign,
        line_total_before_discount_foreign: baseForeign.toDecimalPlaces(6),
        line_discount_amount_foreign: discForeign.toDecimalPlaces(6),
        line_total_foreign: afterForeign.toDecimalPlaces(6),
        line_total_idr: afterIdr.toDecimalPlaces(2),
        total_product_amount: afterIdr.toDecimalPlaces(2),
        discount_type: discountType || null,
        discount_value: discountValue != null ? Number(discountValue) : null,
        line_total_before_discount: baseIdr.toDecimalPlaces(2),
        line_discount_amount: discIdr.toDecimalPlaces(2),
        updated_at: new Date(),
      },
    });
    // recompute totals and unpaid/status
    try { await recomputeTotals(nextInvoiceId); } catch {}
    try { await recomputeUnpaidAndStatus(nextInvoiceId); } catch {}

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (error) {
    console.error("PUT /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// DELETE
export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    // Get invoice_id then delete
    const before = await prisma.productdetail.findUnique({
      where: { product_detail_id: id },
      select: { invoice_id: true },
    });
    await prisma.productdetail.delete({ where: { product_detail_id: id } });

    // Recompute totals and unpaid/status after deletion
    try { await recomputeTotals(before?.invoice_id); } catch {}
    try { await recomputeUnpaidAndStatus(before?.invoice_id); } catch {}

    return new Response(JSON.stringify({ message: "Deleted successfully" }), {
      status: 200,
    });
  } catch (error) {
    console.error("DELETE /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
