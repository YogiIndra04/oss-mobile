import { recomputeUnpaidAndStatus } from "@/lib/invoiceRecompute";
import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import { sendGroupMessage } from "@/lib/utils/whatsappGroup";
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

    // Sum Verified sebelum update
    let verifiedBefore = 0;
    try {
      const agg = await prisma.paymentproofs.aggregate({
        where: { invoice_id: oldProof.invoice_id, proof_status: "Verified" },
        _sum: { proof_amount: true },
      });
      verifiedBefore = Number(agg?._sum?.proof_amount || 0);
    } catch {}

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
    try {
      await recomputeUnpaidAndStatus(oldProof.invoice_id);
    } catch (e) {
      console.error("Recompute invoice after payment proof update failed:", e);
    }

    // Notifikasi WA jika status berubah menjadi Verified/Rejected
    try {
      const oldStatus = String(oldProof.proof_status || "");
      const newStatus = String(updatedProof.proof_status || "");
      const changed = oldStatus !== newStatus;
      const lowered = newStatus.toLowerCase();
      if (changed && (lowered === "verified" || lowered === "rejected")) {
        // Resolve PIC dari token (verifikator/penolak)
        let pic = "Unknown";
        try {
          const token = req.headers.get("authorization")?.split(" ")[1];
          const decoded = token ? verifyJwt(token) : null;
          if (decoded?.id_user) {
            const u = await prisma.users.findUnique({
              where: { id_user: decoded.id_user },
              select: {
                username: true,
                profile_user: { select: { user_name: true } },
              },
            });
            pic = u?.profile_user?.user_name || u?.username || decoded.id_user;
          }
        } catch {}

        const inv = await prisma.invoices.findUnique({
          where: { invoice_id: oldProof.invoice_id },
          select: { invoice_number: true, customer_name: true },
        });
        const d = updatedProof.proof_date
          ? new Date(updatedProof.proof_date)
          : new Date();
        const tanggal = d.toISOString().slice(0, 10);
        const jumlah = (() => {
          try {
            return Number(updatedProof.proof_amount || 0).toLocaleString(
              "id-ID"
            );
          } catch {
            return String(updatedProof.proof_amount || 0);
          }
        })();
        const header =
          lowered === "verified"
            ? "💵[PAYMENT PROOF] Diverifikasi"
            : "💸[PAYMENT PROOF] Ditolak";
        const msg = [
          header,
          `Invoice: ${inv?.invoice_number || "-"}`,
          `Customer: ${inv?.customer_name || "-"}`,
          `PIC: ${pic}`,
          `Tanggal: ${tanggal}`,
          `Jumlah: IDR ${jumlah}`,
        ].join("\n");
        await sendGroupMessage(msg);
      }
    } catch (e) {
      console.error("WA notify (payment proof update) failed:", e);
    }

    // Sum Verified setelah update
    let verifiedAfter = verifiedBefore;
    try {
      const agg = await prisma.paymentproofs.aggregate({
        where: { invoice_id: oldProof.invoice_id, proof_status: "Verified" },
        _sum: { proof_amount: true },
      });
      verifiedAfter = Number(agg?._sum?.proof_amount || 0);
    } catch {}
    const pdf_should_update = verifiedAfter !== verifiedBefore;

    return NextResponse.json({ ...updatedProof, pdf_should_update });
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

    // Sum Verified sebelum delete
    let verifiedBefore = 0;
    try {
      const agg = await prisma.paymentproofs.aggregate({
        where: { invoice_id: proof.invoice_id, proof_status: "Verified" },
        _sum: { proof_amount: true },
      });
      verifiedBefore = Number(agg?._sum?.proof_amount || 0);
    } catch {}

    await prisma.paymentproofs.delete({
      where: { payment_proof_id: params.id },
    });

    // Recompute setelah delete via helper
    try {
      await recomputeUnpaidAndStatus(proof.invoice_id);
    } catch (e) {
      console.error("Recompute invoice after payment proof delete failed:", e);
    }

    // Sum Verified setelah delete
    let verifiedAfter = verifiedBefore;
    try {
      const agg = await prisma.paymentproofs.aggregate({
        where: { invoice_id: proof.invoice_id, proof_status: "Verified" },
        _sum: { proof_amount: true },
      });
      verifiedAfter = Number(agg?._sum?.proof_amount || 0);
    } catch {}
    const pdf_should_update = verifiedAfter !== verifiedBefore;

    return NextResponse.json({
      message: "Payment proof deleted",
      pdf_should_update,
    });
  } catch (error) {
    console.error("DELETE /payment_proofs/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
