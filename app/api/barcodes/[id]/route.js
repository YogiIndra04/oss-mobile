// import prisma from "@/lib/prisma";
// import { NextResponse } from "next/server";

// // ✅ GET detail
// export async function GET(req, { params }) {
//   try {
//     const barcode = await prisma.barcodes.findUnique({
//       where: { barcode_id: params.id },
//       include: { invoice: true },
//     });

//     if (!barcode)
//       return NextResponse.json({ error: "Not found" }, { status: 404 });

//     return NextResponse.json(barcode);
//   } catch (error) {
//     console.error("GET /barcodes/:id error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // ✅ UPDATE
// export async function PUT(req, { params }) {
//   try {
//     const body = await req.json();

//     const updated = await prisma.barcodes.update({
//       where: { barcode_id: params.id },
//       data: {
//         document_type: body.document_type,
//         barcode_link: body.barcode_link,
//         barcode_image_path: body.barcode_image_path,
//       },
//     });

//     return NextResponse.json(updated);
//   } catch (error) {
//     console.error("PUT /barcodes/:id error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // ✅ DELETE
// export async function DELETE(req, { params }) {
//   try {
//     await prisma.barcodes.delete({
//       where: { barcode_id: params.id },
//     });
//     return NextResponse.json({ message: "Barcode deleted" });
//   } catch (error) {
//     console.error("DELETE /barcodes/:id error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// ✅ GET detail barcode by ID
export async function GET(req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
      include: { invoice: true },
    });

    if (!barcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // tambahkan public URL dari Supabase
    const { data: publicData } = supabase.storage
      .from("invoice")
      .getPublicUrl(barcode.barcode_image_path);

    return NextResponse.json({
      ...barcode,
      barcode_public_url: publicData.publicUrl,
    });
  } catch (error) {
    console.error("GET /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE barcode
export async function PUT(req, { params }) {
  try {
    const body = await req.json();

    // kalau barcode_link diubah → regenerate QR PNG & upload ke Supabase
    let barcodePath = body.barcode_image_path;

    if (body.barcode_link) {
      const qrBuffer = await QRCode.toBuffer(body.barcode_link, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      barcodePath = `barcodes/${params.id}.png`;

      await supabase.storage.from("invoice").upload(barcodePath, qrBuffer, {
        contentType: "image/png",
        upsert: true, // overwrite
      });
    }

    const updated = await prisma.barcodes.update({
      where: { barcode_id: params.id },
      data: {
        document_type: body.document_type,
        barcode_link: body.barcode_link,
        barcode_image_path: barcodePath,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE barcode
export async function DELETE(req, { params }) {
  try {
    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: params.id },
    });

    if (!barcode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // hapus file di Supabase
    if (barcode.barcode_image_path) {
      await supabase.storage
        .from("invoice")
        .remove([barcode.barcode_image_path]);
    }

    await prisma.barcodes.delete({
      where: { barcode_id: params.id },
    });

    return NextResponse.json({ message: "Barcode deleted" });
  } catch (error) {
    console.error("DELETE /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
