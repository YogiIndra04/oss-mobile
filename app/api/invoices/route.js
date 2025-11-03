import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import {
  uploadBufferToStorage,
  uploadToStorage,
} from "@/lib/utils/uploadStorage";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { sendGroupFile, sendGroupMessage } from "@/lib/utils/whatsappGroup";

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

    // Resolve currency rate snapshot if not provided
    let resolvedRate = null;
    let resolvedRateDate = null;
    if (currency_accepted) {
      const hasRate =
        currency_exchange_rate != null &&
        String(currency_exchange_rate).length > 0;
      const hasDate =
        currency_exchange_rate_date != null &&
        String(currency_exchange_rate_date).length > 0;
      if (!hasRate && !hasDate) {
        const today = new Date();
        const latest = await prisma.currency_rates.findFirst({
          where: {
            currency_code: String(currency_accepted).toUpperCase(),
            effective_date: {
              lte: new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              ),
            },
          },
          orderBy: { effective_date: "desc" },
        });
        if (!latest) {
          return NextResponse.json(
            { error: `No currency rate found for ${currency_accepted}` },
            { status: 400 }
          );
        }
        resolvedRate = Number(latest.rate_to_base);
        resolvedRateDate = latest.effective_date;
      } else if (hasRate && hasDate) {
        const n = Number(currency_exchange_rate);
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json(
            { error: "Invalid currency_exchange_rate" },
            { status: 400 }
          );
        }
        resolvedRate = n;
        resolvedRateDate = new Date(currency_exchange_rate_date);
      } else {
        return NextResponse.json(
          {
            error:
              "Provide both currency_exchange_rate and currency_exchange_rate_date, or neither",
          },
          { status: 400 }
        );
      }
    }

    // Upload PDF to OSS Storage (single 'uploads' folder) if provided
    let pdfPath = null;
    let pdfUrl = null;
    if (file && file.name) {
      const safeNumber = String(invoice_number)
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "-");
      const ext = file.name.split(".").pop() || "pdf";
      const nameHint = `invoice_${safeNumber}.${ext}`;
      const { path, publicUrl } = await uploadToStorage(
        file,
        "uploads",
        nameHint
      );
      pdfPath = path;
      pdfUrl = publicUrl;
    }

    // Create invoice
    // Robust parse for total_amount (handles "1,000.50" and currency symbols)
    const totalAmountRaw = total_amount != null ? String(total_amount) : "0";
    const totalAmountNormalized = totalAmountRaw.replace(/[^0-9.-]/g, "");
    const totalAmountNumParsed = Number(totalAmountNormalized);
    const totalAmountNum = Number.isFinite(totalAmountNumParsed)
      ? totalAmountNumParsed
      : 0;
    const newInvoice = await prisma.invoices.create({
      data: {
        invoice_number,
        invoice_type,
        customer_name,
        customer_address: customer_address || null,
        total_amount: new Prisma.Decimal(totalAmountNum),
        // Balance due (unpaid) default = total_amount agar tidak 0 di awal
        unpaid: new Prisma.Decimal(totalAmountNum),
        payment_status,
        invoice_creation_date: invoice_creation_date
          ? new Date(invoice_creation_date)
          : new Date(),
        payment_date: payment_date ? new Date(payment_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        due_date: due_date ? new Date(due_date) : null,
        currency_accepted,
        currency_exchange_rate: resolvedRate,
        currency_exchange_rate_date: resolvedRateDate,
        pdf_path: pdfUrl || null,
      },
    });

    // FE is responsible for embedding QR into the PDF; backend stores as-is

    // Generate and store barcode image
    let newBarcode = null;
    if (pdfUrl) {
      const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
      const proxyLink = `${origin}/api/files/invoice/${newInvoice.invoice_id}`;
      const barcodeBuffer = await QRCode.toBuffer(pdfUrl, {
        type: "png",
        width: 300,
        errorCorrectionLevel: "H",
      });

      const nameHint = `barcode-${newInvoice.invoice_id}.png`;
      const up = await uploadBufferToStorage(
        barcodeBuffer,
        "uploads",
        "png",
        "image/png",
        nameHint
      );
      const barcodePublicUrl = up?.publicUrl || null;

      newBarcode = await prisma.barcodes.create({
        data: {
          invoice_id: newInvoice.invoice_id,
          barcode_link: proxyLink,
          barcode_image_path: barcodePublicUrl || barcodeFileName,
        },
      });
    }

    // Attach creator and enforce unpaid = total_amount (safety re-write)
    await prisma.invoices.update({
      where: { invoice_id: newInvoice.invoice_id },
      data: {
        created_by_user_id: decoded.id_user,
        unpaid: new Prisma.Decimal(totalAmountNum),
      },
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

    // Send WhatsApp group notification (non-blocking, but awaited with safety)
    try {
      // Resolve handler name
      let handlerName = String(decoded.id_user);
      try {
        const u = await prisma.users.findUnique({
          where: { id_user: decoded.id_user },
          select: { username: true, profile_user: { select: { user_name: true } } },
        });
        handlerName = u?.profile_user?.user_name || u?.username || handlerName;
      } catch {}

      const msg = [
        `Nomor Invoice : ${invoice_number}`,
        `Nama Customer : ${customer_name}`,
        `Di handle oleh : ${handlerName}`,
      ].join("\n");

      if (pdfUrl) {
        await sendGroupFile(pdfUrl, msg);
      } else {
        await sendGroupMessage(msg);
      }
    } catch (e) {
      console.error("WA notify (create invoice) failed:", e);
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
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    let page = parseInt(searchParams.get("page") || "1", 10);
    let limit = parseInt(searchParams.get("limit") || "10", 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    // Filters
    const createdByParam =
      searchParams.get("created_by") || searchParams.get("created_by_user_id");
    const q = (searchParams.get("q") || "").trim();
    const statusRaw = (searchParams.get("status") || "").trim();
    const statusMap = {
      paid: "Lunas",
      unpaid: "Belum_dibayar",
      progress: "Mencicil",
      overdue: "Jatuh_tempo",
    };
    let mappedStatus = null;
    if (statusRaw) {
      const key = statusRaw.toLowerCase();
      mappedStatus = statusMap[key] || statusRaw; // allow direct DB value too
    }

    // Default scoping for konsultan when creator not provided
    let creatorId = createdByParam || null;
    try {
      const token = req.headers.get("authorization")?.split(" ")[1];
      const decoded = token ? verifyJwt(token) : null;
      if (!creatorId && decoded?.role_user === "konsultan" && decoded?.id_user) {
        creatorId = decoded.id_user;
      }
    } catch {}

    const where = {
      ...(creatorId ? { created_by_user_id: creatorId } : {}),
      ...(mappedStatus ? { payment_status: mappedStatus } : {}),
      ...(q
        ? {
            OR: [
              { invoice_number: { contains: q, mode: "insensitive" } },
              { customer_name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    // Backfill: setelah kolom unpaid dibuat NOT NULL, baris lama bisa masih NULL.
    // Lakukan perbaikan cepat: set unpaid = total_amount untuk baris NULL agar Prisma tidak error P2032.
    try {
      const nulls = await prisma.$queryRaw`SELECT invoice_id, total_amount FROM invoices WHERE unpaid IS NULL`;
      if (Array.isArray(nulls) && nulls.length) {
        for (const row of nulls) {
          try {
            await prisma.invoices.update({
              where: { invoice_id: row.invoice_id },
              data: { unpaid: new Prisma.Decimal(row.total_amount ?? 0) },
            });
          } catch {}
        }
      }
    } catch (e) {
      console.error("Backfill unpaid NULL failed:", e);
    }

    const total = await prisma.invoices.count({ where });
    const invoicesRaw = await prisma.invoices.findMany({
      where,
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
      skip,
      take: limit,
    });

    const invoices = invoicesRaw.map((inv) => {
      const creatorName =
        inv.createdBy?.profile_user?.user_name ||
        inv.createdBy?.username ||
        null;
      const creatorId =
        inv.created_by_user_id || inv.createdBy?.id_user || null;
      const { createdBy, ...rest } = inv;

      const barcodes = Array.isArray(rest.barcodes)
        ? rest.barcodes.map((b) => {
            if (!b?.barcode_image_path) return b;
            if (
              b.barcode_image_path &&
              b.barcode_image_path.startsWith("http")
            ) {
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

    return NextResponse.json({
      data: invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("GET /invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
