// import prisma from "@/lib/prisma";
// import { generateAndSaveBarcode } from "@/lib/utils/barcodeHandler"; // ✅ import utils barcode
// import { NextResponse } from "next/server";

// // CREATE Invoice
// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const {
//       invoice_number,
//       invoice_type,
//       customer_name,
//       customer_address,
//       unpaid,
//       total_amount,
//       payment_status,
//       invoice_creation_date,
//       payment_date,
//       completion_date,
//       due_date,
//       currency_accepted,
//       currency_exchange_rate,
//       currency_exchange_rate_date,
//       pdf_path,
//     } = body;

//     // ✅ Buat invoice baru
//     const newInvoice = await prisma.invoices.create({
//       data: {
//         invoice_number,
//         invoice_type,
//         customer_name,
//         customer_address,
//         unpaid,
//         total_amount,
//         payment_status,
//         invoice_creation_date: new Date(invoice_creation_date),
//         payment_date: payment_date ? new Date(payment_date) : null,
//         completion_date: completion_date ? new Date(completion_date) : null,
//         due_date: due_date ? new Date(due_date) : null,
//         currency_accepted,
//         currency_exchange_rate,
//         currency_exchange_rate_date: currency_exchange_rate_date
//           ? new Date(currency_exchange_rate_date)
//           : null,
//         pdf_path,
//       },
//     });

//     // ✅ Generate barcode untuk invoice ini
//     const barcodeLink = `https://yourdomain.com/invoices/${newInvoice.invoice_id}`; // bisa diarahkan ke halaman invoice
//     const filePath = await generateAndSaveBarcode(
//       barcodeLink,
//       `barcode-${newInvoice.invoice_id}`
//     );

//     // ✅ Simpan ke tabel barcodes
//     await prisma.barcodes.create({
//       data: {
//         invoice_id: newInvoice.invoice_id,
//         document_type: "Invoice",
//         barcode_link: barcodeLink,
//         barcode_image_path: filePath,
//       },
//     });

//     return NextResponse.json(newInvoice, { status: 201 });
//   } catch (error) {
//     console.error("POST /invoices error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // GET All Invoices
// export async function GET() {
//   try {
//     const invoices = await prisma.invoices.findMany({
//       include: { barcodes: true }, // ✅ supaya bisa langsung lihat barcode juga
//     });
//     return NextResponse.json(invoices, { status: 200 });
//   } catch (error) {
//     console.error("GET /invoices error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import supabase from "@/lib/supabase";
import { uploadToSupabase } from "@/lib/utils/uploadSupabase";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// ✅ CREATE Invoice (pakai form-data)
export async function POST(req) {
  try {
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
    const file = formData.get("pdf_path"); // File PDF

    // ✅ Validasi field wajib
    if (
      !invoice_number ||
      !invoice_type ||
      !customer_name ||
      !total_amount ||
      !payment_status ||
      !currency_accepted
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: invoice_number, invoice_type, customer_name, total_amount, payment_status, currency_accepted",
        },
        { status: 400 }
      );
    }

    // ✅ Cek apakah invoice_number sudah ada
    const existing = await prisma.invoices.findUnique({
      where: { invoice_number },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Invoice number ${invoice_number} already exists` },
        { status: 409 }
      );
    }

    // ✅ Upload file PDF ke Supabase (jika ada)
    let pdfPath = null;
    let pdfUrl = null;
    if (file && file.name) {
      const { path, publicUrl } = await uploadToSupabase(file, "invoices");
      pdfPath = path; // simpan relative path ke DB
      pdfUrl = publicUrl; // URL publik untuk barcode
    }

    // ✅ Buat invoice baru
    const newInvoice = await prisma.invoices.create({
      data: {
        invoice_number,
        invoice_type,
        customer_name,
        customer_address: customer_address || null,
        unpaid: unpaid ? Number(unpaid) : null,
        total_amount: total_amount ? Number(total_amount) : 0,
        payment_status,
        invoice_creation_date: invoice_creation_date
          ? new Date(invoice_creation_date)
          : new Date(),
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
        pdf_path: pdfPath, // ✅ simpan relative path
      },
    });

    // ✅ Generate barcode hanya kalau ada PDF
    let newBarcode = null;
    if (pdfUrl) {
      const barcodeBuffer = await QRCode.toBuffer(pdfUrl, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      const barcodeFileName = `barcodes/${newInvoice.invoice_id}.png`;
      const { error: uploadError } = await supabase.storage
        .from("invoice")
        .upload(barcodeFileName, barcodeBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
      }

      newBarcode = await prisma.barcodes.create({
        data: {
          invoice_id: newInvoice.invoice_id,
          document_type: "Invoice",
          barcode_link: pdfUrl, // URL publik PDF
          barcode_image_path: barcodeFileName, // path barcode di Supabase
        },
      });
    }

    return NextResponse.json(
      { invoice: newInvoice, barcode: newBarcode },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ✅ GET All Invoices
export async function GET() {
  try {
    const invoices = await prisma.invoices.findMany({
      include: { barcodes: true },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(invoices, { status: 200 });
  } catch (error) {
    console.error("GET /invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
