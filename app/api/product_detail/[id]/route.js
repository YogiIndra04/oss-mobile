import prisma from "@/lib/prisma";
import { computeLine } from "@/lib/discount";

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
      return new Response(JSON.stringify({ error: "ProductDetail not found" }), { status: 404 });
    }

    const [invoice, product] = await Promise.all([
      prisma.invoices.findUnique({ where: { invoice_id: base.invoice_id } }),
      prisma.product.findUnique({ where: { product_id: base.product_id } }),
    ]);

    return new Response(
      JSON.stringify({ ...base, invoice, product }),
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
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
      return new Response(JSON.stringify({ error: "ProductDetail not found" }), { status: 404 });
    }

    const nextInvoiceId = body.invoice_id || existing.invoice_id;
    const nextProductId = body.product_id || existing.product_id;
    const qty = body.quantity != null ? Number(body.quantity) : existing.quantity;

    const prod = await prisma.product.findUnique({ where: { product_id: nextProductId } });
    if (!prod) {
      return new Response(JSON.stringify({ error: "Produk tidak ditemukan" }), { status: 404 });
    }
    const unitPrice = Number(prod.product_amount);
    const discountType = Object.prototype.hasOwnProperty.call(body, 'discount_type') ? body.discount_type : existing.discount_type;
    const discountValue = Object.prototype.hasOwnProperty.call(body, 'discount_value')
      ? (body.discount_value != null ? Number(body.discount_value) : null)
      : existing.discount_value;

    const c = computeLine({
      quantity: qty,
      unitPrice,
      discountType: discountType || null,
      discountValue: discountValue != null ? Number(discountValue) : null,
    });

    const updated = await prisma.productdetail.update({
      where: { product_detail_id: id },
      data: {
        invoice_id: nextInvoiceId,
        product_id: nextProductId,
        quantity: qty,
        total_product_amount: c.line_total_after_discount,
        discount_type: discountType || null,
        discount_value: discountValue != null ? Number(discountValue) : null,
        line_total_before_discount: c.line_total_before_discount,
        line_discount_amount: c.line_discount_amount,
        updated_at: new Date(),
      },
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (error) {
    console.error("PUT /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// DELETE
export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    await prisma.productdetail.delete({ where: { product_detail_id: id } });
    return new Response(JSON.stringify({ message: "Deleted successfully" }), { status: 200 });
  } catch (error) {
    console.error("DELETE /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

