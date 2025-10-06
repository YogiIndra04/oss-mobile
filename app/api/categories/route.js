import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

//
// ✅ [GET] Ambil semua kategori + produk di dalamnya
//
export async function GET() {
  try {
    const categories = await prisma.categories.findMany({
      include: {
        products: true, // ambil produk di setiap kategori
      },
      orderBy: { created_at: "desc" },
    });

    const formatted = categories.map((cat) => ({
      category_id: cat.category_id,
      category_name:
        cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1),
      category_description: cat.category_description,
      total_products: cat.products.length,
      created_at: cat.created_at,
      updated_at: cat.updated_at,
      products: cat.products.map((p) => ({
        product_id: p.product_id,
        product_title: p.product_title,
        product_amount: p.product_amount,
        item_type: p.item_type,
        type_status: p.type_status,
        created_at: p.created_at,
      })),
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data kategori", details: error.message },
      { status: 500 }
    );
  }
}

//
// ✅ [POST] Tambah kategori baru
//
export async function POST(req) {
  try {
    const body = await req.json();
    const { category_name, category_description } = body;

    if (!category_name || category_name.trim() === "") {
      return NextResponse.json(
        { error: "Nama kategori wajib diisi." },
        { status: 400 }
      );
    }

    const newCategory = await prisma.categories.create({
      data: {
        category_name: category_name.trim().toLowerCase(),
        category_description: category_description || null,
      },
    });

    return NextResponse.json(
      { message: "Kategori berhasil dibuat.", data: newCategory },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan kategori", details: error.message },
      { status: 500 }
    );
  }
}
