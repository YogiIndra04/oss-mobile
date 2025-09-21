import supabase from "@/lib/supabase";

export async function uploadToSupabase(file, folder = "profile_image") {
  if (!file || !file.name) return null;

  // nama file unik
  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  // ubah ke buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // upload ke bucket `invoice`
  const { error } = await supabase.storage
    .from("invoice")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false, // set true kalau mau overwrite
    });

  if (error) throw error;

  // ambil public URL
  const { data: publicUrlData } = supabase.storage
    .from("invoice")
    .getPublicUrl(fileName);

  return {
    publicUrl: publicUrlData.publicUrl, // URL untuk disimpan di DB
    path: fileName, // path internal Supabase untuk delete/update
  };
}

export async function deleteFromSupabase(path) {
  if (!path) return;
  const { error } = await supabase.storage.from("invoice").remove([path]);
  if (error) throw error;
}
