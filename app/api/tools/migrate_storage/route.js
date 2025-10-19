import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyJwt } from "@/lib/jwt";
import { uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import storage from "@/lib/storage";
import QRCode from "qrcode";

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function isHttp(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

export async function POST(req) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user || decoded?.role_user !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const limit = Number(body?.limit || 50);
    const supabaseUrl = body?.supabaseUrl; // optional base for legacy relative paths

    const result = { migrated: {}, skipped: {}, errors: {} };

    // 1) Migrate invoice PDFs (download old URL if supabase, re-upload to OSS)
    const invoices = await prisma.invoices.findMany({
      where: { NOT: [{ pdf_path: null }] },
      select: { invoice_id: true, pdf_path: true },
      take: limit,
    });
    let invMigrated = 0, invSkipped = 0, invErrors = 0;
    for (const inv of invoices) {
      const cur = inv.pdf_path;
      if (!cur) { invSkipped++; continue; }
      if (cur.includes("storage.onestepsolutionbali.com")) { invSkipped++; continue; }
      if (!isHttp(cur)) { invSkipped++; continue; }
      try {
        if (!dryRun) {
          const buf = await fetchBuffer(cur);
          const nameHint = `invoice_pdf-${inv.invoice_id}.pdf`;
          const up = await uploadBufferToStorage(buf, 'uploads', 'pdf', 'application/pdf', nameHint);
          await prisma.invoices.update({ where: { invoice_id: inv.invoice_id }, data: { pdf_path: up.publicUrl } });
        }
        invMigrated++;
      } catch (e) {
        invErrors++;
      }
    }
    result.migrated.invoices = invMigrated; result.skipped.invoices = invSkipped; result.errors.invoices = invErrors;

    // 2) Migrate barcodes by regenerating from barcode_link
    const barcodes = await prisma.barcodes.findMany({
      select: { barcode_id: true, invoice_id: true, barcode_link: true, barcode_image_path: true },
      take: limit,
    });
    let bcMigrated = 0, bcSkipped = 0, bcErrors = 0;
    for (const b of barcodes) {
      const cur = b.barcode_image_path;
      if (cur && cur.includes("storage.onestepsolutionbali.com")) { bcSkipped++; continue; }
      if (!b.barcode_link) { bcSkipped++; continue; }
      try {
        if (!dryRun) {
          const buf = await QRCode.toBuffer(b.barcode_link, { type: 'png', width: 300, errorCorrectionLevel: 'H' });
          const nameHint = `barcode-${b.invoice_id || b.barcode_id}.png`;
          const up = await uploadBufferToStorage(buf, 'uploads', 'png', 'image/png', nameHint);
          await prisma.barcodes.update({ where: { barcode_id: b.barcode_id }, data: { barcode_image_path: up.publicUrl } });
        }
        bcMigrated++;
      } catch (e) {
        bcErrors++;
      }
    }
    result.migrated.barcodes = bcMigrated; result.skipped.barcodes = bcSkipped; result.errors.barcodes = bcErrors;

    // 3) Migrate profile images
    const profiles = await prisma.profile_user.findMany({ select: { id_user: true, profile_image: true }, take: limit });
    let pfMigrated = 0, pfSkipped = 0, pfErrors = 0;
    for (const p of profiles) {
      const cur = p.profile_image;
      if (!cur) { pfSkipped++; continue; }
      if (cur.includes("storage.onestepsolutionbali.com")) { pfSkipped++; continue; }
      let url = cur;
      if (!isHttp(url)) {
        if (!supabaseUrl) { pfSkipped++; continue; }
        url = `${supabaseUrl}/storage/v1/object/public/invoice/${cur}`;
      }
      try {
        if (!dryRun) {
          const buf = await fetchBuffer(url);
          const ext = (url.split('.').pop() || 'png').toLowerCase();
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'application/octet-stream';
          const nameHint = `profile_image-${p.id_user}.${ext}`;
          const up = await uploadBufferToStorage(buf, 'uploads', ext, mime, nameHint);
          await prisma.profile_user.update({ where: { id_user: p.id_user }, data: { profile_image: up.publicUrl } });
        }
        pfMigrated++;
      } catch (e) { pfErrors++; }
    }
    result.migrated.profile_user = pfMigrated; result.skipped.profile_user = pfSkipped; result.errors.profile_user = pfErrors;

    // 4) Migrate invoice_template assets
    const templates = await prisma.invoice_template.findMany({
      select: { template_id: true, company_id: true, image_logo: true, background: true, header_client: true, footer_client: true, header_partner: true, footer_partner: true },
      take: limit,
    });
    let tmpMigrated = 0, tmpSkipped = 0, tmpErrors = 0;
    for (const t of templates) {
      const fields = ['image_logo','background','header_client','footer_client','header_partner','footer_partner'];
      for (const f of fields) {
        const cur = t[f];
        if (!cur) { tmpSkipped++; continue; }
        if (cur.includes("storage.onestepsolutionbali.com")) { tmpSkipped++; continue; }
        let url = cur;
        if (!isHttp(url)) {
          if (!supabaseUrl) { tmpSkipped++; continue; }
          url = `${supabaseUrl}/storage/v1/object/public/invoice/${cur}`;
        }
        try {
          if (!dryRun) {
            const buf = await fetchBuffer(url);
            const nameHint = `template-${t.company_id}-${f}-${Date.now()}.png`;
            const up = await uploadBufferToStorage(buf, 'uploads', 'png', 'image/png', nameHint);
            await prisma.invoice_template.update({ where: { template_id: t.template_id }, data: { [f]: up.publicUrl } });
          }
          tmpMigrated++;
        } catch (e) { tmpErrors++; }
      }
    }
    result.migrated.invoice_template = tmpMigrated; result.skipped.invoice_template = tmpSkipped; result.errors.invoice_template = tmpErrors;

    return NextResponse.json({ dryRun, limit, result }, { status: 200 });
  } catch (error) {
    console.error("POST /tools/migrate_storage error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

