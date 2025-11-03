import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET All Customers
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { created_at: "desc" } });
    return NextResponse.json(customers, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ CREATE Customer
export async function POST(request) {
  try {
    const body = await request.json();
    const { customer_name, email, customer_contact, customer_address } = body;

    if (!customer_name) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const newCustomer = await prisma.customer.create({
      data: {
        customer_name,
        email,
        customer_contact,
        customer_address,
      },
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
