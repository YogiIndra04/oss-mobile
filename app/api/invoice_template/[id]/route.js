import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadTemplateFile, deleteFromSupabase, uploadBufferToSupabase } from "@/lib/utils/uploadSupabase";
import { verifyJwt } from "@/lib/jwt";
import supabase from "@/lib/supabase";
import sharp from "sharp";

// Get by id
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const data = await prisma.invoice_template.findUnique({
      where: { template_id: id },
      include: { company: { select: { company_id: true, business_name: true, company_name: true } } },
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const toPublic = (p) => (p ? supabase.storage.from("invoice").getPublicUrl(p).data.publicUrl : null);
    const withUrls = {
      ...data,
      image_logo_url: toPublic(data.image_logo),
      background_url: toPublic(data.background),
      header_client_url: toPublic(data.header_client),
      footer_client_url: toPublic(data.footer_client),
      header_partner_url: toPublic(data.header_partner),
      footer_partner_url: toPublic(data.footer_partner),
    };
    return NextResponse.json(withUrls, { status: 200 });
  } catch (error) {
    console.error("GET /invoice_template/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// Update (form-data, any subset of fields)
export async function PUT(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const fd = await req.formData();

    const existing = await prisma.invoice_template.findUnique({ where: { template_id: id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const company_id = fd.get("company_id") || existing.company_id;
    const template_name = fd.get("template_name") || existing.template_name;

    const sub = company_id;
    const nextData = { company_id, template_name };

    const fileMap = [
      ["image_logo", "image_logo"],
      ["background", "background"],
      ["header_client", "header_client"],
      ["footer_client", "footer_client"],
      ["header_partner", "header_partner"],
      ["footer_partner", "footer_partner"],
    ];

    const process = async (buf, kind) => {
      let pipeline = sharp(buf);
      switch (kind) {
        case "image_logo":
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
      return pipeline.png({ compressionLevel: 9, palette: true, effort: 10 }).toBuffer();
    };

    for (const [formKey, field] of fileMap) {
      const f = fd.get(formKey);
      if (f && f.name) {
        const buf = Buffer.from(await f.arrayBuffer());
        const out = await process(buf, field);
        const up = await uploadBufferToSupabase(out, `templates/${sub}`, "png", "image/png");
        if (existing[field]) {
          try { await deleteFromSupabase(existing[field]); } catch {}
        }
        nextData[field] = up.path;
      }
    }

    const updated = await prisma.invoice_template.update({ where: { template_id: id }, data: nextData });
    const toPublic = (p) => (p ? supabase.storage.from("invoice").getPublicUrl(p).data.publicUrl : null);
    const withUrls = {
      ...updated,
      image_logo_url: toPublic(updated.image_logo),
      background_url: toPublic(updated.background),
      header_client_url: toPublic(updated.header_client),
      footer_client_url: toPublic(updated.footer_client),
      header_partner_url: toPublic(updated.header_partner),
      footer_partner_url: toPublic(updated.footer_partner),
    };
    return NextResponse.json(withUrls, { status: 200 });
  } catch (error) {
    console.error("PUT /invoice_template/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// Delete
export async function DELETE(req, { params }) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const existing = await prisma.invoice_template.findUnique({ where: { template_id: id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // hapus file-file terkait
    const paths = [
      existing.image_logo,
      existing.background,
      existing.header_client,
      existing.footer_client,
      existing.header_partner,
      existing.footer_partner,
    ].filter(Boolean);
    for (const p of paths) {
      try { await deleteFromSupabase(p); } catch {}
    }

    await prisma.invoice_template.delete({ where: { template_id: id } });
    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /invoice_template/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
