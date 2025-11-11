import { verifyJwt } from "@/lib/jwt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function monthRange(year, month) {
  // month: 1-12
  const y = year;
  const m0 = month - 1;
  const start = new Date(y, m0, 1, 0, 0, 0, 0);
  const end = new Date(y, m0 + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const year = toInt(searchParams.get("year"));
    const month = toInt(searchParams.get("month"));
    const dateFieldRaw = (searchParams.get("date_field") || "due")
      .trim()
      .toLowerCase();
    const createdByParam =
      searchParams.get("created_by") || searchParams.get("created_by_user_id");
    const statusRaw = (searchParams.get("status") || "").trim();

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year and month are required (month 1-12)" },
        { status: 400 }
      );
    }

    const { start, end } = monthRange(year, month);

    // Map status aliases
    const statusMap = {
      paid: "Lunas",
      unpaid: "Belum_dibayar",
      progress: "Mencicil",
      overdue: "Jatuh_tempo",
    };
    let mappedStatus = null;
    if (statusRaw) {
      const key = statusRaw.toLowerCase();
      mappedStatus = statusMap[key] || statusRaw;
    }

    // Default scoping: konsultan hanya melihat miliknya jika created_by tidak dikirim
    let creatorId = createdByParam || null;
    try {
      const token = req.headers.get("authorization")?.split(" ")[1];
      const decoded = token ? verifyJwt(token) : null;
      if (
        !creatorId &&
        decoded?.role_user === "konsultan" &&
        decoded?.id_user
      ) {
        creatorId = decoded.id_user;
      }
    } catch {}

    const byCreated = dateFieldRaw === "created";

    // Build where for date range
    let whereDate = {};
    if (byCreated) {
      whereDate = {
        invoice_creation_date: { gte: start, lt: end },
      };
    } else {
      // date_field=due with fallback to creation date when due_date is NULL
      whereDate = {
        OR: [
          { due_date: { gte: start, lt: end } },
          {
            AND: [
              { due_date: null },
              { invoice_creation_date: { gte: start, lt: end } },
            ],
          },
        ],
      };
    }

    const where = {
      ...(creatorId ? { created_by_user_id: creatorId } : {}),
      ...(mappedStatus ? { payment_status: mappedStatus } : {}),
      ...whereDate,
    };

    const items = await prisma.invoices.findMany({
      where,
      select: {
        invoice_id: true,
        invoice_number: true,
        customer_name: true,
        due_date: true,
        invoice_creation_date: true,
        payment_status: true,
        total_amount: true,
        unpaid: true,
        created_by_user_id: true,
        createdBy: {
          select: {
            id_user: true,
            username: true,
            profile_user: { select: { user_name: true } },
          },
        },
      },
      orderBy: [
        // Prioritaskan due_date, lalu creation date, agar stabil di kalender
        { due_date: "asc" },
        { invoice_creation_date: "asc" },
      ],
    });

    // Normalisasi angka & flatten createdBy agar FE nyaman
    const data = items.map((x) => {
      const creatorName =
        x.createdBy?.profile_user?.user_name || x.createdBy?.username || null;
      return {
        invoice_id: x.invoice_id,
        invoice_number: x.invoice_number,
        customer_name: x.customer_name,
        due_date: x.due_date,
        invoice_creation_date: x.invoice_creation_date,
        payment_status: x.payment_status,
        total_amount: x.total_amount != null ? Number(x.total_amount) : 0,
        unpaid: x.unpaid != null ? Number(x.unpaid) : 0,
        created_by_user_id:
          x.created_by_user_id || x.createdBy?.id_user || null,
        created_by: creatorName,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("GET /invoices/calendar error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
