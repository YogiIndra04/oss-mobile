import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET all company addresses
export async function GET() {
  try {
    const addresses = await prisma.company_addresses.findMany({
      include: { company: true }, // biar bisa lihat detail company
    });
    return NextResponse.json(addresses, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ CREATE new company address
export async function POST(req) {
  try {
    const body = await req.json();
    const { company_id, address_type, company_address } = body;

    const newAddress = await prisma.company_addresses.create({
      data: {
        company_id,
        address_type,
        company_address,
      },
    });

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
