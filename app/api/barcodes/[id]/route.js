import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// GET barcode by ID (ensure image path is public URL)
export async function GET(_req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
      include: { invoice: true },
    });
    if (!barcode) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let publicUrl = barcode.barcode_image_path || null;
    if (publicUrl && !publicUrl.startsWith("http")) {
      const { data: pub } = supabase.storage.from("invoice").getPublicUrl(publicUrl);
      publicUrl = pub?.publicUrl || null;
    }
    return NextResponse.json({ ...barcode, barcode_image_path: publicUrl }, { status: 200 });
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
      linkForQr = inv.pdf_path;
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
    const key = `barcodes/${params.id}.png`;
    await supabase.storage.from("invoice").upload(key, qrBuffer, {
      contentType: "image/png",
      upsert: true,
    });
    const { data: pub } = supabase.storage.from("invoice").getPublicUrl(key);
    const barcodePublicUrl = pub?.publicUrl || key;

    const updated = await prisma.barcodes.update({
      where: { barcode_id: params.id },
      data: {
        document_type: body.document_type,
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
    if (!barcode) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (barcode.barcode_image_path) {
      const relative = barcode.barcode_image_path.includes("/invoice/")
        ? barcode.barcode_image_path.split("/invoice/")[1]
        : barcode.barcode_image_path;
      await supabase.storage.from("invoice").remove([relative]);
    }

    await prisma.barcodes.delete({ where: { barcode_id: params.id } });
    return NextResponse.json({ message: "Barcode deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

