import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// CREATE Event
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      event_name,
      event_description,
      event_venue,
      event_address,
      event_date,
      event_cost,
    } = body;

    if (!event_name) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    const newEvent = await prisma.events.create({
      data: {
        event_name,
        event_description,
        event_venue,
        event_address,
        event_date: event_date ? new Date(event_date) : null,
        event_cost,
      },
    });

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET All Events
export async function GET() {
  try {
    const events = await prisma.events.findMany({ orderBy: { created_at: "desc" } });
    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
