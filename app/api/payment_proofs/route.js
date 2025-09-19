import prisma from "@/lib/prisma";
import { saveUploadedFile } from "@/lib/utils/fileHandler";
import { NextResponse } from "next/server";

// ✅ CREATE
export async function POST(req) {
  try {
    const formData = await req.formData();
    const invoice_id = formData.get("invoice_id");
    const proof_status = formData.get("proof_status") || "Pending";
    const proof_title = formData.get("proof_title");
    const proof_description = formData.get("proof_description");
    const proof_amount = formData.get("proof_amount");
    const uploaded_by_user_id = formData.get("uploaded_by_user_id");
    const proof_image_path = formData.get("proof_image_path"); // ✅ FIX disini

    // Simpan file
    const filePath = await saveUploadedFile(
      proof_image_path,
      "uploads/payment_proofs"
    );

    const newProof = await prisma.paymentproofs.create({
      data: {
        invoice_id,
        proof_status,
        proof_title,
        proof_description,
        proof_amount: proof_amount ? parseFloat(proof_amount) : 0, // ✅ biar aman
        uploaded_by_user_id,
        proof_image_path: filePath,
      },
    });

    return NextResponse.json(newProof, { status: 201 });
  } catch (error) {
    console.error("POST /payment_proofs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ READ ALL
export async function GET() {
  try {
    const proofs = await prisma.paymentproofs.findMany({
      include: {
        invoice: true,
        uploadedBy: true, // ✅ sesuai schema relasi kamu
      },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(proofs);
  } catch (error) {
    console.error("GET /payment_proofs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
