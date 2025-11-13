import storage from "@/lib/storage";

function getMimeType(fileName, fallback = "application/octet-stream") {
  const ext = fileName.split(".").pop().toLowerCase();
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
  };
  return mimeTypes[ext] || fallback;
}

// Upload a browser File to OSS Storage (single 'uploads' root folder per mentor's guidance)
export async function uploadToStorage(file, folder = "uploads", filename) {
  if (!file || !file.name) return null;
  const ext = file.name.split(".").pop();
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || getMimeType(file.name);
  const { uploadUrl, key, publicUrl } = await storage.createUpload({
    mime: contentType,
    ext,
    folder, // always 'uploads' (flat), see naming note below
    isPublic: true,
    // optional: backend may accept a custom filename suggestion
    ...(filename ? { filename } : {}),
  });
  await storage.putToSignedUrl(uploadUrl, buffer, contentType);
  try {
    await storage.confirmUpload(key);
  } catch {}
  return { publicUrl, path: key };
}

// Delete object placeholder (depends on OSS API)
export async function deleteFromStorage(path) {
  if (!path) return;
  try {
    await storage.deleteObject(path);
  } catch {}
}

// Upload template assets (still into 'uploads'); caller should encode type in filename
export async function uploadTemplateFileToStorage(
  file,
  subfolder = "",
  filename
) {
  return uploadToStorage(file, "uploads", filename);
}

// Upload a Buffer to OSS (e.g., QR/barcode, processed images)
export async function uploadBufferToStorage(
  buffer,
  folder = "uploads",
  extension = "png",
  contentType = "image/png",
  filename
) {
  const { uploadUrl, key, publicUrl } = await storage.createUpload({
    mime: contentType,
    ext: extension,
    folder, // always 'uploads' (flat), see naming note below
    isPublic: true,
    ...(filename ? { filename } : {}),
  });
  await storage.putToSignedUrl(uploadUrl, buffer, contentType);
  try {
    await storage.confirmUpload(key);
  } catch {}
  return { publicUrl, path: key };
}
