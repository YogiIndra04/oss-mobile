import supabase from "@/lib/supabase";
import { NextResponse } from "next/server";

// ✅ GET list files from supabase bucket/folder
export async function GET() {
  try {
    const { data, error } = await supabase.storage
      .from("invoice")
      .list("profile_image", { limit: 50, offset: 0 });

    if (error) {
      console.error("❌ Supabase list error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // bikin juga public URL supaya bisa langsung dicek di browser
    const files = data.map((file) => ({
      name: file.name,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/invoice/profile_image/${file.name}`,
      size: file.metadata?.size || null,
      mimetype: file.metadata?.mimetype || null,
      created_at: file.created_at,
      updated_at: file.updated_at,
    }));

    return NextResponse.json({ files }, { status: 200 });
  } catch (err) {
    console.error("❌ API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
