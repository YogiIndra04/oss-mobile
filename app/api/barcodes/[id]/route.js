import prisma from "@/lib/prisma";
import { uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";

// GET barcode by ID (ensure image path is public URL)
export async function GET(_req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
      include: { invoice: true },
    });
    if (!barcode)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // barcode_image_path di DB diharapkan sudah berupa public URL
    const publicUrl = barcode.barcode_image_path || null;
    return NextResponse.json(
      { ...barcode, barcode_image_path: publicUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE barcode: force link to invoices.pdf_path when attached
export async function PUT(req, { params }) {
  try {
    const body = await req.json();

    const current = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
      select: { invoice_id: true },
    });

    let linkForQr = body.barcode_link || null;
    if (current?.invoice_id) {
      const inv = await prisma.invoices.findUnique({
        where: { invoice_id: current.invoice_id },
        select: { pdf_path: true },
      });
      if (!inv?.pdf_path) {
        return NextResponse.json(
          { error: "Invoice has no pdf_path; cannot update barcode link" },
          { status: 400 }
        );
      }
      const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
      linkForQr = `${origin}/api/files/invoice/${current.invoice_id}`;
    }
    if (!linkForQr) {
      return NextResponse.json(
        { error: "barcode_link is required when barcode has no invoice_id" },
        { status: 400 }
      );
    }

    // Regenerate QR image for resolved link
    const qrBuffer = await QRCode.toBuffer(linkForQr, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });
    const optimized = await sharp(qrBuffer)
      .png({ compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer();
    const nameHint = `barcode-${params.id}.png`;
    const up = await uploadBufferToStorage(
      optimized,
      "uploads",
      "png",
      "image/png",
      nameHint
    );
    const barcodePublicUrl = up?.publicUrl || null;

    const updated = await prisma.barcodes.update({
      where: { barcode_id: params.id },
      data: {
        barcode_link: linkForQr,
        barcode_image_path: barcodePublicUrl,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE barcode: remove image and row
export async function DELETE(_req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
    });
    if (!barcode)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // (storage): hapus file fisik jika endpoint DELETE tersedia di OSS Storage (sejauh ini belum ada)

    await prisma.barcodes.delete({ where: { barcode_id: params.id } });
    return NextResponse.json({ message: "Barcode deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
