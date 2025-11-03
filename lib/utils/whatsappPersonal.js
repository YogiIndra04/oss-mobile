// Lightweight WhatsApp (Watzap) personal chat sender using fetch
// Not used yet, but prepared per request to separate group vs personal.

function env(key, fallback = null) {
  const v = process.env[key];
  return v == null || String(v).length === 0 ? fallback : v;
}

const API_BASE = "https://api.watzap.id/v1";

export async function sendPersonalMessage(phoneNumber, message) {
  try {
    const api_key = env("NEXT_PUBLIC_API_KEY_WATZAP");
    const number_key = env("NEXT_PUBLIC_NUMBER_KEY_WATZAP");
    if (!api_key || !number_key || !phoneNumber)
      return { ok: false, skipped: true };
    const res = await fetch(`${API_BASE}/send_message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key,
        number_key,
        phone_no: phoneNumber,
        message,
        wait_until_send: "1",
      }),
    });
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendPersonalFile(phoneNumber, fileUrl, caption = "") {
  try {
    const api_key = env("NEXT_PUBLIC_API_KEY_WATZAP");
    const number_key = env("NEXT_PUBLIC_NUMBER_KEY_WATZAP");
    if (!api_key || !number_key || !phoneNumber)
      return { ok: false, skipped: true };

    let res = await fetch(`${API_BASE}/send_file`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key,
        number_key,
        phone_no: phoneNumber,
        file_url: fileUrl,
        caption,
        wait_until_send: "1",
      }),
    });

    if (!res.ok) {
      const fallbackMsg = [fileUrl, caption].filter(Boolean).join("\n\n");
      const fb = await sendPersonalMessage(phoneNumber, fallbackMsg);
      return { ok: fb.ok, status: fb.status, data: fb.data, fallback: true };
    }
    const data = await safeJson(res);
    return { ok: true, status: res.status, data };
  } catch (e) {
    const fb = await sendPersonalMessage(
      phoneNumber,
      [String(fileUrl || ""), String(caption || "")]
        .filter(Boolean)
        .join("\n\n")
    );
    return {
      ok: fb.ok,
      status: fb.status,
      data: fb.data,
      error: e?.message || String(e),
      fallback: true,
    };
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
