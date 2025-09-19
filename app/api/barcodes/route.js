import prisma from "@/lib/prisma";
import { generateAndSaveBarcode } from "@/lib/utils/barcodeHandler";
import { NextResponse } from "next/server";

// ✅ CREATE BARCODE (manual create, jika perlu)
export async function POST(req) {
  try {
    const body = await req.json();
    const { invoice_id, document_type, barcode_link } = body;

    // Generate & simpan barcode image
    const filePath = await generateAndSaveBarcode(
      barcode_link,
      `barcode-${invoice_id}`
    );

    const barcode = await prisma.barcodes.create({
      data: {
        invoice_id,
        document_type,
        barcode_link,
        barcode_image_path: filePath,
      },
    });

    return NextResponse.json(barcode, { status: 201 });
  } catch (error) {
    console.error("POST /barcodes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ READ ALL
export async function GET() {
  try {
    const barcodes = await prisma.barcodes.findMany({
      include: { invoice: true },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(barcodes);
  } catch (error) {
    console.error("GET /barcodes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
