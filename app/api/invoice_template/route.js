import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { uploadTemplateFile, deleteFromSupabase } from "@/lib/utils/uploadSupabase";
import { verifyJwt } from "@/lib/jwt";

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

    // Upload files to Supabase (folder templates/<company_id>) when present
    const sub = company_id;
    const uploads = {
      image_logo: file_logo && file_logo.name ? await uploadTemplateFile(file_logo, sub) : null,
      background: file_background && file_background.name ? await uploadTemplateFile(file_background, sub) : null,
      header_client:
        file_header_client && file_header_client.name ? await uploadTemplateFile(file_header_client, sub) : null,
      footer_client:
        file_footer_client && file_footer_client.name ? await uploadTemplateFile(file_footer_client, sub) : null,
      header_partner:
        file_header_partner && file_header_partner.name ? await uploadTemplateFile(file_header_partner, sub) : null,
      footer_partner:
        file_footer_partner && file_footer_partner.name ? await uploadTemplateFile(file_footer_partner, sub) : null,
    };

    const created = await prisma.invoice_template.create({
      data: {
        company_id,
        template_name,
        image_logo: uploads.image_logo?.path || null,
        background: uploads.background?.path || null,
        header_client: uploads.header_client?.path || null,
        footer_client: uploads.footer_client?.path || null,
        header_partner: uploads.header_partner?.path || null,
        footer_partner: uploads.footer_partner?.path || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
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
    return NextResponse.json(list, { status: 200 });
  } catch (error) {
    console.error("GET /invoice_template error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

