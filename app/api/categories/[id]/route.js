import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

//
// ✅ [GET] Ambil detail kategori berdasarkan ID
//
export async function GET(req, { params }) {
  try {
    const { id } = params;

    const category = await prisma.categories.findUnique({
      where: { category_id: id },
      include: { products: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    const formatted = {
      category_id: category.category_id,
      category_name:
        category.category_name.charAt(0).toUpperCase() +
        category.category_name.slice(1),
      category_description: category.category_description,
      total_products: category.products.length,
      created_at: category.created_at,
      updated_at: category.updated_at,
      products: category.products.map((p) => ({
        product_id: p.product_id,
        product_title: p.product_title,
        product_amount: p.product_amount,
        item_type: p.item_type,
        type_status: p.type_status,
        created_at: p.created_at,
      })),
    };

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("GET /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil kategori", details: error.message },
      { status: 500 }
    );
  }
}

//
// ✅ [PUT] Update kategori berdasarkan ID
//
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { category_name, category_description } = body;

    const existing = await prisma.categories.findUnique({
      where: { category_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = await prisma.categories.update({
      where: { category_id: id },
      data: {
        category_name:
          category_name?.trim().toLowerCase() || existing.category_name,
        category_description:
          category_description ?? existing.category_description,
      },
    });

    return NextResponse.json(
      { message: "Kategori berhasil diperbarui.", data: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui kategori", details: error.message },
      { status: 500 }
    );
  }
}

//
// ✅ [DELETE] Hapus kategori berdasarkan ID
//
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    const existing = await prisma.categories.findUnique({
      where: { category_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    // Hapus kategori — jika FK pakai ON DELETE CASCADE, produk ikut terhapus otomatis
    const deleted = await prisma.categories.delete({
      where: { category_id: id },
    });

    return NextResponse.json(
      { message: "Kategori berhasil dihapus.", data: deleted },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus kategori", details: error.message },
      { status: 500 }
    );
  }
}
