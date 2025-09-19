import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ CREATE Bank
export async function POST(req) {
  try {
    const body = await req.json();
    const newBank = await prisma.bank.create({
      data: {
        bank_id: body.bank_id, // kirim UUID dari client
        bank_name: body.bank_name,
        bank_address: body.bank_address,
        account_number: body.account_number,
        beneficiary_name: body.beneficiary_name,
        beneficiary_address: body.beneficiary_address,
        swift_code: body.swift_code,
      },
    });
    return NextResponse.json(newBank, { status: 201 });
  } catch (err) {
    console.error("❌ Error creating bank:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ READ All Banks
export async function GET() {
  try {
    const banks = await prisma.bank.findMany();
    return NextResponse.json(banks, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching banks:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
