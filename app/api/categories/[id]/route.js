import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

//
// ✅ [GET] Ambil detail kategori berdasarkan ID
//
export async function GET(_req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Parameter ID kategori wajib diisi." },
        { status: 400 }
      );
    }

    const category = await prisma.categories.findUnique({
      where: { category_id: id },
      include: {
        products: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    const formatted = {
      category_id: category.category_id,
      category_name: category.category_name, // 💡 biarkan apa adanya
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
        updated_at: p.updated_at,
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

    if (!id) {
      return NextResponse.json(
        { error: "Parameter ID kategori wajib diisi." },
        { status: 400 }
      );
    }

    // Pastikan kategori ada
    const existing = await prisma.categories.findUnique({
      where: { category_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    // Validasi ringan: nama kategori tidak boleh kosong string
    if (category_name !== undefined && category_name.trim() === "") {
      return NextResponse.json(
        { error: "Nama kategori tidak boleh kosong." },
        { status: 400 }
      );
    }

    const updated = await prisma.categories.update({
      where: { category_id: id },
      data: {
        // 💡 tidak diubah ke huruf besar/kecil — disimpan sesuai input frontend
        category_name:
          category_name !== undefined
            ? category_name.trim()
            : existing.category_name,
        category_description:
          category_description !== undefined
            ? typeof category_description === "string"
              ? category_description.trim() || null
              : null
            : existing.category_description,
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
export async function DELETE(_req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Parameter ID kategori wajib diisi." },
        { status: 400 }
      );
    }

    const existing = await prisma.categories.findUnique({
      where: { category_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan." },
        { status: 404 }
      );
    }

    // Jika foreign key product.category_id pakai ON DELETE CASCADE,
    // maka produk dalam kategori ini ikut terhapus otomatis.
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
