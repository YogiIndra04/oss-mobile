const BASE_URL = process.env.STORAGE_API_URL || "https://storage.onestepsolutionbali.com";
const API_KEY = process.env.STORAGE_API_KEY;

async function api(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const headers = Object.assign(
    {
      "content-type": "application/json",
      "x-api-key": API_KEY || "",
    },
    options.headers || {}
  );
  const res = await fetch(url, { ...options, headers });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const message = isJson ? body?.error || body?.message || res.statusText : res.statusText;
    const err = new Error(message || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = body;
    throw err;
  }
  return body;
}

export async function createUpload({ mime, ext, folder = "uploads", isPublic = true, checksum, expiresIn } = {}) {
  // Docs: POST /api/storage/create-upload -> { uploadUrl, key, publicUrl }
  const payload = { mime, ext, folder, isPublic };
  if (checksum) payload.checksum = checksum;
  if (expiresIn) payload.expiresIn = expiresIn;
  return api("/api/storage/create-upload", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function putToSignedUrl(uploadUrl, data, contentType = "application/octet-stream") {
  const headers = { "content-type": contentType };
  const res = await fetch(uploadUrl, { method: "PUT", headers, body: data });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT upload failed: ${res.status} ${text}`);
  }
  // Some providers return ETag in headers; ignore for now
  return true;
}

export async function confirmUpload(key) {
  // Docs: POST /api/storage/confirm -> confirm metadata; optional depending on backend
  return api("/api/storage/confirm", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}

export async function createDownload({ key, expiresIn } = {}) {
  return api("/api/storage/create-download", {
    method: "POST",
    body: JSON.stringify({ key, expiresIn }),
  });
}

// Placeholder for delete/list if backend exposes them in future
export async function deleteObject(/* key */) {
  // TODO(storage): implement when DELETE endpoint is available.
  return false;
}

export default {
  createUpload,
  putToSignedUrl,
  confirmUpload,
  createDownload,
  deleteObject,
};

