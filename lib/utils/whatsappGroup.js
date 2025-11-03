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

export async function sendGroupFile(fileUrl, caption = "") {
  try {
    const api_key = env("NEXT_PUBLIC_API_KEY_WATZAP");
    const number_key = env("NEXT_PUBLIC_NUMBER_KEY_WATZAP");
    const group_id = env("NEXT_PUBLIC_NUMBER_GROUP_ID_WATZAP");
    if (!api_key || !number_key || !group_id)
      return { ok: false, skipped: true };

    // Per docs: use key "url" for public file URL
    const { status, data } = await axios.post(`${API_BASE}/send_file_group`, {
      api_key,
      number_key,
      group_id,
      url: fileUrl,
    });
    if (status < 200 || status >= 300) {
      console.error("Watzap send_file_group failed", status, data);
      return { ok: false, status, data };
    }

    // If caption provided, send as a follow-up message
    let messageResult = null;
    const cap = String(caption || "").trim();
    if (cap) {
      messageResult = await sendGroupMessage(cap);
    }
    return { ok: true, status, data, messageResult };
  } catch (e) {
    const err = e;
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (status) console.error("Watzap send_file_group error", status, data);
    return { ok: false, status, data, error: err?.message || String(err) };
  }
}

// no-op: kept for compatibility should we reintroduce fetch
async function safeJson() {
  return null;
}
