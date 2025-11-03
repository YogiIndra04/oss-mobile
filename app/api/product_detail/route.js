import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// CREATE ProductDetail
export async function POST(req) {
  try {
    const body = await req.json();
    // Basic validations to avoid creating orphan references
    const [invoiceExists, productExists] = await Promise.all([
      prisma.invoices.findUnique({ where: { invoice_id: body.invoice_id } }),
      prisma.product.findUnique({ where: { product_id: body.product_id } }),
    ]);

    if (!invoiceExists) {
      return new Response(
        JSON.stringify({ error: "Invoice tidak ditemukan" }),
        { status: 404 }
      );
    }
    if (!productExists) {
      return new Response(JSON.stringify({ error: "Produk tidak ditemukan" }), {
        status: 404,
      });
    }
    // Hitung total line dengan dukungan currency (foreign + IDR)
    const qty = Math.max(1, Number(body.quantity));
    const inv = invoiceExists;
    const discountType = body.discount_type || null;
    const discountValueRaw =
      body.discount_value != null ? Number(body.discount_value) : null;
    const currencyCode = (
      body.currency_code?.toString() ||
      inv.currency_accepted ||
      "IDR"
    ).toUpperCase();
    const unitPriceForeign =
      body.unit_price_foreign != null
        ? Number(body.unit_price_foreign)
        : Number(productExists.product_amount);

    const baseForeign = new Prisma.Decimal(qty).mul(
      new Prisma.Decimal(unitPriceForeign)
    );
    let discForeign = new Prisma.Decimal(0);
    if (discountType && discountValueRaw != null) {
      if (discountType === "PERCENT") {
        discForeign = baseForeign.mul(
          new Prisma.Decimal(discountValueRaw).div(new Prisma.Decimal(100))
        );
      } else {
        const raw = new Prisma.Decimal(discountValueRaw);
        discForeign = raw.lessThan(baseForeign) ? raw : baseForeign;
      }
    }
    const afterForeign = baseForeign.sub(discForeign);
    const rate =
      currencyCode === "IDR"
        ? new Prisma.Decimal(1)
        : new Prisma.Decimal(inv.currency_exchange_rate || 0);
    const baseIdr = baseForeign.mul(rate);
    const discIdr = discForeign.mul(rate);
    const afterIdr = afterForeign.mul(rate);

    const productDetail = await prisma.productdetail.create({
      data: {
        invoice_id: body.invoice_id,
        product_id: body.product_id,
        quantity: qty,
        currency_code: currencyCode,
        unit_price_foreign: unitPriceForeign,
        line_total_before_discount_foreign: baseForeign.toDecimalPlaces(6),
        line_discount_amount_foreign: discForeign.toDecimalPlaces(6),
        line_total_foreign: afterForeign.toDecimalPlaces(6),
        line_total_idr: afterIdr.toDecimalPlaces(2),
        total_product_amount: afterIdr.toDecimalPlaces(2), // legacy IDR
        discount_type: discountType,
        discount_value:
          discountValueRaw != null ? Number(discountValueRaw) : null,
        line_total_before_discount: baseIdr.toDecimalPlaces(2),
        line_discount_amount: discIdr.toDecimalPlaces(2),
      },
    });

    // Recompute invoice subtotal/discount/total in IDR
    try {
      const items = await prisma.productdetail.findMany({
        where: { invoice_id: body.invoice_id },
        select: { line_total_idr: true, total_product_amount: true },
      });
      const sumIdr = items.reduce((acc, it) => {
        const v = it.line_total_idr ?? it.total_product_amount ?? 0;
        return acc + Number(v);
      }, 0);
      const invHeader = await prisma.invoices.findUnique({
        where: { invoice_id: body.invoice_id },
        select: { invoice_discount_type: true, invoice_discount_value: true },
      });
      let discInv = 0;
      if (
        invHeader?.invoice_discount_type &&
        invHeader?.invoice_discount_value != null
      ) {
        if (invHeader.invoice_discount_type === "PERCENT") {
          discInv = (sumIdr * Number(invHeader.invoice_discount_value)) / 100;
        } else {
          discInv = Number(invHeader.invoice_discount_value);
        }
        if (discInv > sumIdr) discInv = sumIdr;
      }
      const subtotalAfter = sumIdr - discInv;
      await prisma.invoices.update({
        where: { invoice_id: body.invoice_id },
        data: {
          subtotal_before_invoice_discount: new Prisma.Decimal(
            sumIdr
          ).toDecimalPlaces(2),
          invoice_discount_amount: new Prisma.Decimal(discInv).toDecimalPlaces(
            2
          ),
          subtotal_after_invoice_discount: new Prisma.Decimal(
            subtotalAfter
          ).toDecimalPlaces(2),
          total_amount: new Prisma.Decimal(subtotalAfter).toDecimalPlaces(2),
        },
      });
    } catch {}

    return new Response(JSON.stringify(productDetail), { status: 201 });
  } catch (error) {
    console.error("POST /productdetail error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// GET All ProductDetails
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoice_id");

    // Filter defensively: only include rows whose product still exists
    const validProducts = await prisma.product.findMany({
      select: { product_id: true },
    });
    const validProductIds = validProducts.map((p) => p.product_id);

    const where = {
      product_id: { in: validProductIds },
      ...(invoiceId ? { invoice_id: invoiceId } : {}),
    };

    const productDetails = await prisma.productdetail.findMany({
      where,
      include: {
        invoice: true,
        product: true,
      },
      orderBy: { created_at: "desc" },
    });
    return new Response(JSON.stringify(productDetails), { status: 200 });
  } catch (error) {
    console.error("GET /productdetail error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
