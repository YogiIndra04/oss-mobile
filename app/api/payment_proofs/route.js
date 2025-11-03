import prisma from "@/lib/prisma";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// CREATE
export async function POST(req) {
  try {
    const formData = await req.formData();
    const invoice_id = formData.get("invoice_id");
    const proof_status = formData.get("proof_status") || "Pending";
    const proof_title = formData.get("proof_title");
    const proof_description = formData.get("proof_description");
    const proof_amount = formData.get("proof_amount");
    const proof_date = formData.get("proof_date");
    const uploaded_by_user_id = formData.get("uploaded_by_user_id");
    const file =
      formData.get("proof_image") || formData.get("proof_image_path");

    if (!invoice_id || !uploaded_by_user_id) {
      return NextResponse.json(
        { error: "Missing required fields: invoice_id, uploaded_by_user_id" },
        { status: 400 }
      );
    }

    // Upload ke storage internal OSS & gunakan URL publik non-expiring
    let imageUrl = null;
    if (file && file.name) {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const safeInvoice = String(invoice_id).replace(/[^a-z0-9_-]+/gi, "-");
      const nameHint = `payment_proof-${safeInvoice}-${Date.now()}.${ext}`;
      const uploaded = await uploadToStorage(file, "uploads", nameHint);
      imageUrl = uploaded?.publicUrl || uploaded?.path || null;
    } else if (typeof file === "string" && file.length > 0) {
      // Jika sudah berupa URL publik dari FE
      imageUrl = file;
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "proof_image is required (file or public URL)" },
        { status: 400 }
      );
    }

    // Tentukan urutan cicilan berikutnya untuk invoice ini
    let nextSequence = null;
    try {
      const agg = await prisma.paymentproofs.aggregate({
        where: { invoice_id },
        _max: { proof_sequence: true },
      });
      const currentMax = agg?._max?.proof_sequence ?? 0;
      nextSequence = Number(currentMax || 0) + 1;
    } catch {}

    const newProof = await prisma.paymentproofs.create({
      data: {
        invoice_id,
        proof_status,
        proof_title,
        proof_description,
        proof_amount: proof_amount ? parseFloat(proof_amount) : 0,
        proof_sequence: nextSequence,
        proof_date: proof_date ? new Date(proof_date) : null,
        uploaded_by_user_id,
        proof_image_path: imageUrl,
      },
    });

    // Jika Verified, hitung ulang unpaid & payment_status invoice terkait
    try {
      if (String(proof_status).toLowerCase() === "verified") {
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
            const curUnpaid =
              invoice.unpaid == null
                ? null
                : new Prisma.Decimal(invoice.unpaid);
            const curStatus = String(invoice.payment_status || "");
            if (
              curUnpaid === null ||
              !curUnpaid.equals(nextUnpaid) ||
              curStatus !== nextStatus
            ) {
              await prisma.invoices.update({
                where: { invoice_id },
                data: { unpaid: nextUnpaid, payment_status: nextStatus },
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Recompute invoice after payment proof create failed:", e);
    }

    return NextResponse.json(newProof, { status: 201 });
  } catch (error) {
    console.error("POST /payment_proofs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// READ ALL
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoice_id");
    const status = searchParams.get("status"); // optional: Pending|Verified|Rejected
    const includeParam = searchParams.get("include") || ""; // e.g., invoice.customer,uploaded_by
    const includeInvoice = includeParam.includes("invoice");
    const includeUploadedBy = includeParam.includes("uploaded_by");
    let page = parseInt(searchParams.get("page") || "1", 10);
    let limit = parseInt(searchParams.get("limit") || "10", 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const where = {};
    if (invoiceId) where.invoice_id = invoiceId;
    if (status) where.proof_status = status;

    // Ambil payment proofs tanpa include untuk menghindari error relasi orphan
    const total = await prisma.paymentproofs.count({ where });
    const proofs = await prisma.paymentproofs.findMany({
      where,
      // tampilkan terbaru dulu
      orderBy: [{ created_at: "desc" }, { proof_sequence: "desc" }],
      skip,
      take: limit,
      select: {
        payment_proof_id: true,
        invoice_id: true,
        proof_status: true,
        proof_amount: true,
        proof_date: true,
        proof_title: true,
        proof_description: true,
        proof_image_path: true,
        proof_sequence: true,
        uploaded_by_user_id: true,
        created_at: true,
      },
    });

    if ((!includeInvoice && !includeUploadedBy) || proofs.length === 0) {
      // Format ringan: konversi tipe number/date
      const items = proofs.map((p) => ({
        ...p,
        proof_amount: p.proof_amount != null ? Number(p.proof_amount) : 0,
        proof_date: p.proof_date
          ? new Date(p.proof_date).toISOString().slice(0, 10)
          : null,
      }));
      return NextResponse.json({
        data: items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      });
    }

    // Batched fetch untuk hindari N+1
    let invoiceMap = new Map();
    let userMap = new Map();

    if (includeInvoice) {
      const invoiceIds = Array.from(
        new Set(proofs.map((p) => p.invoice_id).filter(Boolean))
      );
      if (invoiceIds.length) {
        const invoices = await prisma.invoices.findMany({
          where: { invoice_id: { in: invoiceIds } },
          select: {
            invoice_id: true,
            invoice_number: true,
            customer_name: true,
            total_amount: true,
            unpaid: true,
          },
        });
        for (const inv of invoices) invoiceMap.set(inv.invoice_id, inv);
      }
    }

    if (includeUploadedBy) {
      const userIds = Array.from(
        new Set(proofs.map((p) => p.uploaded_by_user_id).filter(Boolean))
      );
      if (userIds.length) {
        const users = await prisma.users.findMany({
          where: { id_user: { in: userIds } },
          select: {
            id_user: true,
            username: true,
            profile_user: { select: { user_name: true } },
          },
        });
        for (const u of users) userMap.set(u.id_user, u);
      }
    }

    const items = proofs.map((p) => {
      const base = {
        ...p,
        proof_amount: p.proof_amount != null ? Number(p.proof_amount) : 0,
        proof_date: p.proof_date
          ? new Date(p.proof_date).toISOString().slice(0, 10)
          : null,
      };

      if (includeUploadedBy) {
        const u = userMap.get(p.uploaded_by_user_id);
        base.uploaded_by_name =
          u?.profile_user?.user_name || u?.username || null;
      }

      if (includeInvoice) {
        const inv = invoiceMap.get(p.invoice_id);
        base.invoice = inv
          ? {
              invoice_number: inv.invoice_number,
              customer_name: inv.customer_name || null,
              total_amount:
                inv.total_amount != null ? Number(inv.total_amount) : 0,
              unpaid: inv.unpaid != null ? Number(inv.unpaid) : 0,
            }
          : null;
      }

      return base;
    });

    return NextResponse.json({
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("GET /payment_proofs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
