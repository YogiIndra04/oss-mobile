import supabase from "@/lib/supabase";

// Helper untuk fallback MIME type kalau file.type kosong
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

export async function uploadToSupabase(file, folder = "profile_image") {
  if (!file || !file.name) return null;

  // nama file unik
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  // ubah ke buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // pastikan contentType ada
  const contentType = file.type || getMimeType(file.name);

  // upload ke bucket `invoice`
  const { error } = await supabase.storage
    .from("invoice")
    .upload(fileName, buffer, {
      contentType, // ✅ selalu ada, nggak kosong lagi
      upsert: false, // set true kalau mau overwrite
    });

  if (error) throw error;

  // ambil public URL
  const { data } = supabase.storage.from("invoice").getPublicUrl(fileName);

  return {
    publicUrl: data.publicUrl, // URL full bisa langsung dipakai di frontend
    path: fileName, // relative path untuk delete/update
  };
}

export async function deleteFromSupabase(path) {
  if (!path) return;
  const { error } = await supabase.storage.from("invoice").remove([path]);
  if (error) throw error;
}

// Helper khusus upload aset template invoice
export async function uploadTemplateFile(file, subfolder = "") {
  const base = "templates";
  const folder = subfolder ? `${base}/${subfolder}` : base;
  return uploadToSupabase(file, folder);
}

// Upload buffer yang sudah diproses (mis. via sharp) ke Supabase
export async function uploadBufferToSupabase(buffer, folder = "templates", extension = "png", contentType = "image/png") {
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage
    .from("invoice")
    .upload(fileName, buffer, {
      contentType,
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("invoice").getPublicUrl(fileName);
  return { publicUrl: data.publicUrl, path: fileName };
}
