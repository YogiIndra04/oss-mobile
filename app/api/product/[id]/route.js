import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET product by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { product_id: id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    console.error("❌ GET product by ID error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE product
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      type_status,
      item_type,
      product_title,
      product_description,
      product_amount,
    } = body;

    const updatedProduct = await prisma.product.update({
      where: { product_id: id },
      data: {
        type_status,
        item_type,
        product_title,
        product_description,
        product_amount,
      },
    });

    return NextResponse.json(updatedProduct, { status: 200 });
  } catch (error) {
    console.error("❌ UPDATE product error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE product
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    await prisma.product.delete({
      where: { product_id: id },
    });

    return NextResponse.json(
      { message: "Product deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ DELETE product error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
