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

function startOfWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7; // Monday=1 .. Sunday=7
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
    // Mendukung bucket minggu dalam sebuah bulan (Week 1..5)
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

function aggregateTrend(invoices, range) {
  if (range.period === "week") {
    const buckets = zeroBuckets(WEEK_LABELS_ID);
    for (const inv of invoices) {
      const d = inv.invoice_creation_date
        ? new Date(inv.invoice_creation_date)
        : null;
      if (!d) continue;
      const idx = (d.getUTCDay() + 6) % 7; // Monday=0
      buckets[idx].value += Number(inv.total_amount || 0);
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
      trend[idx].value += Number(inv.total_amount || 0);
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
        trend[idx].value += Number(inv.total_amount || 0);
      }
    }
    return trend;
  }

  // year
  const trend = zeroBuckets(MONTH_LABELS_ID);
  for (const inv of invoices) {
    const d = inv.invoice_creation_date
      ? new Date(inv.invoice_creation_date)
      : null;
    if (!d) continue;
    const idx = d.getUTCMonth();
    trend[idx].value += Number(inv.total_amount || 0);
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
  const totalRevenue = invoices.reduce(
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
  const paid = invoices.filter(
    (inv) => String(inv.payment_status || "").toLowerCase() === "lunas"
  ).length;
  const totalInvoice = invoices.length;
  const paidRatio = totalInvoice > 0 ? paid / totalInvoice : 0;

  return {
    total_revenue: totalRevenue,
    outstanding,
    invoice_overdue: invoiceOverdue,
    total_invoice: totalInvoice,
    paid_ratio: paidRatio,
    cash_in: cashIn,
  };
}

async function fetchConsultantPerformance(range, consultantId) {
  const whereBase = {
    invoice_creation_date: {
      gte: range.start,
      lt: range.end,
    },
  };
  if (consultantId) whereBase.created_by_user_id = consultantId;

  const grouped = await prisma.invoices.groupBy({
    by: ["created_by_user_id"],
    where: { created_by_user_id: { not: null }, ...whereBase },
    _count: { _all: true },
    _sum: { total_amount: true },
  });
  if (!grouped.length) return [];
  const ids = grouped.map((g) => g.created_by_user_id).filter(Boolean);
  const users = await prisma.users.findMany({
    where: { id_user: { in: ids } },
    select: {
      id_user: true,
      username: true,
      profile_user: { select: { user_name: true } },
    },
  });
  const nameMap = new Map();
  for (const u of users) {
    const name = u?.profile_user?.user_name || u?.username || u?.id_user;
    nameMap.set(u.id_user, name);
  }
  return grouped
    .map((g) => ({
      consultant: nameMap.get(g.created_by_user_id) || g.created_by_user_id,
      count: g._count?._all || 0,
      amount: Number(g._sum?.total_amount || 0),
    }))
    .sort((a, b) => b.count - a.count);
}

async function fetchUpcomingDue(range, limit, consultantId) {
  const now = new Date();
  const horizon = addDays(now, 14);
  const items = await prisma.invoices.findMany({
    where: {
      ...(consultantId ? { created_by_user_id: consultantId } : {}),
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

async function fetchRecentActivity(range, limit, consultantId) {
  const invoices = await prisma.invoices.findMany({
    where: {
      ...(consultantId ? { created_by_user_id: consultantId } : {}),
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

async function fetchAlerts(range, consultantId) {
  const overdue7 = await prisma.invoices.count({
    where: {
      ...(consultantId ? { created_by_user_id: consultantId } : {}),
      payment_status: "Jatuh_tempo",
      due_date: { not: null },
      AND: [
        { due_date: { lt: addDays(new Date(), -7) } },
        { invoice_creation_date: { lt: range.end } },
      ],
    },
  });
  const paymentWaiting = await prisma.paymentproofs.count({
    where: {
      ...(consultantId
        ? { invoice: { created_by_user_id: consultantId } }
        : {}),
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
    notes.push(`Ada ${overdue7} invoice melewati jatuh tempo > 7 hari.`);
  if (paymentWaiting > 0)
    notes.push(`${paymentWaiting} bukti pembayaran menunggu verifikasi.`);
  return {
    overdue_gt_7_days: overdue7,
    payment_waiting_verify: paymentWaiting,
    notes,
  };
}

async function sumCashIn(range, consultantId) {
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
      ...(consultantId
        ? { invoice: { created_by_user_id: consultantId } }
        : {}),
    },
    _sum: { proof_amount: true },
  });
  return Number(agg?._sum?.proof_amount || 0);
}

async function fetchUserOptions() {
  const users = await prisma.users.findMany({
    where: {
      role_user: { in: ["admin", "konsultan"] },
    },
    select: {
      id_user: true,
      role_user: true,
      username: true,
      profile_user: { select: { user_name: true } },
    },
    orderBy: [{ role_user: "asc" }, { username: "asc" }],
  });
  return users.map((u) => ({
    id: u.id_user,
    role: u.role_user,
    name: u.profile_user?.user_name || u.username || u.id_user,
    username: u.username,
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
    const range = periodRange(searchParams);
    const consultantId =
      (searchParams.get("consultant_id") || "").trim() || null;
    const includeUsers =
      (searchParams.get("include_users") || "").trim().toLowerCase() === "true";
    const limitDue = parseIntOrNull(searchParams.get("limit_due")) || 5;
    const limitActivity =
      parseIntOrNull(searchParams.get("limit_activity")) || 5;

    const invoices = await prisma.invoices.findMany({
      where: {
        invoice_creation_date: {
          gte: range.start,
          lt: range.end,
        },
        ...(consultantId ? { created_by_user_id: consultantId } : {}),
      },
      select: {
        invoice_id: true,
        invoice_number: true,
        customer_name: true,
        invoice_creation_date: true,
        payment_status: true,
        payment_date: true,
        due_date: true,
        total_amount: true,
        unpaid: true,
        created_by_user_id: true,
      },
    });

    const cash_in = await sumCashIn(range, consultantId);
    const kpis = computeKpi(invoices, cash_in);
    const status_distribution = groupStatus(invoices);
    const revenue_trend = aggregateTrend(invoices, range);
    const consultant_performance = await fetchConsultantPerformance(
      range,
      consultantId
    );
    const upcoming_due = await fetchUpcomingDue(range, limitDue, consultantId);
    const recent_activity = await fetchRecentActivity(
      range,
      limitActivity,
      consultantId
    );
    const alerts = await fetchAlerts(range, consultantId);
    const users = includeUsers ? await fetchUserOptions() : undefined;

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
        consultant_performance,
        target: null, // placeholder if later we store team target
        cash_in,
        upcoming_due,
        recent_activity,
        alerts,
        ...(includeUsers ? { users } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /dashboard/admin error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
