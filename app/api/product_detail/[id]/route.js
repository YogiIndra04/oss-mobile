import prisma from "@/lib/prisma";

// ✅ GET by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const productDetail = await prisma.productdetail.findUnique({
      where: { product_detail_id: id },
      include: {
        invoice: true,
        product: true,
      },
    });
    if (!productDetail) {
      return new Response(
        JSON.stringify({ error: "ProductDetail not found" }),
        { status: 404 }
      );
    }
    return new Response(JSON.stringify(productDetail), { status: 200 });
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
