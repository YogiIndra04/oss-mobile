import prisma from "@/lib/prisma";

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
      return new Response(
        JSON.stringify({ error: "Produk tidak ditemukan" }),
        { status: 404 }
      );
    }
    const productDetail = await prisma.productdetail.create({
      data: {
        invoice_id: body.invoice_id,
        product_id: body.product_id,
        quantity: body.quantity,
        total_product_amount: body.total_product_amount,
      },
    });
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
    });
    return new Response(JSON.stringify(productDetails), { status: 200 });
  } catch (error) {
    console.error("GET /productdetail error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
