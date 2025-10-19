import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { uploadToStorage, uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

// CREATE Invoice (multipart/form-data)
export async function POST(req) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user) {
      return NextResponse.json(
        { error: "Unauthorized: missing/invalid token" },
        { status: 401 }
      );
    }

    const formData = await req.formData();

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
    const currency_exchange_rate_date = formData.get("currency_exchange_rate_date");
    const file = formData.get("pdf_path");

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

    const existing = await prisma.invoices.findUnique({
      where: { invoice_number },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Invoice number ${invoice_number} already exists` },
        { status: 409 }
      );
    }

    // Upload PDF to OSS Storage (single 'uploads' folder) if provided
    let pdfPath = null;
    let pdfUrl = null;
    if (file && file.name) {
      const nameHint = `invoice_pdf-${invoice_number || Date.now()}.${(file.name.split('.').pop()||'pdf')}`;
      const { path, publicUrl } = await uploadToStorage(file, "uploads", nameHint);
      pdfPath = path;
      pdfUrl = publicUrl;
    }

    // Create invoice
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
        pdf_path: pdfUrl || null,
      },
    });

    // FE is responsible for embedding QR into the PDF; backend stores as-is

    // Generate and store barcode image
    let newBarcode = null;
    if (pdfUrl) {
      const barcodeBuffer = await QRCode.toBuffer(pdfUrl, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      const nameHint = `barcode-${newInvoice.invoice_id}.png`;
      const up = await uploadBufferToStorage(barcodeBuffer, "uploads", "png", "image/png", nameHint);
      const barcodePublicUrl = up?.publicUrl || null;

      newBarcode = await prisma.barcodes.create({
        data: {
          invoice_id: newInvoice.invoice_id,
          document_type: "Invoice",
          barcode_link: newInvoice?.pdf_path || pdfUrl,
          barcode_image_path: barcodePublicUrl || barcodeFileName,
        },
      });
    }

    // Attach creator
    await prisma.invoices.update({
      where: { invoice_id: newInvoice.invoice_id },
      data: { created_by_user_id: decoded.id_user },
    });

    const invoiceWithCreator = await prisma.invoices.findUnique({
      where: { invoice_id: newInvoice.invoice_id },
    });

    // Public URL for barcode
    let barcodeImageUrl = null;
    if (newBarcode?.barcode_image_path) {
      if (newBarcode.barcode_image_path.startsWith("http")) {
        barcodeImageUrl = newBarcode.barcode_image_path;
      } else {
        // Legacy relative path (old storage); untuk OSS kita menyimpan URL publik langsung
        barcodeImageUrl = null;
      }
    }

    return NextResponse.json(
      {
        invoice: {
          ...invoiceWithCreator,
          created_by_user_id: decoded.id_user,
        },
        barcode: newBarcode
          ? { ...newBarcode, barcode_image_url: barcodeImageUrl }
          : null,
        pdf_public_url: pdfUrl || null,
      },
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

// GET All Invoices
export async function GET() {
  try {
    const invoicesRaw = await prisma.invoices.findMany({
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
      orderBy: { created_at: "desc" },
    });

    const invoices = invoicesRaw.map((inv) => {
      const creatorName =
        inv.createdBy?.profile_user?.user_name || inv.createdBy?.username || null;
      const creatorId = inv.created_by_user_id || inv.createdBy?.id_user || null;
      const { createdBy, ...rest } = inv;

      const barcodes = Array.isArray(rest.barcodes)
        ? rest.barcodes.map((b) => {
            if (!b?.barcode_image_path) return b;
            if (b.barcode_image_path && b.barcode_image_path.startsWith("http")) {
              return { ...b, barcode_image_url: b.barcode_image_path };
            } else {
              // Legacy relative path (old storage); untuk OSS kita menyimpan URL publik langsung
              return { ...b, barcode_image_url: null };
            }
          })
        : rest.barcodes;

      let pdf_public_url = null;
      if (rest.pdf_path) {
        try {
          if (rest.pdf_path.startsWith("http")) {
            pdf_public_url = rest.pdf_path;
          } else {
            // Legacy relative path (old storage)
            pdf_public_url = null;
          }
        } catch (_) {}
      }

      return {
        ...rest,
        barcodes,
        pdf_public_url,
        created_by_user_id: creatorId,
        created_by: creatorName,
      };
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


