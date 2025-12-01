import {
  recomputeTotals,
  recomputeUnpaidAndStatus,
} from "@/lib/invoiceRecompute";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const parseNumericFlexible = (value, { defaultValue = null, min = 0, allowZero = true } = {}) => {
  if (value === undefined || value === null) return defaultValue;
  const raw = value.toString().trim();
  if (!raw) return defaultValue;
  let normalized = raw;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  if (hasComma && hasDot) {
    normalized = raw.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    normalized = raw.replace(/,/g, "");
  } else if (hasDot && !hasComma) {
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      normalized = raw.replace(/\./g, "");
    }
  }
  normalized = normalized.replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return defaultValue;
  if (!allowZero && num === 0) return defaultValue;
  if (num < min) return defaultValue;
  return num;
};

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
        currency_code: true,
        unit_price_foreign: true,
        line_total_foreign: true,
        line_total_idr: true,
        currency_rate_used: true,
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
      body.quantity != null
        ? parseNumericFlexible(body.quantity, { defaultValue: existing.quantity, min: 1 }) || existing.quantity
        : existing.quantity;

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
        ? parseNumericFlexible(body.discount_value, { defaultValue: null, min: 0 })
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
        ? parseNumericFlexible(body.unit_price_foreign, {
            defaultValue:
              existing.unit_price_foreign != null
                ? Number(existing.unit_price_foreign)
                : Number(prod.product_amount),
            min: 0,
          })
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
    // pilih rate per-item sesuai prioritas: IDR -> body.currency_rate_used -> derive dari total_product_amount -> header invoice
    let rateUsed;
    const bodyRate = parseNumericFlexible(body.currency_rate_used, {
      defaultValue: null,
      min: 0,
      allowZero: false,
    });
    if (currencyCode === "IDR") {
      rateUsed = 1;
    } else if (Number.isFinite(bodyRate) && bodyRate > 0) {
      rateUsed = bodyRate;
    } else if (
      body.total_product_amount != null &&
      Number(body.total_product_amount) > 0 &&
      afterForeign.gt(0)
    ) {
      rateUsed = Number(body.total_product_amount) / Number(afterForeign);
    } else {
      rateUsed = Number(inv?.currency_exchange_rate || 0);
    }
    if (currencyCode !== "IDR" && (!Number.isFinite(rateUsed) || rateUsed <= 0)) {
      return new Response(
        JSON.stringify({ error: "currency_rate_used wajib diisi untuk currency non-IDR" }),
        { status: 400 }
      );
    }

    const baseIdr = baseForeign.mul(rateUsed);
    const discIdr = discForeign.mul(rateUsed);
    const afterIdr = afterForeign.mul(rateUsed);

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
        currency_rate_used:
          currencyCode === "IDR" ? null : new Prisma.Decimal(rateUsed),
        discount_type: discountType || null,
        discount_value: discountValue != null ? Number(discountValue) : null,
        line_total_before_discount: baseIdr.toDecimalPlaces(2),
        line_discount_amount: discIdr.toDecimalPlaces(2),
        updated_at: new Date(),
      },
    });
    // recompute totals and unpaid/status
    try {
      await recomputeTotals(nextInvoiceId);
    } catch {}
    try {
      await recomputeUnpaidAndStatus(nextInvoiceId);
    } catch {}

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
    try {
      await recomputeTotals(before?.invoice_id);
    } catch {}
    try {
      await recomputeUnpaidAndStatus(before?.invoice_id);
    } catch {}

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
