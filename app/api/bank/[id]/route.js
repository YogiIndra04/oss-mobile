import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET Bank by ID
export async function GET(req, { params }) {
  try {
    const bank = await prisma.bank.findUnique({
      where: { bank_id: params.id },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    return NextResponse.json(bank, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching bank:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ UPDATE Bank
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    const updatedBank = await prisma.bank.update({
      where: { bank_id: params.id },
      data: {
        bank_name: body.bank_name,
        bank_address: body.bank_address,
        account_number: body.account_number,
        beneficiary_name: body.beneficiary_name,
        beneficiary_address: body.beneficiary_address,
        swift_code: body.swift_code,
      },
    });

    return NextResponse.json(updatedBank, { status: 200 });
  } catch (err) {
    console.error("❌ Error updating bank:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ DELETE Bank
export async function DELETE(req, { params }) {
  try {
    await prisma.bank.delete({
      where: { bank_id: params.id },
    });

    return NextResponse.json({ message: "Bank deleted" }, { status: 200 });
  } catch (err) {
    console.error("❌ Error deleting bank:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
