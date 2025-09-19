import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ CREATE TAC
export async function POST(req) {
  try {
    const body = await req.json();
    const { company_id, tac_description } = body;

    if (!company_id || !tac_description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newTac = await prisma.tac.create({
      data: {
        company_id,
        tac_description,
      },
    });

    return NextResponse.json(newTac, { status: 201 });
  } catch (err) {
    console.error("❌ Error creating TAC:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ GET ALL TAC
export async function GET() {
  try {
    const tacs = await prisma.tac.findMany({
      include: { company: true }, // tampilkan detail company
    });
    return NextResponse.json(tacs, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching TAC:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
