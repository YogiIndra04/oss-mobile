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

function startYear(year) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function startNextYear(year) {
  return startYear(year + 1);
}

function buildEmptyMonths() {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
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
    if (!year) {
      return NextResponse.json(
        { error: "year is required (numeric)" },
        { status: 400 }
      );
    }

    const rangeStart = startYear(year);
    const rangeEnd = startNextYear(year);
    const prevStart = startYear(year - 1);
    const prevEnd = startYear(year);

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
        payment_status: true,
      },
    });

    const prevAgg = await prisma.invoices.aggregate({
      where: {
        invoice_creation_date: {
          gte: prevStart,
          lt: prevEnd,
        },
      },
      _sum: { total_amount: true },
    });
    const prevTotal = Number(prevAgg?._sum?.total_amount || 0);

    const months = buildEmptyMonths();
    let paidCount = 0;
    let progressCount = 0;
    let overdueCount = 0;

    let totalAmount = 0;
    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const m = d.getUTCMonth(); // 0-based
      const monthEntry = months[m];
      monthEntry.count += 1;
      const amount = Number(inv.total_amount || 0);
      monthEntry.amount += amount;
      totalAmount += amount;

      const status = String(inv.payment_status || "").toLowerCase();
      if (status === "lunas") paidCount += 1;
      else if (status === "mencicil") progressCount += 1;
      else if (status === "jatuh_tempo") overdueCount += 1;
    }
    const totalInvoice = invoices.length;

    const growthPercentage =
      prevTotal > 0 ? ((totalAmount - prevTotal) / prevTotal) * 100 : null;

    const availableYears = Array.from(
      new Set([
        year - 2,
        year - 1,
        year,
        year + 1, // simple helper; UI can clamp as needed
      ])
    ).filter((y) => y > 2000);

    return NextResponse.json(
      {
        year,
        total_amount: totalAmount,
        growth_percentage: growthPercentage,
        statuses: [
          { label: "Invoice dibuat", value: totalInvoice },
          { label: "Invoice fully paid", value: paidCount },
          { label: "Invoice in progress", value: progressCount },
          { label: "Invoice overdue", value: overdueCount },
        ],
        months,
        available_years: availableYears,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /reports/sales/yearly error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
