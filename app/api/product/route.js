import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// Normalisasi status tipe (tetap / tidak_tetap)
const normalizeTypeStatus = (value) => {
  if (!value) return "tetap";
  const normalized = value.toString().trim().toLowerCase();
  return normalized.includes("tidak") ? "tidak_tetap" : "tetap";
};

// Normalisasi tipe item (product / service)
const normalizeItemType = (value) => {
  if (!value) return "product";
  const normalized = value.toString().trim().toLowerCase();
  return normalized === "service" ? "service" : "product";
};

// Normalisasi currency (default IDR)
const normalizeCurrency = (value) => {
  if (!value) return "IDR";
  const code = value.toString().trim().toUpperCase();
  // Ambil 3-10 karakter A-Z/0-9/_ sebagai guard sederhana
  const safe = code.replace(/[^A-Z0-9_]/g, "").slice(0, 10);
  return safe || "IDR";
};

// Parsing angka amount
const parseAmount = (value, { defaultValue = 0, forceZero = false } = {}) => {
  if (forceZero) return 0;
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value.toString().replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed))
    : defaultValue;
};

// Sanitasi string agar tidak ada whitespace kosong
const sanitizeString = (value) => {
  if (!value) return null;
  const trimmed = value.toString().trim();
  return trimmed.length ? trimmed : null;
};

// Bentuk respons produk konsisten untuk FE
const mapProduct = (product) => ({
  product_id: product.product_id,
  product_title: product.product_title,
  product_description: product.product_description,
  product_currency: product.product_currency,
  product_amount: product.product_amount,
  type_status: product.type_status,
  item_type: product.item_type,
  category_id: product.category_id,
  category_name: product.category?.category_name ?? null,
  created_at: product.created_at,
  updated_at: product.updated_at,
});

// [GET] Ambil semua produk (filter opsional by category)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryParam =
      sanitizeString(searchParams.get("category")) ??
      sanitizeString(searchParams.get("category_id"));

    const where = categoryParam ? { category_id: categoryParam } : {};

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(products.map(mapProduct), { status: 200 });
  } catch (error) {
    console.error("GET /api/product error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error.message },
      { status: 500 }
    );
  }
}

// [POST] Tambah produk baru
export async function POST(req) {
  try {
    const body = await req.json();
    const rawCategoryId = sanitizeString(body.category_id);
    const trimmedTitle = sanitizeString(body.product_title);

    if (!rawCategoryId) {
      return NextResponse.json(
        { error: "category_id wajib diisi" },
        { status: 400 }
      );
    }
    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "product_title wajib diisi" },
        { status: 400 }
      );
    }

    const category = await prisma.categories.findUnique({
      where: { category_id: rawCategoryId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Kategori tidak ditemukan" },
        { status: 404 }
      );
    }

    const normalizedTypeStatus = normalizeTypeStatus(body.type_status);
    const normalizedItemType = normalizeItemType(body.item_type);
    const sanitizedDescription = sanitizeString(body.product_description);
    const normalizedCurrency = normalizeCurrency(body.product_currency);

    const amount = parseAmount(body.product_amount, {
      defaultValue: 0,
      forceZero: normalizedTypeStatus === "tidak_tetap",
    });

    const existing = await prisma.product.findFirst({
      where: {
        category_id: rawCategoryId,
        product_title: trimmedTitle,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Produk dengan nama ini sudah ada di kategori ini" },
        { status: 409 }
      );
    }

    const newProduct = await prisma.product.create({
      data: {
        category_id: rawCategoryId,
        product_title: trimmedTitle,
        product_description: sanitizedDescription,
        product_currency: normalizedCurrency,
        product_amount: amount,
        type_status: normalizedTypeStatus,
        item_type: normalizedItemType,
      },
      include: { category: true },
    });

    return NextResponse.json(mapProduct(newProduct), { status: 201 });
  } catch (error) {
    console.error("POST /api/product error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan produk", details: error.message },
      { status: 500 }
    );
  }
}
