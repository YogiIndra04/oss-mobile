import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET Event by ID
export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const event = await prisma.events.findUnique({
      where: { event_id: id },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE Event
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      event_name,
      event_description,
      event_venue,
      event_address,
      event_date,
      event_cost,
    } = body;

    const updatedEvent = await prisma.events.update({
      where: { event_id: id },
      data: {
        event_name,
        event_description,
        event_venue,
        event_address,
        event_date: event_date ? new Date(event_date) : null,
        event_cost,
      },
    });

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Event
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    await prisma.events.delete({
      where: { event_id: id },
    });

    return NextResponse.json(
      { message: "Event deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
