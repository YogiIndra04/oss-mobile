import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

function requireAdmin(req) {
  const token = req.headers.get("authorization")?.split(" ")[1];
  const decoded = token ? verifyJwt(token) : null;
  if (!decoded?.role_user || String(decoded.role_user).toLowerCase() !== "admin") {
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
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const year = parseIntOrNull(searchParams.get("year"));
    if (!year) {
      return NextResponse.json(
        { error: "year is required (numeric)" },
        { status: 400 },
      );
    }

    const rangeStart = startYear(year);
    const rangeEnd = startNextYear(year);
    const prevStart = startYear(year - 1);
    const prevEnd = startYear(year);

    // Payments = verified payment proofs
    const payments = await prisma.paymentproofs.findMany({
      where: {
        proof_status: { in: ["Verified", "Pending", "Rejected"] },
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
        proof_status: true,
        proof_date: true,
        created_at: true,
      },
    });

    const prevAgg = await prisma.paymentproofs.aggregate({
      where: {
        proof_status: "Verified",
        OR: [
          {
            proof_date: {
              gte: prevStart,
              lt: prevEnd,
            },
          },
          {
            AND: [
              { proof_date: null },
              {
                created_at: {
                  gte: prevStart,
                  lt: prevEnd,
                },
              },
            ],
          },
        ],
      },
      _sum: { proof_amount: true },
    });
    const prevTotal = Number(prevAgg?._sum?.proof_amount || 0);

    const months = buildEmptyMonths();
    const statuses = {
      Pending: 0,
      Verified: 0,
      Rejected: 0,
    };

    let totalAmount = 0;
    for (const pay of payments) {
      const dateSource = pay.proof_date || pay.created_at;
      const d = dateSource ? new Date(dateSource) : null;
      if (!d) continue;
      const m = d.getUTCMonth(); // 0-based
      const monthEntry = months[m];
      monthEntry.count += 1;
      const amount = Number(pay.proof_amount || 0);
      if (String(pay.proof_status).toLowerCase() === "verified") {
        monthEntry.amount += amount;
        totalAmount += amount;
      }

      const statusKey =
        String(pay.proof_status || "").charAt(0).toUpperCase() +
        String(pay.proof_status || "").slice(1).toLowerCase();
      if (statuses[statusKey] !== undefined) {
        statuses[statusKey] += 1;
      }
    }

    const growthPercentage =
      prevTotal > 0 ? ((totalAmount - prevTotal) / prevTotal) * 100 : null;

    const availableYears = Array.from(
      new Set([
        year - 2,
        year - 1,
        year,
        year + 1,
      ]),
    ).filter((y) => y > 2000);

    return NextResponse.json(
      {
        year,
        total_amount: totalAmount,
        growth_percentage: growthPercentage,
        statuses: [
          { label: "Payment pending", value: statuses.Pending },
          { label: "Payment verified", value: statuses.Verified },
          { label: "Payment rejected", value: statuses.Rejected },
        ],
        months,
        available_years: availableYears,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /reports/payments/yearly error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
