import prisma from "@/lib/prisma";
import { sendGroupMessage } from "@/lib/utils/whatsappGroup";
import { NextResponse } from "next/server";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function GET() {
  try {
    // Hitung rentang tanggal untuk "besok" berdasarkan timezone server
    const now = new Date();
    const today = startOfDay(now);
    const tomorrowStart = addDays(today, 1);
    const tomorrowEnd = addDays(tomorrowStart, 1); // exclusive upper bound

    // Ambil invoice yang jatuh tempo BESOK dan belum lunas
    const invoices = await prisma.invoices.findMany({
      where: {
        payment_status: { in: ["Belum_dibayar", "Mencicil"] },
        due_date: {
          gte: tomorrowStart,
          lt: tomorrowEnd,
        },
      },
      include: {
        createdBy: {
          select: {
            username: true,
            profile_user: { select: { user_name: true } },
          },
        },
      },
      orderBy: { due_date: "asc" },
    });

    const count = invoices.length;
    const dateLabel = formatYMD(tomorrowStart);

    if (count === 0) {
      return NextResponse.json(
        { ok: true, count: 0, message: "No invoices due tomorrow" },
        { status: 200 }
      );
    }

    const lines = [];
    lines.push(`🔔 Reminder Jatuh Tempo: ${dateLabel}`);
    lines.push(`Total: ${count} invoice`);
    lines.push("");

    const maxList = 20; // batasi agar tidak terlalu panjang di WA
    invoices.slice(0, maxList).forEach((inv, idx) => {
      const creator =
        inv?.createdBy?.profile_user?.user_name ||
        inv?.createdBy?.username ||
        "-";
      const amt = (() => {
        try {
          return Number(inv.unpaid ?? inv.total_amount).toLocaleString("id-ID");
        } catch (_) {
          return String(inv.unpaid ?? inv.total_amount);
        }
      })();
      const due = inv.due_date ? formatYMD(new Date(inv.due_date)) : "-";
      lines.push(
        `${idx + 1}. ${inv.invoice_number} \n· ${
          inv.customer_name
        } \n· IDR ${amt} \n· PIC: ${creator} \n· Jatuh tempo: ${due}`
      );
    });
    if (count > maxList) {
      lines.push(`… dan ${count - maxList} lainnya`);
    }

    const text = lines.join("\n");

    // Kirim ke Group WhatsApp via Watzap
    const wa = await sendGroupMessage(text);

    return NextResponse.json(
      { ok: !!wa?.ok, count, preview: text, wa },
      { status: wa?.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

// Optionally accept POST to allow manual trigger with override date
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const override = body?.date; // YYYY-MM-DD untuk memaksa tanggal

    let targetStart;
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(String(override))) {
      const [y, m, d] = String(override)
        .split("-")
        .map((x) => parseInt(x, 10));
      targetStart = new Date(y, m - 1, d);
    } else {
      const today = startOfDay(new Date());
      targetStart = addDays(today, 1);
    }
    const targetEnd = addDays(targetStart, 1);

    const invoices = await prisma.invoices.findMany({
      where: {
        payment_status: { in: ["Belum_dibayar", "Mencicil"] },
        due_date: { gte: targetStart, lt: targetEnd },
      },
      include: {
        createdBy: {
          select: {
            username: true,
            profile_user: { select: { user_name: true } },
          },
        },
      },
      orderBy: { due_date: "asc" },
    });

    const count = invoices.length;
    const dateLabel = formatYMD(targetStart);

    if (count === 0) {
      return NextResponse.json(
        { ok: true, count: 0, message: "No invoices due for target date" },
        { status: 200 }
      );
    }

    const lines = [];
    lines.push(`🔔 Reminder Jatuh Tempo: ${dateLabel}`);
    lines.push(`Total: ${count} invoice`);
    lines.push("");

    const maxList = 20;
    invoices.slice(0, maxList).forEach((inv, idx) => {
      const creator =
        inv?.createdBy?.profile_user?.user_name ||
        inv?.createdBy?.username ||
        "-";
      const amt = (() => {
        try {
          return Number(inv.unpaid ?? inv.total_amount).toLocaleString("id-ID");
        } catch (_) {
          return String(inv.unpaid ?? inv.total_amount);
        }
      })();
      const due = inv.due_date ? formatYMD(new Date(inv.due_date)) : "-";
      lines.push(
        `${idx + 1}. ${inv.invoice_number} · ${
          inv.customer_name
        } · Rp ${amt} · PIC: ${creator} · Jatuh tempo: ${due}`
      );
    });
    if (count > maxList) {
      lines.push(`… dan ${count - maxList} lainnya`);
    }

    const text = lines.join("\n");
    const wa = await sendGroupMessage(text);

    return NextResponse.json(
      { ok: !!wa?.ok, count, preview: text, wa },
      { status: wa?.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
