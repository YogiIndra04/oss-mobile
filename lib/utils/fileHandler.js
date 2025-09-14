import fs from "fs";
import path from "path";

export async function saveUploadedFile(file, folderName) {
  if (!file || !file.name) return null;

  const uploadsDir = path.join(process.cwd(), "public", folderName);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = path.join(uploadsDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  // return relative path untuk simpan di DB
  return `/${folderName}/${fileName}`;
}

export function deleteFileIfExists(relativePath) {
  if (!relativePath) return;

  const filePath = path.join(process.cwd(), "public", relativePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
