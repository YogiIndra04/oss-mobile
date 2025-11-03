import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";

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

    // Recompute unpaid & payment_status berdasarkan semua proof Verified untuk invoice ini
    try {
      const invoice_id = oldProof.invoice_id;
      const invoice = await prisma.invoices.findUnique({
        where: { invoice_id },
        select: { total_amount: true, unpaid: true, payment_status: true },
      });
      if (invoice) {
        const agg = await prisma.paymentproofs.aggregate({
          where: { invoice_id, proof_status: "Verified" },
          _sum: { proof_amount: true },
        });
        const total = new Prisma.Decimal(invoice.total_amount || 0);
        const paid = new Prisma.Decimal(agg?._sum?.proof_amount || 0);
        if (paid.greaterThan(0)) {
          let nextUnpaid = total.sub(paid);
          if (nextUnpaid.lessThan(0)) nextUnpaid = new Prisma.Decimal(0);
          const nextStatus = nextUnpaid.equals(0) ? "Lunas" : "Mencicil";
          const curUnpaid = invoice.unpaid == null ? null : new Prisma.Decimal(invoice.unpaid);
          const curStatus = String(invoice.payment_status || "");
          if (curUnpaid === null || !curUnpaid.equals(nextUnpaid) || curStatus !== nextStatus) {
            await prisma.invoices.update({
              where: { invoice_id },
              data: { unpaid: nextUnpaid, payment_status: nextStatus },
            });
          }
        }
      }
    } catch (e) {
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

    // Recompute setelah delete (jika ada perubahan, update invoice)
    try {
      const invoice_id = proof.invoice_id;
      const invoice = await prisma.invoices.findUnique({
        where: { invoice_id },
        select: { total_amount: true, unpaid: true, payment_status: true },
      });
      if (invoice) {
        const agg = await prisma.paymentproofs.aggregate({
          where: { invoice_id, proof_status: "Verified" },
          _sum: { proof_amount: true },
        });
        const total = new Prisma.Decimal(invoice.total_amount || 0);
        const paid = new Prisma.Decimal(agg?._sum?.proof_amount || 0);
        if (paid.greaterThan(0)) {
          let nextUnpaid = total.sub(paid);
          if (nextUnpaid.lessThan(0)) nextUnpaid = new Prisma.Decimal(0);
          const nextStatus = nextUnpaid.equals(0) ? "Lunas" : "Mencicil";
          const curUnpaid = invoice.unpaid == null ? null : new Prisma.Decimal(invoice.unpaid);
          const curStatus = String(invoice.payment_status || "");
          if (curUnpaid === null || !curUnpaid.equals(nextUnpaid) || curStatus !== nextStatus) {
            await prisma.invoices.update({
              where: { invoice_id },
              data: { unpaid: nextUnpaid, payment_status: nextStatus },
            });
          }
        } else {
          // Tidak ada pembayaran terverifikasi tersisa; biarkan status/invoice apa adanya sesuai permintaan
        }
      }
    } catch (e) {
      console.error("Recompute invoice after payment proof delete failed:", e);
    }

    return NextResponse.json({ message: "Payment proof deleted" });
  } catch (error) {
    console.error("DELETE /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
