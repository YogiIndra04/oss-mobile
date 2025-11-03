import prisma from "@/lib/prisma";
import { verifyJwt } from "@/lib/jwt";
import { NextResponse } from "next/server";

function mapStatus(value) {
  if (!value) return null;
  const m = {
    paid: "Lunas",
    unpaid: "Belum_dibayar",
    progress: "Mencicil",
    overdue: "Jatuh_tempo",
  };
  const key = String(value).trim().toLowerCase();
  return m[key] || value; // allow direct DB values
}

function parseYMD(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  // JS Date will treat as UTC midnight depending on env; we will use range [from, toNext)
  return new Date(t + "T00:00:00Z");
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const createdByParam =
      searchParams.get("created_by") || searchParams.get("created_by_user_id");
    const q = (searchParams.get("q") || "").trim();
    const statusRaw = (searchParams.get("status") || "").trim();
    const dateFromRaw = searchParams.get("date_from");
    const dateToRaw = searchParams.get("date_to");

    const mappedStatus = mapStatus(statusRaw);

    // Default scoping: konsultan hanya melihat miliknya jika tidak kirim created_by
    let creatorId = createdByParam || null;
    try {
      const token = req.headers.get("authorization")?.split(" ")[1];
      const decoded = token ? verifyJwt(token) : null;
      if (!creatorId && decoded?.role_user === "konsultan" && decoded?.id_user) {
        creatorId = decoded.id_user;
      }
    } catch {}

    // Date range on invoice_creation_date (fallback ke created_at jika perlu di masa depan)
    const from = parseYMD(dateFromRaw);
    const toStart = parseYMD(dateToRaw);
    let to = null;
    if (toStart) {
      to = new Date(toStart);
      to.setUTCDate(to.getUTCDate() + 1); // exclusive upper bound (next day)
    }

    const where = {
      ...(creatorId ? { created_by_user_id: creatorId } : { created_by_user_id: { not: null } }),
      ...(mappedStatus ? { payment_status: mappedStatus } : {}),
      ...(q
        ? {
            OR: [
              { invoice_number: { contains: q, mode: "insensitive" } },
              { customer_name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            invoice_creation_date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    };

    // Group by creator + status
    const grouped = await prisma.invoices.groupBy({
      by: ["created_by_user_id", "payment_status"],
      where,
      _count: { _all: true },
    });

    if (!grouped.length) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const userIds = Array.from(
      new Set(grouped.map((g) => g.created_by_user_id).filter(Boolean))
    );
    const users = await prisma.users.findMany({
      where: { id_user: { in: userIds } },
      select: {
        id_user: true,
        username: true,
        profile_user: { select: { user_name: true } },
      },
    });
    const userMap = new Map();
    for (const u of users) userMap.set(u.id_user, u);

    const acc = new Map();
    for (const row of grouped) {
      const uid = row.created_by_user_id;
      if (!uid) continue;
      const key = uid;
      if (!acc.has(key)) {
        const u = userMap.get(uid);
        acc.set(key, {
          user_id: uid,
          user_name: u?.profile_user?.user_name || u?.username || null,
          total: 0,
          paid: 0,
          unpaid: 0,
          progress: 0,
          overdue: 0,
        });
      }
      const item = acc.get(key);
      const c = Number(row._count?._all || 0);
      item.total += c;
      switch (row.payment_status) {
        case "Lunas":
          item.paid += c;
          break;
        case "Belum_dibayar":
          item.unpaid += c;
          break;
        case "Mencicil":
          item.progress += c;
          break;
        case "Jatuh_tempo":
          item.overdue += c;
          break;
        default:
          break;
      }
    }

    const data = Array.from(acc.values()).sort((a, b) => b.total - a.total);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("GET /invoices/overview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

