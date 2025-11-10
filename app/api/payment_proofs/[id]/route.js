import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";
import { recomputeUnpaidAndStatus } from "@/lib/invoiceRecompute";

// ✅ GET detail
export async function GET(req, { params }) {
  try {
    const proof = await prisma.paymentproofs.findUnique({
      where: { payment_proof_id: params.id },
    });

    if (!proof)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(proof);
  } catch (error) {
    console.error("GET /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE
export async function PUT(req, { params }) {
  try {
    const formData = await req.formData();
    const proof_status = formData.get("proof_status");
    const proof_title = formData.get("proof_title");
    const proof_description = formData.get("proof_description");
    const proof_amount = formData.get("proof_amount");
    const proof_date = formData.get("proof_date");
    const proof_image = formData.get("proof_image");

    const oldProof = await prisma.paymentproofs.findUnique({
      where: { payment_proof_id: params.id },
    });

    if (!oldProof)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    let filePath = oldProof.proof_image_path;

    // Jika ada gambar baru → replace
    if (proof_image && proof_image.name) {
      const ext = (proof_image.name.split(".").pop() || "png").toLowerCase();
      const safeId = String(params.id).replace(/[^a-z0-9_-]+/gi, "-");
      const nameHint = `payment_proof-${safeId}-${Date.now()}.${ext}`;
      const uploaded = await uploadToStorage(proof_image, "uploads", nameHint);
      filePath = uploaded?.publicUrl || uploaded?.path || filePath;
    }

    const updatedProof = await prisma.paymentproofs.update({
      where: { payment_proof_id: params.id },
      data: {
        proof_status: proof_status || oldProof.proof_status,
        proof_title: proof_title ?? oldProof.proof_title,
        proof_description: proof_description ?? oldProof.proof_description,
        proof_amount: proof_amount
          ? parseFloat(proof_amount)
          : oldProof.proof_amount,
        proof_date: proof_date ? new Date(proof_date) : oldProof.proof_date,
        proof_image_path: filePath,
      },
    });

    // Recompute unpaid & payment_status via helper
    try { await recomputeUnpaidAndStatus(oldProof.invoice_id); } catch (e) {
      console.error("Recompute invoice after payment proof update failed:", e);
    }

    return NextResponse.json(updatedProof);
  } catch (error) {
    console.error("PUT /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE
export async function DELETE(req, { params }) {
  try {
    const proof = await prisma.paymentproofs.findUnique({
      where: { payment_proof_id: params.id },
    });

    if (!proof)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.paymentproofs.delete({
      where: { payment_proof_id: params.id },
    });

    // Recompute setelah delete via helper
    try { await recomputeUnpaidAndStatus(proof.invoice_id); } catch (e) {
      console.error("Recompute invoice after payment proof delete failed:", e);
    }

    return NextResponse.json({ message: "Payment proof deleted" });
  } catch (error) {
    console.error("DELETE /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
