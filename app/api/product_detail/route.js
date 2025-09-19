import prisma from "@/lib/prisma";

// ✅ CREATE ProductDetail
export async function POST(req) {
  try {
    const body = await req.json();
    const productDetail = await prisma.productDetail.create({
      data: {
        invoice_id: body.invoice_id,
        product_id: body.product_id,
        quantity: body.quantity,
        total_product_amount: body.total_product_amount,
      },
    });
    return new Response(JSON.stringify(productDetail), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

// ✅ GET All ProductDetails
export async function GET() {
  try {
    const productDetails = await prisma.productDetail.findMany({
      include: {
        invoice: true,
        product: true,
      },
    });
    return new Response(JSON.stringify(productDetails), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
