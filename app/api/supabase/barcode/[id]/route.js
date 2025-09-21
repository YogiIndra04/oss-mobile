import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET barcode by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;

    const barcode = await prisma.barcodes.findUnique({
      where: { barcode_id: id }, // kalau mau by invoice_id => ganti jadi { invoice_id: id }
      include: {
        invoice: true, // biar tahu invoice terkait
      },
    });

    if (!barcode) {
      return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
    }

    // ✅ generate public URL dari Supabase untuk barcode image
    let publicUrl = null;
    if (barcode.barcode_image_path) {
      const { data } = supabase.storage
        .from("invoice")
        .getPublicUrl(barcode.barcode_image_path);
      publicUrl = data?.publicUrl;
    }

    return NextResponse.json(
      {
        ...barcode,
        barcode_public_url: publicUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /barcodes/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
