// Lightweight WhatsApp (Watzap) group sender using axios
// Implements endpoints per provider docs: send_message_group and send_file_group
import axios from "axios";

function env(key, fallback = null) {
  const v = process.env[key];
  return v == null || String(v).length === 0 ? fallback : v;
}

const API_BASE = "https://api.watzap.id/v1";

export async function sendGroupMessage(message) {
  try {
    const api_key = env("NEXT_PUBLIC_API_KEY_WATZAP");
    const number_key = env("NEXT_PUBLIC_NUMBER_KEY_WATZAP");
    const group_id = env("NEXT_PUBLIC_NUMBER_GROUP_ID_WATZAP");
    if (!api_key || !number_key || !group_id)
      return { ok: false, skipped: true };

    const { status, data } = await axios.post(
      `${API_BASE}/send_message_group`,
      {
        api_key,
        number_key,
        group_id,
        message,
        wait_until_send: "1",
      }
    );
    if (status < 200 || status >= 300) {
      console.error("Watzap send_message_group failed", status, data);
      return { ok: false, status, data };
    }
    return { ok: true, status, data };
  } catch (e) {
    const err = e;
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (status) console.error("Watzap send_message_group error", status, data);
    return { ok: false, status, data, error: err?.message || String(err) };
  }
}

// Compatibility wrapper matching mentor's sample name/signature
export async function sendWhatsAppMessage(message) {
  return sendGroupMessage(message);
}

export async function sendGroupFile(fileUrl, caption = "", fileName = null) {
  try {
    const api_key = env("NEXT_PUBLIC_API_KEY_WATZAP");
    const number_key = env("NEXT_PUBLIC_NUMBER_KEY_WATZAP");
    const group_id = env("NEXT_PUBLIC_NUMBER_GROUP_ID_WATZAP");
    if (!api_key || !number_key || !group_id)
      return { ok: false, skipped: true };

    // Normalisasi URL (encode spasi, tanda kurung) dan sertakan file_name .pdf
    let normalizedUrl = String(fileUrl || "").trim();
    try {
      normalizedUrl = encodeURI(normalizedUrl);
    } catch {}

    let file_name = null;
    if (fileName && String(fileName).trim().length) {
      const raw = String(fileName).trim();
      const base = raw.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/-+/g, "-");
      file_name = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
    } else {
      file_name = "invoice.pdf";
      try {
        const u = new URL(normalizedUrl);
        const rawLast = u.pathname.split("/").pop() || "";
        const last = decodeURIComponent(rawLast.split("?")[0]);
        if (last) {
          const base = last
            .replace(/[^a-zA-Z0-9_.-]+/g, "-")
            .replace(/-+/g, "-");
          file_name = base.toLowerCase().endsWith(".pdf")
            ? base
            : `${base}.pdf`;
        }
      } catch {}
    }

    const payload = {
      api_key,
      number_key,
      group_id,
      url: normalizedUrl,
      file_name,
      // Some providers use `filename` instead of `file_name`; send both
      filename: file_name,
      mimetype: "application/pdf",
    };
    const cap = String(caption || "").trim();

    const { status, data } = await axios.post(
      `${API_BASE}/send_file_group`,
      payload
    );
    if (
      status < 200 ||
      status >= 300 ||
      (data && data.status && String(data.status) !== "200")
    ) {
      console.error("Watzap send_file_group failed", status, data);
      // Fallback: kirim URL + caption sebagai message biasa (satu pesan saja)
      const fallback = await sendGroupMessage(
        [String(fileUrl || "").trim(), String(caption || "").trim()]
          .filter(Boolean)
          .join("\n\n")
      );
      return { ok: !!fallback?.ok, status, data, fallback };
    }
    // Success: file sent. If caption present, send as follow-up message so it appears under the file.
    let messageResult = null;
    if (cap) {
      messageResult = await sendGroupMessage(cap);
    }
    return { ok: true, status, data, messageResult };
  } catch (e) {
    const err = e;
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (status) console.error("Watzap send_file_group error", status, data);
    // Fallback: kirim URL + caption sebagai message biasa (satu pesan saja)
    const fallback = await sendGroupMessage(
      [String(fileUrl || "").trim(), String(caption || "").trim()]
        .filter(Boolean)
        .join("\n\n")
    );
    return {
      ok: !!fallback?.ok,
      status,
      data,
      error: err?.message || String(err),
      fallback,
    };
  }
}

// no-op: kept for compatibility should we reintroduce fetch
async function safeJson() {
  return null;
}
