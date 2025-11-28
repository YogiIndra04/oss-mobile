import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

function requireAdmin(req) {
  const token = req.headers.get("authorization")?.split(" ")[1];
  const decoded = token ? verifyJwt(token) : null;
  if (
    !decoded?.role_user ||
    String(decoded.role_user).toLowerCase() !== "admin"
  ) {
    return null;
  }
  return decoded;
}

function parseIntOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function startOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function startOfNextMonth(year, month) {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return startOfMonth(nextYear, nextMonth);
}

function buildEmptyDaily(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => ({
    date: new Date(Date.UTC(year, month - 1, i + 1)).toISOString().slice(0, 10),
    amount: 0,
    count: 0,
  }));
}

export async function GET(req) {
  try {
    const admin = requireAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Forbidden: admin only" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = parseIntOrNull(searchParams.get("year"));
    const month = parseIntOrNull(searchParams.get("month"));
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year and month are required (numeric)" },
        { status: 400 }
      );
    }

    const rangeStart = startOfMonth(year, month);
    const rangeEnd = startOfNextMonth(year, month);

    // Sales = invoices created in month (all admins, all team)
    const invoices = await prisma.invoices.findMany({
      where: {
        invoice_creation_date: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      select: {
        invoice_creation_date: true,
        total_amount: true,
        invoice_id: true,
      },
    });

    // Payments = verified payment proofs in month (use proof_date fallback created_at)
    const paymentProofs = await prisma.paymentproofs.findMany({
      where: {
        proof_status: "Verified",
        OR: [
          {
            proof_date: {
              gte: rangeStart,
              lt: rangeEnd,
            },
          },
          {
            AND: [
              { proof_date: null },
              {
                created_at: {
                  gte: rangeStart,
                  lt: rangeEnd,
                },
              },
            ],
          },
        ],
      },
      select: {
        proof_amount: true,
        proof_date: true,
        created_at: true,
        payment_proof_id: true,
      },
    });

    const salesDaily = buildEmptyDaily(year, month);
    const paymentsDaily = buildEmptyDaily(year, month);

    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const day = d.getUTCDate();
      const target = salesDaily[day - 1];
      target.count += 1;
      target.amount += Number(inv.total_amount || 0);
    }

    for (const pay of paymentProofs) {
      const dateSource = pay.proof_date || pay.created_at;
      const d = dateSource ? new Date(dateSource) : null;
      if (!d) continue;
      const day = d.getUTCDate();
      const target = paymentsDaily[day - 1];
      target.count += 1;
      target.amount += Number(pay.proof_amount || 0);
    }

    const salesTotalAmount = salesDaily.reduce((acc, it) => acc + it.amount, 0);
    const salesTotalCount = salesDaily.reduce((acc, it) => acc + it.count, 0);
    const paymentsTotalAmount = paymentsDaily.reduce(
      (acc, it) => acc + it.amount,
      0
    );
    const paymentsTotalCount = paymentsDaily.reduce(
      (acc, it) => acc + it.count,
      0
    );

    return NextResponse.json(
      {
        month: rangeStart.toISOString().slice(0, 10),
        sales: {
          total_amount: salesTotalAmount,
          total_count: salesTotalCount,
          daily: salesDaily,
        },
        payments: {
          total_amount: paymentsTotalAmount,
          total_count: paymentsTotalCount,
          daily: paymentsDaily,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /reports/monthly error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
