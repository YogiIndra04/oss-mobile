import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET Customer by ID
export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const customer = await prisma.customer.findUnique({
      where: { customer_id: id },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE Customer
export async function PUT(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { customer_name, email, customer_contact, customer_address } = body;

    const updatedCustomer = await prisma.customer.update({
      where: { customer_id: id },
      data: { customer_name, email, customer_contact, customer_address },
    });

    return NextResponse.json(updatedCustomer, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Customer
export async function DELETE(request, context) {
  try {
    const { id } = await context.params;

    await prisma.customer.delete({
      where: { customer_id: id },
    });

    return NextResponse.json(
      { message: "Customer deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
