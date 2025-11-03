import { sendGroupFile, sendGroupMessage } from "@/lib/utils/whatsappGroup";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await sendGroupMessage("[DEBUG] Ping from API");
    return NextResponse.json(
      { ok: !!res?.ok, result: res },
      { status: res?.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const msg = body?.message;
    const url = body?.url;
    if (url) {
      const res = await sendGroupFile(url, msg || "");
      return NextResponse.json(
        { ok: !!res?.ok, result: res },
        { status: res?.ok ? 200 : 500 }
      );
    }
    const res = await sendGroupMessage(msg || "[DEBUG] Test message");
    return NextResponse.json(
      { ok: !!res?.ok, result: res },
      { status: res?.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
