import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const CRON_SECRET_KEY = process.env.CRON_SECRET_KEY;
function authenticateCron(req) {
  const provided = req.headers.get("x-cron-secret");
  if (!CRON_SECRET_KEY || provided !== CRON_SECRET_KEY) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  return null;
}

function normalizeDate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function POST(req) {
  const authResponse = authenticateCron(req);
  if (authResponse) return authResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const override = typeof body?.asOfDate === "string" ? body.asOfDate : null;
    const cutoffDate = override ? normalizeDate(override) : normalizeDate(new Date());

    const result = await prisma.invoices.updateMany({
      where: {
        due_date: { lt: cutoffDate },
        payment_status: { in: ["Belum_dibayar", "Mencicil"] },
      },
      data: { payment_status: "Jatuh_tempo" },
    });

    return NextResponse.json(
      {
        ok: true,
        updated: result.count,
        cutoffDate: cutoffDate.toISOString().slice(0, 10),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("cron invoices/overdue-filter error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
