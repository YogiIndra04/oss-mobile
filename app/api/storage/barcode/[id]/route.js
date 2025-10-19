import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET barcode by ID (returns stored public URL)
export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: id },
      include: { invoice: true },
    });
    if (!barcode) return NextResponse.json({ error: "Barcode not found" }, { status: 404 });

    const publicUrl = barcode.barcode_image_path || null;
    return NextResponse.json(
      { ...barcode, barcode_public_url: publicUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /storage/barcode/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

