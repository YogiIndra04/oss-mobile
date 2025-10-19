// import prisma from "@/lib/prisma";

// import prisma from "@/lib/prisma";
// import { NextResponse } from "next/server";

// // GET Invoice by ID
// export async function GET(req, { params }) {
//   try {
//     const { id } = await params;
//     const invoice = await prisma.invoices.findUnique({
//       where: { invoice_id: id },
//     });

//     if (!invoice) {
//       return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
//     }

//     return NextResponse.json(invoice, { status: 200 });
//   } catch (error) {
//     console.error("GET /invoices/[id] error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // UPDATE Invoice
// export async function PUT(req, { params }) {
//   try {
//     const { id } = await params;
//     const body = await req.json();

//     const updatedInvoice = await prisma.invoices.update({
//       where: { invoice_id: id },
//       data: {
//         ...body,
//         invoice_creation_date: body.invoice_creation_date
//           ? new Date(body.invoice_creation_date)
//           : undefined,
//         payment_date: body.payment_date
//           ? new Date(body.payment_date)
//           : undefined,
//         completion_date: body.completion_date
//           ? new Date(body.completion_date)
//           : undefined,
//         due_date: body.due_date ? new Date(body.due_date) : undefined,
//         currency_exchange_rate_date: body.currency_exchange_rate_date
//           ? new Date(body.currency_exchange_rate_date)
//           : undefined,
//       },
//     });

//     return NextResponse.json(updatedInvoice, { status: 200 });
//   } catch (error) {
//     console.error("PUT /invoices/[id] error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // DELETE Invoice
// export async function DELETE(req, { params }) {
//   try {
//     const { id } = await params;

//     await prisma.invoices.delete({
//       where: { invoice_id: id },
//     });

//     return NextResponse.json(
//       { message: "Invoice deleted successfully" },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("DELETE /invoices/[id] error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import { uploadToStorage, uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// UPDATE Invoice pakai form-data
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const formData = await req.formData();

    // Ambil field dari form-data
    const invoice_number = formData.get("invoice_number");
    const invoice_type = formData.get("invoice_type");
    const customer_name = formData.get("customer_name");
    const customer_address = formData.get("customer_address");
    const unpaid = formData.get("unpaid");
    const total_amount = formData.get("total_amount");
    const payment_status = formData.get("payment_status");
    const invoice_creation_date = formData.get("invoice_creation_date");
    const payment_date = formData.get("payment_date");
    const completion_date = formData.get("completion_date");
    const due_date = formData.get("due_date");
    const currency_accepted = formData.get("currency_accepted");
    const currency_exchange_rate = formData.get("currency_exchange_rate");
    const currency_exchange_rate_date = formData.get(
      "currency_exchange_rate_date"
    );
    const file = formData.get("pdf_path"); // ✅ ganti pakai pdf_path

    // Cari invoice lama
    const oldInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      include: { barcodes: true },
    });

    if (!oldInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let pdfPath = oldInvoice.pdf_path;
    let pdfUrl = null;

    // Kalau ada file PDF baru → upload ke Supabase
    if (file && file.name) {
      const nameHint = `invoice_pdf-${id}.${(file.name.split('.').pop() || 'pdf')}`;
      const { path, publicUrl } = await uploadToStorage(file, "uploads", nameHint);
      pdfPath = path; // relative path in bucket
      pdfUrl = publicUrl; // public URL
    } else if (pdfPath) {
      pdfUrl = pdfPath;
    }

    // Update invoice di DB
    const updatedInvoice = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        invoice_number: (invoice_number && invoice_number.trim()) ? invoice_number.trim() : oldInvoice.invoice_number,
        invoice_type: (invoice_type && invoice_type.trim()) ? invoice_type.trim() : oldInvoice.invoice_type,
        customer_name: (customer_name && customer_name.trim()) ? customer_name.trim() : oldInvoice.customer_name,
        customer_address,
        unpaid: unpaid ? Number(unpaid) : null,
        total_amount: (total_amount !== null && total_amount !== undefined && String(total_amount).length > 0)
          ? Number(total_amount)
          : oldInvoice.total_amount,
        payment_status: (payment_status && payment_status.trim()) ? payment_status.trim() : oldInvoice.payment_status,
        invoice_creation_date: invoice_creation_date
          ? new Date(invoice_creation_date)
          : oldInvoice.invoice_creation_date,
        payment_date: payment_date ? new Date(payment_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        due_date: due_date ? new Date(due_date) : null,
        currency_accepted: (currency_accepted && currency_accepted.trim()) ? currency_accepted.trim() : oldInvoice.currency_accepted,
        currency_exchange_rate: currency_exchange_rate
          ? Number(currency_exchange_rate)
          : null,
        currency_exchange_rate_date: currency_exchange_rate_date
          ? new Date(currency_exchange_rate_date)
          : null,
        // simpan full public URL agar FE bisa langsung pakai
        pdf_path: pdfUrl || oldInvoice.pdf_path,
        updated_at: new Date(),
      },
    });

    // Regenerate barcode kalau ada pdfUrl
    if (pdfUrl) {
      const barcodeBuffer = await QRCode.toBuffer(pdfUrl, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      const nameHint = `barcode-${id}.png`
      const up = await uploadBufferToStorage(barcodeBuffer, "uploads", "png", "image/png", nameHint);

      // FE embeds QR into PDF; backend stores as-is, only syncs links
      await prisma.barcodes.upsert({
        where: { invoice_id: id },
        update: {
          barcode_link: (updatedInvoice?.pdf_path || pdfUrl),
          barcode_image_path: barcodePublicUrl || barcodeFileName,
          updated_at: new Date(),
        },
        create: {
          invoice_id: id,
          document_type: "Invoice",
          barcode_link: (updatedInvoice?.pdf_path || pdfUrl),
          barcode_image_path: barcodePublicUrl || barcodeFileName,
        },
      });
    }

    return NextResponse.json(updatedInvoice, { status: 200 });
  } catch (error) {
    console.error("PUT /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET Invoice by ID (with barcode public URLs)
export async function GET(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "invoice_id wajib diisi" }, { status: 400 });
    }

    const inv = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      include: {
        barcodes: true,
        createdBy: {
          select: {
            id_user: true,
            username: true,
            profile_user: { select: { user_name: true } },
          },
        },
      },
    });

    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const creatorName =
      inv.createdBy?.profile_user?.user_name || inv.createdBy?.username || null;
    const creatorId = inv.created_by_user_id || inv.createdBy?.id_user || null;
    const { createdBy, ...rest } = inv;

    const barcodes = Array.isArray(rest.barcodes)
      ? rest.barcodes.map((b) => {
          if (!b?.barcode_image_path) return b;
          if (b.barcode_image_path.startsWith('http')) {
            return { ...b, barcode_image_url: b.barcode_image_path };
          }
          // Legacy relative path (Supabase). Untuk OSS kita menyimpan URL publik langsung.
          return { ...b, barcode_image_url: null };
        })
      : rest.barcodes;

    return NextResponse.json(
      {
        ...rest,
        barcodes,
        created_by_user_id: creatorId,
        created_by: creatorName,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Invoice by ID (cleans up barcode files/rows)
export async function DELETE(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "invoice_id wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      include: { barcodes: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Remove barcode image files (TODO: hapus fisik jika API DELETE tersedia) dan delete rows
    if (Array.isArray(existing.barcodes) && existing.barcodes.length) {
      const paths = existing.barcodes
        .map((b) => {
          if (!b?.barcode_image_path) return null;
          return b.barcode_image_path;
        })
        .filter(Boolean);
      await prisma.barcodes.deleteMany({ where: { invoice_id: id } });
    }

    // Delete the invoice (details may cascade per schema)
    await prisma.invoices.delete({ where: { invoice_id: id } });

    return NextResponse.json({ message: "Invoice deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}






