import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import {
  uploadBufferToStorage,
  uploadToStorage,
} from "@/lib/utils/uploadStorage";
import { sendGroupFile } from "@/lib/utils/whatsappGroup";
import { Prisma } from "@prisma/client";
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
    const notifyWa = formData.get("notify_wa");
    const pdfUrlFromField =
      typeof file === "string" && file.trim().startsWith("http")
        ? file.trim()
        : typeof formData.get("pdf_url") === "string" &&
          formData.get("pdf_url").trim().startsWith("http")
        ? formData.get("pdf_url").trim()
        : null;

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
    if (pdfUrlFromField) {
      pdfPath = pdfUrlFromField;
      pdfUrl = pdfUrlFromField;
    } else if (file && file.name) {
      const safe = (s) =>
        String(s || "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9_.-]+/g, "-")
          .replace(/-+/g, "-");
      const safeNumber = safe(invoice_number);
      const safeCustomer = safe(customer_name);
      const ext = file.name.split(".").pop() || "pdf";
      const nameHint = `invoice_${safeNumber}_${safeCustomer}.${ext}`;
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

    // Generate and store barcode image ONCE using stable proxy link
    // Proxy ensures link stays the same even if pdf_path changes later.
    let newBarcode = null;
    try {
      const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
      const proxyLink = `${origin}/api/files/invoice/${newInvoice.invoice_id}`;

      const barcodeBuffer = await QRCode.toBuffer(proxyLink, {
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
          // Use stable proxy link so QR never changes
          barcode_link: proxyLink,
          barcode_image_path: barcodePublicUrl,
        },
      });
    } catch (_) {}

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

    // Send WhatsApp only when FE marks final (notify_wa === "1"). Use direct CDN pdf_path (no proxy).
    try {
      if (String(notifyWa || "") === "1" && pdfUrl) {
        // Resolve handler name
        let handlerName = String(decoded.id_user);
        try {
          const u = await prisma.users.findUnique({
            where: { id_user: decoded.id_user },
            select: {
              username: true,
              profile_user: { select: { user_name: true } },
            },
          });
          handlerName =
            u?.profile_user?.user_name || u?.username || handlerName;
        } catch {}

        const msg = [
          `Nomor Invoice : ${invoice_number}`,
          `Nama Customer : ${customer_name}`,
          `PIC : ${handlerName}`,
        ].join("\n");

        // Build friendly file name: invoice_<number>_<customer>.pdf
        const safe = (s) =>
          String(s || "")
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^a-zA-Z0-9_.-]+/g, "-")
            .replace(/-+/g, "-");
        const fn = `invoice_${safe(invoice_number)}_${safe(customer_name)}`;

        // Send via CDN URL with friendly filename (proxy not needed anymore)
        if (pdfUrl) {
          try {
            await sendGroupFile(pdfUrl, msg, `${fn}.pdf`);
          } catch (sendErr) {
            console.error(
              "WA notify (create invoice) sendGroupFile failed:",
              sendErr
            );
          }
        }
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
    const searchMode = (searchParams.get("search_mode") || "")
      .trim()
      .toLowerCase();
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
      if (
        !creatorId &&
        decoded?.role_user === "konsultan" &&
        decoded?.id_user
      ) {
        creatorId = decoded.id_user;
      }
    } catch {}

    const where = {
      ...(creatorId ? { created_by_user_id: creatorId } : {}),
      ...(mappedStatus ? { payment_status: mappedStatus } : {}),
      ...(q
        ? {
            OR: [
              { invoice_number: { contains: q } },
              { customer_name: { contains: q } },
            ],
          }
        : {}),
    };

    // Mode pencarian "top" (quick search): kembalikan top-N hasil berperingkat dari MySQL
    if (q && searchMode === "top") {
      try {
        const cap = 50;
        let topLimit = parseInt(searchParams.get("limit") || "20", 10);
        if (!Number.isFinite(topLimit) || topLimit < 1) topLimit = 20;
        if (topLimit > cap) topLimit = cap;

        // Build dynamic SQL dengan parameter binding aman
        const conditions = [Prisma.sql`1=1`];
        if (creatorId)
          conditions.push(Prisma.sql`created_by_user_id = ${creatorId}`);
        if (mappedStatus)
          conditions.push(Prisma.sql`payment_status = ${mappedStatus}`);
        // Batasi hanya baris yang setidaknya mengandung q pada salah satu kolom
        conditions.push(
          Prisma.sql`(invoice_number LIKE CONCAT('%', ${q}, '%') OR customer_name LIKE CONCAT('%', ${q}, '%'))`
        );
        const whereSql = Prisma.sql`WHERE ${Prisma.join(
          conditions,
          Prisma.sql` AND `
        )}`;

        const scoreSql = Prisma.sql`
          CASE
            WHEN invoice_number = ${q} THEN 100
            WHEN customer_name = ${q} THEN 90
            WHEN invoice_number LIKE CONCAT(${q}, '%') THEN 80
            WHEN customer_name LIKE CONCAT(${q}, '%') THEN 70
            WHEN invoice_number LIKE CONCAT('%', ${q}, '%') THEN 60
            WHEN customer_name LIKE CONCAT('%', ${q}, '%') THEN 50
            ELSE 0
          END AS score
        `;

        const rows = await prisma.$queryRaw(
          Prisma.sql`
            SELECT invoice_id, ${scoreSql}
            FROM invoices
            ${whereSql}
            ORDER BY score DESC, created_at DESC
            LIMIT ${topLimit}
          `
        );

        const idOrder = [];
        const idSet = new Set();
        for (const r of rows || []) {
          const sc = Number(r?.score ?? 0);
          const id = r?.invoice_id;
          if (id && sc > 0 && !idSet.has(id)) {
            idSet.add(id);
            idOrder.push(id);
          }
        }

        if (idOrder.length === 0) {
          return NextResponse.json(
            {
              data: [],
              pagination: {
                total: 0,
                page: 1,
                limit: topLimit,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
              },
            },
            { status: 200 }
          );
        }

        const items = await prisma.invoices.findMany({
          where: { invoice_id: { in: idOrder } },
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

        // Susun sesuai urutan skor/idOrder
        const byId = new Map(items.map((x) => [x.invoice_id, x]));
        const ordered = idOrder.map((id) => byId.get(id)).filter(Boolean);

        const invoices = ordered.map((inv) => {
          const creatorName =
            inv.createdBy?.profile_user?.user_name ||
            inv.createdBy?.username ||
            null;
          const creatorId2 =
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
                  return { ...b, barcode_image_url: null };
                }
              })
            : rest.barcodes;

          let pdf_public_url = null;
          if (rest.pdf_path) {
            try {
              if (rest.pdf_path.startsWith("http"))
                pdf_public_url = rest.pdf_path;
            } catch (_) {}
          }

          return {
            ...rest,
            barcodes,
            pdf_public_url,
            created_by_user_id: creatorId2,
            created_by: creatorName,
          };
        });

        return NextResponse.json(
          {
            data: invoices,
            pagination: {
              total: invoices.length,
              page: 1,
              limit: topLimit,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false,
            },
          },
          { status: 200 }
        );
      } catch (e) {
        console.error("GET /invoices search_mode=top error:", e);
        // Fallback ke alur biasa jika terjadi error
      }
    }
    // Backfill: setelah kolom unpaid dibuat NOT NULL, baris lama bisa masih NULL.
    // Lakukan perbaikan cepat: set unpaid = total_amount untuk baris NULL agar Prisma tidak error P2032.
    try {
      const nulls =
        await prisma.$queryRaw`SELECT invoice_id, total_amount FROM invoices WHERE unpaid IS NULL`;
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

    return NextResponse.json(
      {
        data: invoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /invoices error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
