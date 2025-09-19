// import prisma from "@/lib/prisma";
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

//     return NextResponse.json(newInvoice, { status: 201 });
//   } catch (error) {
//     console.error("POST /invoices error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

// // GET All Invoices
// export async function GET() {
//   try {
//     const invoices = await prisma.invoices.findMany();
//     return NextResponse.json(invoices, { status: 200 });
//   } catch (error) {
//     console.error("GET /invoices error:", error);
//     return NextResponse.json({ error: error.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import { generateAndSaveBarcode } from "@/lib/utils/barcodeHandler"; // ✅ import utils barcode
import { NextResponse } from "next/server";

// CREATE Invoice
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      invoice_number,
      invoice_type,
      customer_name,
      customer_address,
      unpaid,
      total_amount,
      payment_status,
      invoice_creation_date,
      payment_date,
      completion_date,
      due_date,
      currency_accepted,
      currency_exchange_rate,
      currency_exchange_rate_date,
      pdf_path,
    } = body;

    // ✅ Buat invoice baru
    const newInvoice = await prisma.invoices.create({
      data: {
        invoice_number,
        invoice_type,
        customer_name,
        customer_address,
        unpaid,
        total_amount,
        payment_status,
        invoice_creation_date: new Date(invoice_creation_date),
        payment_date: payment_date ? new Date(payment_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        due_date: due_date ? new Date(due_date) : null,
        currency_accepted,
        currency_exchange_rate,
        currency_exchange_rate_date: currency_exchange_rate_date
          ? new Date(currency_exchange_rate_date)
          : null,
        pdf_path,
      },
    });

    // ✅ Generate barcode untuk invoice ini
    const barcodeLink = `https://yourdomain.com/invoices/${newInvoice.invoice_id}`; // bisa diarahkan ke halaman invoice
    const filePath = await generateAndSaveBarcode(
      barcodeLink,
      `barcode-${newInvoice.invoice_id}`
    );

    // ✅ Simpan ke tabel barcodes
    await prisma.barcodes.create({
      data: {
        invoice_id: newInvoice.invoice_id,
        document_type: "Invoice",
        barcode_link: barcodeLink,
        barcode_image_path: filePath,
      },
    });

    return NextResponse.json(newInvoice, { status: 201 });
  } catch (error) {
    console.error("POST /invoices error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET All Invoices
export async function GET() {
  try {
    const invoices = await prisma.invoices.findMany({
      include: { barcodes: true }, // ✅ supaya bisa langsung lihat barcode juga
    });
    return NextResponse.json(invoices, { status: 200 });
  } catch (error) {
    console.error("GET /invoices error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
