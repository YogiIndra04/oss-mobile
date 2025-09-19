import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET Invoice by ID
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice, { status: 200 });
  } catch (error) {
    console.error("GET /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE Invoice
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updatedInvoice = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        ...body,
        invoice_creation_date: body.invoice_creation_date
          ? new Date(body.invoice_creation_date)
          : undefined,
        payment_date: body.payment_date
          ? new Date(body.payment_date)
          : undefined,
        completion_date: body.completion_date
          ? new Date(body.completion_date)
          : undefined,
        due_date: body.due_date ? new Date(body.due_date) : undefined,
        currency_exchange_rate_date: body.currency_exchange_rate_date
          ? new Date(body.currency_exchange_rate_date)
          : undefined,
      },
    });

    return NextResponse.json(updatedInvoice, { status: 200 });
  } catch (error) {
    console.error("PUT /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Invoice
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    await prisma.invoices.delete({
      where: { invoice_id: id },
    });

    return NextResponse.json(
      { message: "Invoice deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
