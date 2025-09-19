import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;
    const tac = await prisma.tac.findUnique({
      where: { tac_id: id },
      include: { company: true },
    });

    if (!tac) {
      return NextResponse.json({ error: "TAC not found" }, { status: 404 });
    }

    return NextResponse.json(tac, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching TAC:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ UPDATE
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { tac_description } = body;

    const updatedTac = await prisma.tac.update({
      where: { tac_id: id },
      data: {
        tac_description,
      },
    });

    return NextResponse.json(updatedTac, { status: 200 });
  } catch (err) {
    console.error("❌ Error updating TAC:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ✅ DELETE
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    await prisma.tac.delete({
      where: { tac_id: id },
    });

    return NextResponse.json({ message: "TAC deleted" }, { status: 200 });
  } catch (err) {
    console.error("❌ Error deleting TAC:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
