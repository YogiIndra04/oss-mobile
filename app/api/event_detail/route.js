import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// CREATE EventDetail
export async function POST(req) {
  try {
    const body = await req.json();
    const { invoice_id, event_id, quantity, total_event_cost } = body;

    if (!invoice_id || !event_id || !quantity || !total_event_cost) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const newEventDetail = await prisma.eventdetail.create({
      data: {
        invoice_id,
        event_id,
        quantity,
        total_event_cost,
      },
    });

    return NextResponse.json(newEventDetail, { status: 201 });
  } catch (error) {
    console.error("POST /eventdetail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET All EventDetails
export async function GET() {
  try {
    const eventDetails = await prisma.eventdetail.findMany({
      include: {
        invoice: true,
        event: true,
      },
    });

    return NextResponse.json(eventDetails, { status: 200 });
  } catch (error) {
    console.error("GET /eventdetail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
