import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET all products
export async function GET() {
  try {
    const products = await prisma.product.findMany();
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error("❌ GET products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ CREATE product
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      type_status,
      item_type,
      product_title,
      product_description,
      product_amount,
    } = body;

    if (!type_status || !item_type || !product_title) {
      return NextResponse.json(
        {
          error: "type_status, item_type, and product_title are required",
        },
        { status: 400 }
      );
    }

    const newProduct = await prisma.product.create({
      data: {
        type_status,
        item_type,
        product_title,
        product_description,
        product_amount: product_amount ?? 0, // ✅ fallback ke 0
      },
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error("❌ POST product error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
