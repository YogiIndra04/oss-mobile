// import prisma from "@/lib/prisma";
// import { generateAndSaveBarcode } from "@/lib/utils/barcodeHandler";
// import { NextResponse } from "next/server";

// // ✅ CREATE BARCODE (manual create, jika perlu)
// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const { invoice_id, document_type, barcode_link } = body;

//     // Generate & simpan barcode image
//     const filePath = await generateAndSaveBarcode(
//       barcode_link,
//       `barcode-${invoice_id}`
//     );

//     const barcode = await prisma.barcodes.create({
//       data: {
//         invoice_id,
//         document_type,
//         barcode_link,
//         barcode_image_path: filePath,
//       },
//     });

//     return NextResponse.json(barcode, { status: 201 });
//   } catch (error) {
//     console.error("POST /barcodes error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // ✅ READ ALL
// export async function GET() {
//   try {
//     const barcodes = await prisma.barcodes.findMany({
//       include: { invoice: true },
//       orderBy: { created_at: "desc" },
//     });
//     return NextResponse.json(barcodes);
//   } catch (error) {
//     console.error("GET /barcodes error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// ✅ CREATE BARCODE (manual create, jika perlu)
export async function POST(req) {
  try {
    const body = await req.json();
    const { invoice_id, document_type, barcode_link } = body;

    // 1. Generate QRCode buffer
    const qrBuffer = await QRCode.toBuffer(barcode_link, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // 2. Upload ke Supabase
    const fileName = `barcodes/${invoice_id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("invoice")
      .upload(fileName, qrBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 3. Simpan ke DB
    const barcode = await prisma.barcodes.create({
      data: {
        invoice_id,
        document_type,
        barcode_link, // biasanya ini URL PDF invoice
        barcode_image_path: fileName, // path Supabase, bukan lokal
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

    // bikin public URL untuk setiap barcode image
    const barcodesWithUrl = barcodes.map((b) => {
      const { data } = supabase.storage
        .from("invoice")
        .getPublicUrl(b.barcode_image_path);

      return {
        ...b,
        barcode_public_url: data.publicUrl,
      };
    });

    return NextResponse.json(barcodesWithUrl);
  } catch (error) {
    console.error("GET /barcodes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
