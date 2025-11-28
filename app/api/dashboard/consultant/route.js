import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const WEEK_LABELS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTH_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function requireConsultant(req) {
  const token = req.headers.get("authorization")?.split(" ")[1];
  const decoded = token ? verifyJwt(token) : null;
  if (
    !decoded?.role_user ||
    String(decoded.role_user).toLowerCase() !== "konsultan"
  ) {
    return null;
  }
  return decoded;
}

function parseIntOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function startOfWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7; // Monday=1..Sunday=7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function startOfQuarter(year, quarter) {
  const month = (quarter - 1) * 3 + 1;
  return startOfMonth(year, month);
}

function startOfYear(year) {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function addMonths(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function periodRange(params) {
  const now = new Date();
  const period = (params.get("period") || "month").toLowerCase();
  const yearParam = parseIntOrNull(params.get("year"));
  const monthParam = parseIntOrNull(params.get("month"));
  const weekParam = parseIntOrNull(params.get("week"));
  const quarterParam = parseIntOrNull(params.get("quarter"));

  if (period === "week") {
    const y = yearParam || now.getUTCFullYear();
    const m = monthParam || now.getUTCMonth() + 1;
    const weekBucket = weekParam || 1;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const startDay = Math.max(1, (weekBucket - 1) * 7 + 1);
    const endDay = Math.min(daysInMonth + 1, startDay + 7);
    const start = new Date(Date.UTC(y, m - 1, startDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, endDay, 0, 0, 0, 0));
    return {
      period: "week",
      start,
      end,
      label: "week",
      week: weekBucket,
      year: y,
      month: m,
    };
  }

  if (period === "quarter") {
    const q = quarterParam || Math.floor(now.getUTCMonth() / 3) + 1;
    const y = yearParam || now.getUTCFullYear();
    const start = startOfQuarter(y, q);
    const end = addMonths(start, 3);
    return { period: "quarter", start, end, quarter: q, year: y };
  }

  if (period === "year") {
    const y = yearParam || now.getUTCFullYear();
    const start = startOfYear(y);
    const end = startOfYear(y + 1);
    return { period: "year", start, end, year: y };
  }

  // default month
  const y = yearParam || now.getUTCFullYear();
  const m = monthParam || now.getUTCMonth() + 1;
  const start = startOfMonth(y, m);
  const end = addMonths(start, 1);
  return { period: "month", start, end, month: m, year: y };
}

function mapStatusLabel(paymentStatus) {
  const key = String(paymentStatus || "").toLowerCase();
  if (key === "lunas") return "Paid";
  if (key === "belum_dibayar") return "Unpaid";
  if (key === "mencicil") return "In Progress";
  if (key === "jatuh_tempo") return "Overdue";
  return paymentStatus || "Unknown";
}

function zeroBuckets(labels) {
  return labels.map((label) => ({ label, value: 0 }));
}

function bucketMonthWeeks(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const buckets = ["W1", "W2", "W3", "W4", "W5"];
  return {
    buckets,
    dayToIndex: (day) => Math.min(Math.floor((day - 1) / 7), 4),
    totalDays: days,
  };
}

function aggregateTrend(invoices, range, mode = "amount") {
  // mode: "amount" or "count"
  if (range.period === "week") {
    const buckets = zeroBuckets(WEEK_LABELS_ID);
    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const idx = (d.getUTCDay() + 6) % 7;
      buckets[idx].value +=
        mode === "amount" ? Number(inv.total_amount || 0) : 1;
    }
    return buckets;
  }

  if (range.period === "month") {
    const { buckets, dayToIndex } = bucketMonthWeeks(range.start);
    const trend = zeroBuckets(buckets);
    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const day = d.getUTCDate();
      const idx = dayToIndex(day);
      trend[idx].value += mode === "amount" ? Number(inv.total_amount || 0) : 1;
    }
    return trend;
  }

  if (range.period === "quarter") {
    const labels = MONTH_LABELS_ID.slice(
      range.start.getUTCMonth(),
      range.start.getUTCMonth() + 3
    );
    const trend = zeroBuckets(labels);
    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const m = d.getUTCMonth();
      const idx = m - range.start.getUTCMonth();
      if (idx >= 0 && idx < trend.length) {
        trend[idx].value +=
          mode === "amount" ? Number(inv.total_amount || 0) : 1;
      }
    }
    return trend;
  }

  const trend = zeroBuckets(MONTH_LABELS_ID);
  for (const inv of invoices) {
    const d = inv.invoice_creation_date
      ? new Date(inv.invoice_creation_date)
      : null;
    if (!d) continue;
    const idx = d.getUTCMonth();
    trend[idx].value += mode === "amount" ? Number(inv.total_amount || 0) : 1;
  }
  return trend;
}

function groupStatus(invoices) {
  const acc = new Map();
  for (const inv of invoices) {
    const label = mapStatusLabel(inv.payment_status);
    const current = acc.get(label) || 0;
    acc.set(label, current + 1);
  }
  return Array.from(acc.entries()).map(([status, count]) => ({
    status,
    count,
  }));
}

function computeKpi(invoices, cashIn = 0) {
  const totalInvoice = invoices.length;
  const myRevenue = invoices.reduce(
    (s, inv) => s + Number(inv.total_amount || 0),
    0
  );
  const outstanding = invoices
    .filter((inv) =>
      ["belum_dibayar", "mencicil", "jatuh_tempo"].includes(
        String(inv.payment_status || "").toLowerCase()
      )
    )
    .reduce((s, inv) => s + Number(inv.unpaid ?? inv.total_amount ?? 0), 0);
  const invoiceOverdue = invoices.filter(
    (inv) => String(inv.payment_status || "").toLowerCase() === "jatuh_tempo"
  ).length;
  return {
    my_revenue: myRevenue,
    outstanding,
    invoice_overdue: invoiceOverdue,
    total_invoice: totalInvoice,
    cash_in: cashIn,
  };
}

async function fetchDueSoon(range, userId, limit) {
  const now = new Date();
  const horizon = addDays(now, 14);
  const items = await prisma.invoices.findMany({
    where: {
      created_by_user_id: userId,
      OR: [
        { due_date: { gte: now, lte: horizon } },
        { payment_status: "Jatuh_tempo" },
      ],
    },
    orderBy: [{ due_date: "asc" }, { invoice_creation_date: "desc" }],
    take: limit,
    select: {
      invoice_id: true,
      invoice_number: true,
      customer_name: true,
      due_date: true,
      payment_status: true,
      total_amount: true,
    },
  });
  return items.map((inv) => ({
    invoice_id: inv.invoice_id,
    invoice_number: inv.invoice_number,
    customer: inv.customer_name,
    due_date: inv.due_date,
    status: mapStatusLabel(inv.payment_status),
    amount: Number(inv.total_amount || 0),
  }));
}

async function fetchRecentActivity(range, userId, limit) {
  const invoices = await prisma.invoices.findMany({
    where: {
      created_by_user_id: userId,
      invoice_creation_date: { gte: range.start, lt: range.end },
    },
    orderBy: { invoice_creation_date: "desc" },
    take: limit * 2,
    select: {
      invoice_id: true,
      invoice_number: true,
      customer_name: true,
      invoice_creation_date: true,
      payment_status: true,
      total_amount: true,
    },
  });

  const paymentProofs = await prisma.paymentproofs.findMany({
    where: {
      invoice: { created_by_user_id: userId },
      proof_status: { in: ["Verified", "Pending", "Rejected"] },
      OR: [
        { proof_date: { gte: range.start, lt: range.end } },
        {
          AND: [
            { proof_date: null },
            { created_at: { gte: range.start, lt: range.end } },
          ],
        },
      ],
    },
    orderBy: { created_at: "desc" },
    take: limit * 2,
    select: {
      payment_proof_id: true,
      invoice_id: true,
      proof_status: true,
      proof_amount: true,
      proof_date: true,
      created_at: true,
    },
  });

  const combined = [];
  for (const inv of invoices) {
    combined.push({
      type: "invoice",
      id: inv.invoice_id,
      title: inv.invoice_number,
      customer: inv.customer_name,
      date: inv.invoice_creation_date,
      status: mapStatusLabel(inv.payment_status),
      amount: Number(inv.total_amount || 0),
      note: "Created",
    });
  }
  for (const pay of paymentProofs) {
    combined.push({
      type: "payment_proof",
      id: pay.payment_proof_id,
      invoice_id: pay.invoice_id,
      title: pay.payment_proof_id,
      date: pay.proof_date || pay.created_at,
      status: pay.proof_status,
      amount: Number(pay.proof_amount || 0),
      note: pay.proof_status,
    });
  }

  combined.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
  return combined.slice(0, limit);
}

async function fetchAlerts(range, userId) {
  const overdue7 = await prisma.invoices.count({
    where: {
      created_by_user_id: userId,
      payment_status: "Jatuh_tempo",
      due_date: { not: null, lt: addDays(new Date(), -7) },
      invoice_creation_date: { lt: range.end },
    },
  });
  const paymentWaiting = await prisma.paymentproofs.count({
    where: {
      invoice: { created_by_user_id: userId },
      proof_status: "Pending",
      OR: [
        { proof_date: { gte: range.start, lt: range.end } },
        {
          AND: [
            { proof_date: null },
            { created_at: { gte: range.start, lt: range.end } },
          ],
        },
      ],
    },
  });
  const notes = [];
  if (overdue7 > 0)
    notes.push(`Follow-up ${overdue7} invoice overdue > 7 hari.`);
  if (paymentWaiting > 0)
    notes.push(`${paymentWaiting} bukti pembayaran menunggu verifikasi admin.`);
  return {
    overdue_gt_7_days: overdue7,
    payment_waiting_admin: paymentWaiting,
    notes,
  };
}

async function sumCashIn(range, userId) {
  const agg = await prisma.paymentproofs.aggregate({
    where: {
      proof_status: "Verified",
      OR: [
        { proof_date: { gte: range.start, lt: range.end } },
        {
          AND: [
            { proof_date: null },
            { created_at: { gte: range.start, lt: range.end } },
          ],
        },
      ],
      invoice: { created_by_user_id: userId },
    },
    _sum: { proof_amount: true },
  });
  return Number(agg?._sum?.proof_amount || 0);
}

export async function GET(req) {
  try {
    const user = requireConsultant(req);
    if (!user?.id_user) {
      return NextResponse.json(
        { error: "Forbidden: consultant only" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const range = periodRange(searchParams);
    const limitDue = parseIntOrNull(searchParams.get("limit_due")) || 5;
    const limitActivity =
      parseIntOrNull(searchParams.get("limit_activity")) || 5;

    const invoices = await prisma.invoices.findMany({
      where: {
        created_by_user_id: user.id_user,
        invoice_creation_date: {
          gte: range.start,
          lt: range.end,
        },
      },
      select: {
        invoice_id: true,
        invoice_number: true,
        customer_name: true,
        invoice_creation_date: true,
        payment_status: true,
        due_date: true,
        total_amount: true,
        unpaid: true,
      },
    });

    const cash_in = await sumCashIn(range, user.id_user);
    const kpis = computeKpi(invoices, cash_in);
    const status_distribution = groupStatus(invoices);
    const revenue_trend = aggregateTrend(invoices, range, "amount");
    const invoice_count_trend = aggregateTrend(invoices, range, "count");
    const due_soon = await fetchDueSoon(range, user.id_user, limitDue);
    const recent_activity = await fetchRecentActivity(
      range,
      user.id_user,
      limitActivity
    );
    const alerts = await fetchAlerts(range, user.id_user);

    return NextResponse.json(
      {
        period: range.period,
        range: {
          year: range.year ?? range.start.getUTCFullYear(),
          month: range.month,
          quarter: range.quarter,
          week: range.week,
        },
        kpis,
        status_distribution,
        revenue_trend,
        invoice_count_trend,
        due_soon,
        recent_activity,
        alerts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /dashboard/consultant error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
