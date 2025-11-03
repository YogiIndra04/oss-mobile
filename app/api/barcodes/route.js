import prisma from "@/lib/prisma";
import { uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";

// CREATE barcode image in storage and record in DB
export async function POST(req) {
  try {
    const body = await req.json();
    const { invoice_id, barcode_link } = body;

    // 1) Resolve the final link that must be encoded into the QR
    let linkForQr = barcode_link || null;
    if (invoice_id) {
      const inv = await prisma.invoices.findUnique({
        where: { invoice_id },
        select: { pdf_path: true },
      });
      if (!inv?.pdf_path) {
        return NextResponse.json(
          { error: "Invoice has no pdf_path; cannot create barcode for it" },
          { status: 400 }
        );
      }
      // Build stable proxy URL so QR always points to one canonical path
      const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
      linkForQr = `${origin}/api/files/invoice/${invoice_id}`;
    }
    if (!linkForQr) {
      return NextResponse.json(
        { error: "barcode_link is required when invoice_id is not provided" },
        { status: 400 }
      );
    }

    // 2) Generate QR code PNG buffer from the resolved link
    const qrBuffer = await QRCode.toBuffer(linkForQr, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // Optimize PNG to make file smaller
    const optimized = await sharp(qrBuffer)
      .png({ compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();

    // 3) Upload to Storage OSS (single 'uploads' folder) with a clear name
    const nameHint = `barcode-${invoice_id || "no-invoice"}.png`;
    const up = await uploadBufferToStorage(
      optimized,
      "uploads",
      "png",
      "image/png",
      nameHint
    );
    const publicUrl = up?.publicUrl || null;

    // 4) Create DB record with the same link that was encoded in QR
    const barcode = await prisma.barcodes.create({
      data: {
        invoice_id,
        barcode_link: linkForQr,
        barcode_image_path: publicUrl,
      },
    });

    return NextResponse.json(barcode, { status: 201 });
  } catch (error) {
    console.error("POST /barcodes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// READ all barcodes
export async function GET() {
  try {
    const barcodes = await prisma.barcodes.findMany({
      include: { invoice: true },
      orderBy: { created_at: "desc" },
    });

    // barcode_image_path already stored as a public URL
    const barcodesWithUrl = barcodes.map((b) => ({
      ...b,
      barcode_image_path: b.barcode_image_path,
    }));

    return NextResponse.json(barcodesWithUrl, { status: 200 });
  } catch (error) {
    console.error("GET /barcodes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
