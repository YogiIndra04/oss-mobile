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

import { computeInvoice } from "@/lib/discount";
import { recomputeUnpaidAndStatus } from "@/lib/invoiceRecompute";
import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import {
  uploadBufferToStorage,
  uploadToStorage,
} from "@/lib/utils/uploadStorage";
import { sendGroupFile, sendGroupMessage } from "@/lib/utils/whatsappGroup";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

const parseNumericFlexible = (
  value,
  { defaultValue = null, min = 0, allowZero = true } = {}
) => {
  if (value === undefined || value === null) return defaultValue;
  const raw = value.toString().trim();
  if (!raw) return defaultValue;
  let normalized = raw;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  if (hasComma && hasDot) {
    normalized = raw.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    normalized = raw.replace(/,/g, "");
  } else if (hasDot && !hasComma) {
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      normalized = raw.replace(/\./g, "");
    }
  }
  normalized = normalized.replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return defaultValue;
  if (!allowZero && num === 0) return defaultValue;
  if (num < min) return defaultValue;
  return num;
};

// UPDATE Invoice pakai form-data{}
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
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
    const pdfUrlFromField =
      typeof file === "string" && file.trim().startsWith("http")
        ? file.trim()
        : typeof formData.get("pdf_url") === "string" &&
          formData.get("pdf_url").trim().startsWith("http")
        ? formData.get("pdf_url").trim()
        : null;

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
    if (pdfUrlFromField) {
      pdfPath = pdfUrlFromField;
      pdfUrl = pdfUrlFromField;
    } else if (file && file.name) {
      const rawNumber =
        invoice_number && String(invoice_number).trim()
          ? String(invoice_number).trim()
          : oldInvoice.invoice_number || id;
      const rawCustomer =
        customer_name && String(customer_name).trim()
          ? String(customer_name).trim()
          : oldInvoice.customer_name || "customer";
      const safe = (s) =>
        String(s || "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9_.-]+/g, "-")
          .replace(/-+/g, "-");
      const safeNumber = safe(rawNumber);
      const safeCustomer = safe(rawCustomer);
      const ext = file.name.split(".").pop() || "pdf";
      const nameHint = `invoice_${safeNumber}_${safeCustomer}.${ext}`;
      const { path, publicUrl } = await uploadToStorage(
        file,
        "uploads",
        nameHint
      );
      pdfPath = path; // relative path in bucket
      pdfUrl = publicUrl; // public URL
    } else if (pdfPath) {
      pdfUrl = pdfPath;
    }

    // Resolve currency rate snapshot with backward compatible behavior:
    // - If both rate/date provided: use them
    // - If neither provided:
    //     * If currency not changed and old snapshot exists: keep old snapshot (no lookup)
    //     * Else: lookup latest for next currency; 400 if not found
    // - If only one provided: 400
    const nextCurrencyAccepted =
      currency_accepted && currency_accepted.trim()
        ? currency_accepted.trim()
        : oldInvoice.currency_accepted;
    let resolvedRate = null;
    let resolvedRateDate = null;
    {
      const hasRate =
        currency_exchange_rate != null &&
        String(currency_exchange_rate).length > 0;
      const hasDate =
        currency_exchange_rate_date != null &&
        String(currency_exchange_rate_date).length > 0;
      if (hasRate && hasDate) {
        const n = parseNumericFlexible(currency_exchange_rate, {
          defaultValue: null,
          min: 0,
          allowZero: false,
        });
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json(
            { error: "Invalid currency_exchange_rate" },
            { status: 400 }
          );
        }
        resolvedRate = n;
        resolvedRateDate = new Date(currency_exchange_rate_date);
      } else if (!hasRate && !hasDate) {
        const currencyChanged =
          String(nextCurrencyAccepted).toUpperCase() !==
          String(oldInvoice.currency_accepted || "").toUpperCase();
        const hasOldSnapshot =
          !!oldInvoice.currency_exchange_rate &&
          !!oldInvoice.currency_exchange_rate_date;
        if (!currencyChanged && hasOldSnapshot) {
          resolvedRate = Number(oldInvoice.currency_exchange_rate);
          resolvedRateDate = oldInvoice.currency_exchange_rate_date;
        } else {
          const today = new Date();
          const latest = await prisma.currency_rates.findFirst({
            where: {
              currency_code: String(nextCurrencyAccepted).toUpperCase(),
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
              { error: `No currency rate found for ${nextCurrencyAccepted}` },
              { status: 400 }
            );
          }
          resolvedRate = Number(latest.rate_to_base);
          resolvedRateDate = latest.effective_date;
        }
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

    // Update invoice di DB
    const updatedInvoice = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        invoice_number:
          invoice_number && invoice_number.trim()
            ? invoice_number.trim()
            : oldInvoice.invoice_number,
        invoice_type:
          invoice_type && invoice_type.trim()
            ? invoice_type.trim()
            : oldInvoice.invoice_type,
        customer_name:
          customer_name && customer_name.trim()
            ? customer_name.trim()
            : oldInvoice.customer_name,
        customer_address,
        // unpaid dihitung otomatis dari payment proofs; jangan override jika tidak dikirim
        ...(unpaid != null && String(unpaid).length > 0
          ? {
              unpaid:
                parseNumericFlexible(unpaid, {
                  defaultValue: Number(oldInvoice.unpaid ?? 0),
                  min: 0,
                }) ?? Number(oldInvoice.unpaid ?? 0),
            }
          : {}),
        total_amount:
          total_amount !== null &&
          total_amount !== undefined &&
          String(total_amount).length > 0
            ? parseNumericFlexible(total_amount, {
                defaultValue: Number(oldInvoice.total_amount ?? 0),
                min: 0,
              }) ?? Number(oldInvoice.total_amount ?? 0)
            : oldInvoice.total_amount,
        payment_status:
          payment_status && payment_status.trim()
            ? payment_status.trim()
            : oldInvoice.payment_status,
        invoice_creation_date: invoice_creation_date
          ? new Date(invoice_creation_date)
          : oldInvoice.invoice_creation_date,
        payment_date: payment_date ? new Date(payment_date) : null,
        completion_date: completion_date ? new Date(completion_date) : null,
        due_date: due_date ? new Date(due_date) : null,
        currency_accepted: nextCurrencyAccepted,
        currency_exchange_rate: resolvedRate,
        currency_exchange_rate_date: resolvedRateDate,
        // simpan full public URL agar FE bisa langsung pakai
        pdf_path: pdfUrl || oldInvoice.pdf_path,
        updated_at: new Date(),
      },
    });

    // Do not regenerate barcode on update. Create once if missing using stable proxy link.
    try {
      const existingBarcode = await prisma.barcodes.findUnique({
        where: { invoice_id: id },
      });
      if (!existingBarcode) {
        const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
        const proxyLink = `${origin}/api/files/invoice/${id}`;
        const barcodeBuffer = await QRCode.toBuffer(proxyLink, {
          type: "png",
          width: 300,
          errorCorrectionLevel: "H",
        });
        const nameHint = `barcode-${id}.png`;
        const up = await uploadBufferToStorage(
          barcodeBuffer,
          "uploads",
          "png",
          "image/png",
          nameHint
        );
        await prisma.barcodes.create({
          data: {
            invoice_id: id,
            barcode_link: proxyLink,
            barcode_image_path: up?.publicUrl || up?.path || null,
          },
        });
      }
    } catch (_) {}

    // Hitung subtotal & diskon invoice setelah update
    const items = await prisma.productdetail.findMany({
      where: { invoice_id: id },
      select: { line_total_idr: true, total_product_amount: true },
    });
    const lineTotalsAfter = items.map(
      (i) => i.line_total_idr ?? i.total_product_amount
    );
    // Diskon: gunakan nilai efektif (request jika dikirim; jika tidak, pakai nilai lama dari DB)
    const sentDiscType = formData.get("invoice_discount_type");
    const hasDiscType = sentDiscType !== null;
    const invoice_discount_type = hasDiscType
      ? sentDiscType || null
      : oldInvoice.invoice_discount_type;
    const sentDiscValRaw = formData.get("invoice_discount_value");
    const hasDiscVal = sentDiscValRaw !== null;
    const sentDiscVal =
      sentDiscValRaw != null && String(sentDiscValRaw).length > 0
        ? Number(sentDiscValRaw)
        : null;
    const invoice_discount_value = hasDiscVal
      ? sentDiscVal
      : oldInvoice.invoice_discount_value;

    const totals = computeInvoice({
      lineTotalsAfter,
      invoiceDiscountType: invoice_discount_type,
      invoiceDiscountValue: invoice_discount_value,
      taxRate: null,
    });

    const finalInvoice = await prisma.invoices.update({
      where: { invoice_id: id },
      data: {
        subtotal_before_invoice_discount:
          totals.subtotal_before_invoice_discount,
        ...(hasDiscType ? { invoice_discount_type } : {}),
        ...(hasDiscVal ? { invoice_discount_value } : {}),
        invoice_discount_amount: totals.invoice_discount_amount,
        subtotal_after_invoice_discount: totals.subtotal_after_invoice_discount,
        total_amount: totals.total_amount,
      },
      include: { barcodes: true },
    });

    // Recompute unpaid and payment_status based on new totals and verified payments
    try {
      await recomputeUnpaidAndStatus(id);
    } catch (e) {
      console.error(
        "Recompute unpaid/status after invoice discount update failed:",
        e
      );
    }

    const latestInvoice = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      include: { barcodes: true },
    });

    // WhatsApp group notification untuk update: kirim hanya jika FE menandai final (notify_wa === "1"). Use direct CDN pdf_path (no proxy).
    try {
      const notifyWa = formData.get("notify_wa");
      const shouldNotify = String(notifyWa || "") === "1";
      if (shouldNotify) {
        let handlerName = "Unknown";
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
            handlerName =
              u?.profile_user?.user_name ||
              u?.username ||
              String(decoded.id_user);
          }
        } catch {}

        const msg = [
          "✅ Invoice Update!",
          `Nomor Invoice : ${finalInvoice.invoice_number}`,
          `Nama Customer : ${finalInvoice.customer_name}`,
          `PIC : ${handlerName}`,
        ].join("\n");

        if (finalInvoice?.pdf_path) {
          const safe = (s) =>
            String(s || "")
              .trim()
              .replace(/\s+/g, "-")
              .replace(/[^a-zA-Z0-9_.-]+/g, "-")
              .replace(/-+/g, "-");
          const fn = `invoice_${safe(finalInvoice.invoice_number)}_${safe(
            finalInvoice.customer_name
          )}`;
          try {
            await sendGroupFile(finalInvoice.pdf_path, msg, `${fn}.pdf`);
          } catch (sendErr) {
            console.error(
              "WA notify (update invoice) sendGroupFile failed:",
              sendErr
            );
          }
        }
      }
    } catch (e) {
      console.error("WA notify (update invoice) failed:", e);
    }

    return NextResponse.json(latestInvoice || finalInvoice, { status: 200 });
  } catch (error) {
    console.error("PUT /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET Invoice by ID (with barcode public URLs)
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "invoice_id wajib diisi" },
        { status: 400 }
      );
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
          if (b.barcode_image_path.startsWith("http")) {
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
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "invoice_id wajib diisi" },
        { status: 400 }
      );
    }

    const existing = await prisma.invoices.findUnique({
      where: { invoice_id: id },
      include: { barcodes: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Remove barcode rows (images are stored in OSS; optional physical removal not implemented)
    if (Array.isArray(existing.barcodes) && existing.barcodes.length) {
      await prisma.barcodes.deleteMany({ where: { invoice_id: id } });
    }

    // Safety: remove payment proofs explicitly (in addition to DB cascade)
    await prisma.paymentproofs.deleteMany({ where: { invoice_id: id } });

    // Delete the invoice (other relations may cascade per schema)
    await prisma.invoices.delete({ where: { invoice_id: id } });

    // WhatsApp group notification for delete (message only)
    try {
      let handlerName = "Unknown";
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
          handlerName =
            u?.profile_user?.user_name ||
            u?.username ||
            String(decoded.id_user);
        }
      } catch {}

      const msg = [
        "❌ Invoice Dihapus!",
        `Nomor Invoice : ${existing.invoice_number}`,
        `Nama Customer : ${existing.customer_name}`,
        `Dihapus oleh : ${handlerName}`,
      ].join("\n");
      await sendGroupMessage(msg);
    } catch (e) {
      console.error("WA notify (delete invoice) failed:", e);
    }

    return NextResponse.json({ message: "Invoice deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /invoices/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
