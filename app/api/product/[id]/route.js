import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const normalizeTypeStatus = (value) => {
  if (!value) return "tetap";
  const normalized = value.toString().trim().toLowerCase();
  return normalized.includes("tidak") ? "tidak_tetap" : "tetap";
};

const normalizeItemType = (value) => {
  if (!value) return "product";
  const normalized = value.toString().trim().toLowerCase();
  return normalized === "service" ? "service" : "product";
};

const parseAmount = (value, { defaultValue = 0, forceZero = false } = {}) => {
  if (forceZero) return 0;
  const parsed = Number(value?.toString().replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : defaultValue;
};

const sanitizeString = (value) => {
  if (!value) return null;
  const trimmed = value.toString().trim();
  return trimmed.length ? trimmed : null;
};

const mapProduct = (product) => ({
  product_id: product.product_id,
  product_title: product.product_title,
  product_description: product.product_description,
  product_amount: product.product_amount,
  type_status: product.type_status,
  item_type: product.item_type,
  category_id: product.category_id,
  category_name: product.category?.category_name ?? null,
  created_at: product.created_at,
  updated_at: product.updated_at,
});

const ensureProductExists = async (id) => {
  const product = await prisma.product.findUnique({
    where: { product_id: id },
  });
  if (!product) throw new Error("Produk tidak ditemukan");
  return product;
};

// [GET] Ambil 1 produk berdasarkan ID
export async function GET(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "product_id wajib diisi" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { product_id: id },
      include: { category: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(mapProduct(product), { status: 200 });
  } catch (error) {
    console.error("GET /api/product/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// [PUT] Update produk
export async function PUT(req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "product_id wajib diisi" },
        { status: 400 }
      );
    }

    const existing = await ensureProductExists(id);
    const body = await req.json();

    const nextTitle =
      sanitizeString(body.product_title) ?? existing.product_title;
    const nextDesc = Object.prototype.hasOwnProperty.call(
      body,
      "product_description"
    )
      ? sanitizeString(body.product_description)
      : existing.product_description;
    const nextTypeStatus = normalizeTypeStatus(
      body.type_status ?? existing.type_status
    );
    const nextItemType = normalizeItemType(
      body.item_type ?? existing.item_type
    );
    const nextAmount = parseAmount(body.product_amount, {
      defaultValue: existing.product_amount,
      forceZero: nextTypeStatus === "tidak_tetap",
    });
    const nextCategoryId =
      sanitizeString(body.category_id) ?? existing.category_id;

    const duplicate = await prisma.product.findFirst({
      where: {
        product_id: { not: id },
        category_id: nextCategoryId,
        product_title: nextTitle,
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Produk dengan nama ini sudah ada di kategori ini" },
        { status: 409 }
      );
    }

    const updated = await prisma.product.update({
      where: { product_id: id },
      data: {
        category_id: nextCategoryId,
        product_title: nextTitle,
        product_description: nextDesc,
        product_amount: nextAmount,
        type_status: nextTypeStatus,
        item_type: nextItemType,
        updated_at: new Date(),
      },
      include: { category: true },
    });

    return NextResponse.json(mapProduct(updated), { status: 200 });
  } catch (error) {
    console.error("PUT /api/product/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// [DELETE] Hapus produk
export async function DELETE(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "product_id wajib diisi" },
        { status: 400 }
      );
    }

    await ensureProductExists(id);

    // Prevent deleting products that are already used in invoices (avoid orphans)
    const detailCount = await prisma.productdetail.count({
      where: { product_id: id },
    });
    if (detailCount > 0) {
      return NextResponse.json(
        {
          error: "Produk sudah digunakan pada invoice dan tidak dapat dihapus",
        },
        { status: 409 }
      );
    }

    await prisma.product.delete({
      where: { product_id: id },
    });

    return NextResponse.json(
      { message: "Produk berhasil dihapus" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/product/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
