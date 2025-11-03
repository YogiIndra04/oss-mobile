import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const currency = (searchParams.get("currency") || "").trim().toUpperCase();
    if (!currency) {
      return NextResponse.json({ error: "currency is required" }, { status: 400 });
    }
    const rate = await prisma.currency_rates.findFirst({
      where: { currency_code: currency },
      orderBy: { effective_date: "desc" },
    });
    if (!rate) {
      return NextResponse.json({ error: `No rate for ${currency}` }, { status: 404 });
    }
    return NextResponse.json(rate, { status: 200 });
  } catch (error) {
    console.error("GET /currency_rates/latest error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

