import { NextResponse } from "next/server";

// Listing storage files is not supported yet.
// TODO(storage): implement LIST via OSS API or DB.
export async function GET() {
  return NextResponse.json(
    { error: "Not Implemented: storage listing is not available yet" },
    { status: 501 }
  );
}

