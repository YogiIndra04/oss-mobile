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
import supabase from "@/lib/supabase";
import { uploadToSupabase } from "@/lib/utils/uploadSupabase";
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
      const { path, publicUrl } = await uploadToSupabase(file, "invoices");
      pdfPath = path; // simpan relative path di DB
      pdfUrl = publicUrl; // public URL untuk barcode
    } else if (pdfPath) {
      // kalau tidak ada file baru, pakai pdf lama
      const { data } = supabase.storage.from("invoice").getPublicUrl(pdfPath);
      pdfUrl = data?.publicUrl;
    }

    // Update invoice di DB
    const updatedInvoice = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        invoice_number,
        invoice_type,
        customer_name,
        customer_address,
        unpaid: unpaid ? Number(unpaid) : null,
        total_amount: total_amount ? Number(total_amount) : 0,
        payment_status,
        invoice_creation_date: invoice_creation_date
          ? new Date(invoice_creation_date)
          : oldInvoice.invoice_creation_date,
        payment_date: payment_date ? new Date(payment_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        due_date: due_date ? new Date(due_date) : null,
        currency_accepted,
        currency_exchange_rate: currency_exchange_rate
          ? Number(currency_exchange_rate)
          : null,
        currency_exchange_rate_date: currency_exchange_rate_date
          ? new Date(currency_exchange_rate_date)
          : null,
        pdf_path: pdfPath, // ✅ relative path ke Supabase
        updated_at: new Date(),
      },
    });

    // ✅ regenerate barcode kalau ada pdfUrl
    if (pdfUrl) {
      const barcodeBuffer = await QRCode.toBuffer(pdfUrl, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      const barcodeFileName = `barcodes/${id}.png`;
      await supabase.storage
        .from("invoice")
        .upload(barcodeFileName, barcodeBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      await prisma.barcodes.upsert({
        where: { invoice_id: id },
        update: {
          barcode_link: pdfUrl,
          barcode_image_path: barcodeFileName,
          updated_at: new Date(),
        },
        create: {
          invoice_id: id,
          document_type: "Invoice",
          barcode_link: pdfUrl,
          barcode_image_path: barcodeFileName,
        },
      });
    }

    return NextResponse.json(updatedInvoice, { status: 200 });
  } catch (error) {
    console.error("PUT /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
