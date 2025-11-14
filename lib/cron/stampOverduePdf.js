import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, degrees } from "pdf-lib";

import prisma from "@/lib/prisma";
import { uploadBufferToStorage } from "@/lib/utils/uploadStorage";

const STAMP_MARKER = "overdue-stamped";
const DEFAULT_LIMIT = Number.isFinite(Number(process.env.OVERDUE_STAMP_LIMIT))
  ? Number(process.env.OVERDUE_STAMP_LIMIT)
  : 10;
const DEFAULT_CONCURRENCY = Number.isFinite(
  Number(process.env.OVERDUE_STAMP_CONCURRENCY)
)
  ? Math.max(1, Math.floor(Number(process.env.OVERDUE_STAMP_CONCURRENCY)))
  : 2;
const DEFAULT_BATCH_SIZE = Number.isFinite(
  Number(process.env.OVERDUE_STAMP_BATCH_SIZE)
)
  ? Math.max(1, Math.floor(Number(process.env.OVERDUE_STAMP_BATCH_SIZE)))
  : 10;

let cachedStampBuffer;

function sanitizeForFile(value = "") {
  const sanitized = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return sanitized || "invoice";
}

async function loadStampBuffer() {
  if (cachedStampBuffer) return cachedStampBuffer;

  const stampRelative = path.join("public", "uploads", "stamps", "OVERDUE.png");
  const filePath = path.isAbsolute(stampRelative)
    ? stampRelative
    : path.join(process.cwd(), stampRelative);
  try {
    cachedStampBuffer = await readFile(filePath);
    return cachedStampBuffer;
  } catch (error) {
    throw new Error(
      `Tidak dapat menemukan asset stempel di ${filePath}; pastikan public/uploads/stamps/OVERDUE.png sudah ada`
    );
  }
}

async function runWithConcurrency(tasks, concurrency) {
  const limit = Math.max(1, Math.floor(concurrency));
  let current = 0;
  async function worker() {
    while (current < tasks.length) {
      const idx = current++;
      await tasks[idx]();
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

export async function applyOverdueStamp({
  limit,
  dryRun = false,
  concurrency,
  batchSize,
} = {}) {
  const maxTotal =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : DEFAULT_LIMIT > 0
      ? DEFAULT_LIMIT
      : 10;
  const maxConcurrency =
    typeof concurrency === "number" && Number.isFinite(concurrency)
      ? Math.max(1, Math.floor(concurrency))
      : DEFAULT_CONCURRENCY;
  const fetchBatchSize =
    typeof batchSize === "number" && Number.isFinite(batchSize)
      ? Math.max(1, Math.floor(batchSize))
      : Math.max(DEFAULT_BATCH_SIZE, 1);

  const stampBuffer = await loadStampBuffer();
  const summary = {
    total: 0,
    stamped: 0,
    skipped: 0,
    dryRun: !!dryRun,
    errors: [],
    batches: 0,
  };

  async function buildTasks(invoices) {
    return invoices.map((invoice) => async () => {
      if (!/^https?:\/\//i.test(invoice.pdf_path || "")) {
        summary.skipped += 1;
        summary.errors.push({
          invoice_id: invoice.invoice_id,
          error: "PDF path tidak berupa URL publik",
        });
        return;
      }

      try {
        const resp = await fetch(invoice.pdf_path, { cache: "no-store" });
        if (!resp.ok) {
          throw new Error(`Fetch gagal ${resp.status} ${resp.statusText}`);
        }
        const arrayBuffer = await resp.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
          updateMetadata: false,
          ignoreEncryption: true,
        });
        if (pdfDoc.getPageCount() === 0) {
          throw new Error("PDF tidak memiliki halaman");
        }
        const stampImage = await pdfDoc.embedPng(stampBuffer);
        const page = pdfDoc.getPage(0);
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const { width: imgWidth, height: imgHeight } = stampImage.scale(1);
        const maxStampWidth = Math.min(pageWidth * 0.6, 280);
        const maxStampHeight = Math.min(pageHeight * 0.35, 160);
        const scale = Math.min(
          1,
          maxStampWidth / imgWidth || 1,
          maxStampHeight / imgHeight || 1
        );
        const stampWidth = imgWidth * scale;
        const stampHeight = imgHeight * scale;
        const x = Math.max(20, pageWidth - stampWidth - 30);
        const y = Math.max(20, pageHeight - stampHeight - 30);
        page.drawImage(stampImage, {
          x,
          y,
          width: stampWidth,
          height: stampHeight,
          rotate: degrees(-14),
          opacity: 0.85,
        });

        const updatedPdfBytes = await pdfDoc.save();

        if (!dryRun) {
          const safeName = sanitizeForFile(
            invoice.invoice_number || invoice.invoice_id
          );
          const filename = `invoice_${safeName}-${STAMP_MARKER}-${Date.now()}.pdf`;
          const upload = await uploadBufferToStorage(
            Buffer.from(updatedPdfBytes),
            "uploads",
            "pdf",
            "application/pdf",
            filename
          );
          await prisma.invoices.update({
            where: { invoice_id: invoice.invoice_id },
            data: { pdf_path: upload.publicUrl },
          });
        }

        summary.stamped += 1;
      } catch (error) {
        summary.skipped += 1;
        summary.errors.push({
          invoice_id: invoice.invoice_id,
          error: error?.message || "Kesalahan tidak dikenal",
        });
      }
    });
  }

  while (true) {
    const remaining = Math.max(maxTotal - summary.total, 0);
    if (remaining === 0) break;
    const take = Math.min(fetchBatchSize, remaining);
    const invoices = await prisma.invoices.findMany({
      where: {
        payment_status: "Jatuh_tempo",
        pdf_path: {
          not: null,
          not: { contains: STAMP_MARKER },
        },
      },
      orderBy: { due_date: "asc" },
      take,
    });

    if (invoices.length === 0) break;
    summary.total += invoices.length;
    summary.batches += 1;

    const tasks = await buildTasks(invoices);
    await runWithConcurrency(tasks, maxConcurrency);

    if (invoices.length < take) break;
  }

  return summary;
}
