import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";

function isValidYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDate(s) {
  // Prisma @db.Date accepts Date without time; JS Date is fine
  return new Date(s);
}

// GET /api/currency_rates?currency=&on=
// - without params: list all (desc effective_date)
// - currency only: list all for currency (desc effective_date)
// - currency + on=YYYY-MM-DD: return the latest rate <= on (single)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const currency = (searchParams.get("currency") || "").trim().toUpperCase();
    const on = searchParams.get("on");

    if (currency && on) {
      if (!isValidYMD(on)) {
        return NextResponse.json(
          { error: "Invalid 'on' date. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const rate = await prisma.currency_rates.findFirst({
        where: {
          currency_code: currency,
          effective_date: { lte: toDate(on) },
        },
        orderBy: { effective_date: "desc" },
      });
      if (!rate) {
        return NextResponse.json(
          { error: `No rate found for ${currency} on ${on}` },
          { status: 404 }
        );
      }
      return NextResponse.json(rate, { status: 200 });
    }

    const where = currency ? { currency_code: currency } : {};
    const list = await prisma.currency_rates.findMany({
      where,
      orderBy: [{ currency_code: "asc" }, { effective_date: "desc" }],
    });
    return NextResponse.json(list, { status: 200 });
  } catch (error) {
    console.error("GET /currency_rates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/currency_rates (admin)
export async function POST(req) {
  try {
    const token = req.headers.get("authorization")?.split(" ")[1];
    const decoded = token ? verifyJwt(token) : null;
    if (!decoded?.id_user || decoded?.role_user !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const currency_code = (body.currency_code || body.currency || "").trim().toUpperCase();
    const rateRaw = body.rate_to_base ?? body.rate;
    const effective_date = body.effective_date || body.date;
    const source = body.source ? String(body.source).trim() : null;
    const notes = body.notes ? String(body.notes) : null;

    if (!currency_code || rateRaw == null || rateRaw === "" || !effective_date) {
      return NextResponse.json(
        { error: "currency_code, rate, effective_date are required" },
        { status: 400 }
      );
    }
    if (!isValidYMD(effective_date)) {
      return NextResponse.json(
        { error: "Invalid effective_date. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }
    const rate = Number(rateRaw);
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "rate must be a positive number" },
        { status: 400 }
      );
    }

    const exists = await prisma.currency_rates.findUnique({
      where: {
        currency_code_effective_date: {
          currency_code,
          effective_date: toDate(effective_date),
        },
      },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Rate for currency and date already exists" },
        { status: 409 }
      );
    }

    const created = await prisma.currency_rates.create({
      data: {
        currency_code,
        rate_to_base: Number(rate.toFixed(6)),
        effective_date: toDate(effective_date),
        ...(source ? { source } : {}),
        ...(notes ? { notes } : {}),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /currency_rates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
