import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET all company addresses with pagination
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // Ambil query param page & limit
    let page = parseInt(searchParams.get("page") || "1", 10);
    let limit = parseInt(searchParams.get("limit") || "5", 10);

    // Validasi agar tidak negatif atau nol
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    // Hitung total data
    const total = await prisma.company_addresses.count();

    // Ambil data sesuai pagination
    const addresses = await prisma.company_addresses.findMany({
      skip,
      take: limit,
      include: { company: true },
      orderBy: { created_at: "desc" }, // data terbaru dulu
    });

    return NextResponse.json(
      {
        data: addresses,
        pagination: {
          total, // total semua data
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching company addresses:", error);
    return NextResponse.json(
      { error: "Failed to fetch company addresses" },
      { status: 500 }
    );
  }
}

// ✅ CREATE new company address
export async function POST(req) {
  try {
    const body = await req.json();
    const { company_id, address_type, company_address } = body;

    if (!company_id || !address_type || !company_address) {
      return NextResponse.json(
        {
          error:
            "All fields (company_id, address_type, company_address) are required",
        },
        { status: 400 }
      );
    }

    const newAddress = await prisma.company_addresses.create({
      data: {
        company_id,
        address_type,
        company_address,
      },
    });

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating company address:", error);
    return NextResponse.json(
      { error: "Failed to create company address" },
      { status: 500 }
    );
  }
}
