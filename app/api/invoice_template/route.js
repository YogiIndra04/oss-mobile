import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadTemplateFileToStorage, deleteFromStorage, uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import { verifyJwt } from "@/lib/jwt";
import sharp from "sharp";

// Create invoice template (form-data)
export async function POST(req) {
  try {
    // Optional auth: ensure only authenticated users create
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fd = await req.formData();

    const company_id = fd.get("company_id");
    const template_name = fd.get("template_name"); // Pelanggan | Kerjasama

    const file_logo = fd.get("image_logo");
    const file_background = fd.get("background");
    const file_header_client = fd.get("header_client");
    const file_footer_client = fd.get("footer_client");
    const file_header_partner = fd.get("header_partner");
    const file_footer_partner = fd.get("footer_partner");

    if (!company_id || !template_name) {
      return NextResponse.json(
        { error: "Missing required fields: company_id, template_name" },
        { status: 400 }
      );
    }

    // Upload files to Storage OSS (semua ke 'uploads' dengan penamaan jelas)
    const sub = company_id;
    const process = async (f, kind) => {
      if (!f || !f.name) return null;
      const buf = Buffer.from(await f.arrayBuffer());
      let pipeline = sharp(buf);
      switch (kind) {
        case "logo":
          pipeline = pipeline.resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true });
          break;
        case "header_client":
        case "footer_client":
        case "header_partner":
        case "footer_partner":
          pipeline = pipeline.resize({ width: 2000, height: 400, fit: "cover" });
          break;
        case "background":
          pipeline = pipeline.resize({ width: 1200, height: 1700, fit: "cover" });
          break;
        default:
          pipeline = pipeline.resize({ width: 1600, fit: "inside", withoutEnlargement: true });
      }
      const out = await pipeline.png({ compressionLevel: 9, palette: true, effort: 10 }).toBuffer();
      const nameHint = `template-${sub}-${kind}-${Date.now()}.png`;
      return uploadBufferToStorage(out, "uploads", "png", "image/png", nameHint);
    };

    const uploads = {
      image_logo: await process(file_logo, "logo"),
      background: await process(file_background, "background"),
      header_client: await process(file_header_client, "header_client"),
      footer_client: await process(file_footer_client, "footer_client"),
      header_partner: await process(file_header_partner, "header_partner"),
      footer_partner: await process(file_footer_partner, "footer_partner"),
    };

    const created = await prisma.invoice_template.create({
      data: {
        company_id,
        template_name,
        // Simpan URL publik langsung agar FE bisa pakai apa adanya
        image_logo: uploads.image_logo?.publicUrl || null,
        background: uploads.background?.publicUrl || null,
        header_client: uploads.header_client?.publicUrl || null,
        footer_client: uploads.footer_client?.publicUrl || null,
        header_partner: uploads.header_partner?.publicUrl || null,
        footer_partner: uploads.footer_partner?.publicUrl || null,
      },
    });

    // Tambahkan public URL untuk kemudahan preview di mobile
    // Nilai kolom sudah public URL; tetap kirim alias *_url untuk kompatibilitas
    const withUrls = {
      ...created,
      image_logo_url: created.image_logo,
      background_url: created.background,
      header_client_url: created.header_client,
      footer_client_url: created.footer_client,
      header_partner_url: created.header_partner,
      footer_partner_url: created.footer_partner,
    };

    return NextResponse.json(withUrls, { status: 201 });
  } catch (error) {
    console.error("POST /invoice_template error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// List invoice templates
export async function GET() {
  try {
    const list = await prisma.invoice_template.findMany({
      orderBy: { created_at: "desc" },
      include: { company: { select: { company_id: true, business_name: true, company_name: true } } },
    });
    const data = list.map((t) => ({
      ...t,
      image_logo_url: t.image_logo,
      background_url: t.background,
      header_client_url: t.header_client,
      footer_client_url: t.footer_client,
      header_partner_url: t.header_partner,
      footer_partner_url: t.footer_partner,
    }));
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("GET /invoice_template error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}


