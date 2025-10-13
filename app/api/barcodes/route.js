import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// CREATE barcode image in Supabase and record in DB
export async function POST(req) {
  try {
    const body = await req.json();
    const { invoice_id, document_type, barcode_link } = body;

    if (!document_type) {
      return NextResponse.json(
        { error: "document_type is required" },
        { status: 400 }
      );
    }

    // 1) Generate QR code PNG buffer from the link
    const qrBuffer = await QRCode.toBuffer(barcode_link, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // 2) Upload to Supabase storage (bucket: invoice)
    const fileName = `barcodes/${invoice_id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("invoice")
      .upload(fileName, qrBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // 3) Resolve public URL
    const { data: publicRes } = supabase.storage
      .from("invoice")
      .getPublicUrl(fileName);
    const publicUrl = publicRes?.publicUrl || null;

    // 4) Determine linkForQr: if invoice_id present, force to invoice.pdf_path; else use provided barcode_link
    let linkForQr = barcode_link || null;
    let inv = null;
    if (invoice_id) {
      inv = await prisma.invoices.findUnique({
        where: { invoice_id },
        select: { pdf_path: true },
      });
      if (!inv?.pdf_path) {
        return NextResponse.json(
          { error: "Invoice has no pdf_path; cannot create barcode for it" },
          { status: 400 }
        );
      }
      linkForQr = inv.pdf_path;
    }
    if (!linkForQr) {
      return NextResponse.json(
        { error: "barcode_link is required when invoice_id is not provided" },
        { status: 400 }
      );
    }

    // 5) Create DB record
    const barcode = await prisma.barcodes.create({
      data: {
        invoice_id,
        document_type,
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
