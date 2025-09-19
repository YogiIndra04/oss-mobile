import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// ✅ GET EventDetail by ID
export async function GET(req, { params }) {
  try {
    const { id } = params;

    const eventDetail = await prisma.eventDetail.findUnique({
      where: { event_detail_id: id },
      include: {
        invoice: true,
        event: true,
      },
    });

    if (!eventDetail) {
      return NextResponse.json(
        { error: "EventDetail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(eventDetail, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ UPDATE EventDetail
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { quantity, total_event_cost } = body;

    const updatedEventDetail = await prisma.eventDetail.update({
      where: { event_detail_id: id },
      data: { quantity, total_event_cost },
    });

    return NextResponse.json(updatedEventDetail, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ✅ DELETE EventDetail
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    await prisma.eventDetail.delete({
      where: { event_detail_id: id },
    });

    return NextResponse.json(
      { message: "EventDetail deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
