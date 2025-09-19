import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET detail
export async function GET(req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
      include: { invoice: true },
    });

    if (!barcode)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(barcode);
  } catch (error) {
    console.error("GET /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE
export async function PUT(req, { params }) {
  try {
    const body = await req.json();

    const updated = await prisma.barcodes.update({
      where: { barcode_id: params.id },
      data: {
        document_type: body.document_type,
        barcode_link: body.barcode_link,
        barcode_image_path: body.barcode_image_path,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE
export async function DELETE(req, { params }) {
  try {
    await prisma.barcodes.delete({
      where: { barcode_id: params.id },
    });
    return NextResponse.json({ message: "Barcode deleted" });
  } catch (error) {
    console.error("DELETE /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
