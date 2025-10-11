import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadTemplateFile, deleteFromSupabase } from "@/lib/utils/uploadSupabase";
import { verifyJwt } from "@/lib/jwt";

// Get by id
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const data = await prisma.invoice_template.findUnique({
      where: { template_id: id },
      include: { company: { select: { company_id: true, business_name: true, company_name: true } } },
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, { status: 200 });
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

    for (const [formKey, field] of fileMap) {
      const f = fd.get(formKey);
      if (f && f.name) {
        // upload baru dan hapus lama jika ada
        const up = await uploadTemplateFile(f, sub);
        if (existing[field]) {
          try { await deleteFromSupabase(existing[field]); } catch {}
        }
        nextData[field] = up.path;
      }
    }

    const updated = await prisma.invoice_template.update({ where: { template_id: id }, data: nextData });
    return NextResponse.json(updated, { status: 200 });
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

