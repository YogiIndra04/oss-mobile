import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ✅ GET by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const address = await prisma.company_addresses.findUnique({
      where: { address_id: id },
      include: { company: true },
    });

    if (!address) {
      return NextResponse.json({ message: "Address not found" }, { status: 404 });
    }

    return NextResponse.json(address, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE by ID
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();

    const updatedAddress = await prisma.company_addresses.update({
      where: { address_id: id },
      data: body,
    });

    return NextResponse.json(updatedAddress, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE by ID
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    await prisma.company_addresses.delete({
      where: { address_id: id },
    });

    return NextResponse.json({ message: "Address deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
