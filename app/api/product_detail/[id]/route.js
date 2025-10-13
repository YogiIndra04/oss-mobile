import prisma from "@/lib/prisma";

// ✅ GET by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;
    // Fetch without includes first to avoid Prisma error on broken relations
    const base = await prisma.productdetail.findUnique({
      where: { product_detail_id: id },
      select: {
        product_detail_id: true,
        invoice_id: true,
        product_id: true,
        quantity: true,
        total_product_amount: true,
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

    // Fetch related entities separately; product may be null if orphan
    const [invoice, product] = await Promise.all([
      prisma.invoices.findUnique({ where: { invoice_id: base.invoice_id } }),
      prisma.product.findUnique({ where: { product_id: base.product_id } }),
    ]);

    return new Response(
      JSON.stringify({
        ...base,
        invoice,
        product,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// ✅ UPDATE
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const updated = await prisma.productdetail.update({
      where: { product_detail_id: id },
      data: {
        quantity: body.quantity,
        total_product_amount: body.total_product_amount,
        invoice_id: body.invoice_id,
        product_id: body.product_id,
        updated_at: new Date(), // 👍 biar timestamp ikut berubah
      },
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (error) {
    console.error("PUT /productdetail/:id error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// ✅ DELETE
export async function DELETE(req, { params }) {
  try {
    const { id } = params;
    await prisma.productdetail.delete({
      where: { product_detail_id: id },
    });
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
