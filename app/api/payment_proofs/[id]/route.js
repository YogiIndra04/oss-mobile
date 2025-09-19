import prisma from "@/lib/prisma";
import { deleteFileIfExists, saveUploadedFile } from "@/lib/utils/fileHandler";
import { NextResponse } from "next/server";

// ✅ GET detail
export async function GET(req, { params }) {
  try {
    const proof = await prisma.paymentproofs.findUnique({
      where: { payment_proof_id: params.id },
      include: { invoice: true, uploadedBy: true },
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
    const proof_image = formData.get("proof_image");

    const oldProof = await prisma.paymentproofs.findUnique({
      where: { payment_proof_id: params.id },
    });

    if (!oldProof)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    let filePath = oldProof.proof_image_path;

    // Jika ada gambar baru → replace
    if (proof_image && proof_image.name) {
      deleteFileIfExists(filePath);
      filePath = await saveUploadedFile(proof_image, "uploads/payment_proofs");
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
        proof_image_path: filePath,
      },
    });

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

    // Hapus file fisik
    deleteFileIfExists(proof.proof_image_path);

    await prisma.paymentproofs.delete({
      where: { payment_proof_id: params.id },
    });

    return NextResponse.json({ message: "Payment proof deleted" });
  } catch (error) {
    console.error("DELETE /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
