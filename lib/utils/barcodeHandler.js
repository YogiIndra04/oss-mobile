// import fs from "fs";
// import path from "path";
// import QRCode from "qrcode";

// export async function generateAndSaveBarcode(text, filename) {
//   try {
//     // Pastikan folder ada
//     const uploadsDir = path.join(
//       process.cwd(),
//       "public",
//       "uploads",
//       "barcodes"
//     );
//     if (!fs.existsSync(uploadsDir)) {
//       fs.mkdirSync(uploadsDir, { recursive: true });
//     }

//     // Nama file barcode
//     const fileName = `${filename}.png`;
//     const filePath = path.join(uploadsDir, fileName);

//     // Generate QR Code langsung ke file
//     await QRCode.toFile(filePath, text, {
//       type: "png",
//       width: 300,
//       errorCorrectionLevel: "H",
//     });

//     // Return relative path untuk simpan di DB
//     return `/uploads/barcodes/${fileName}`;
//   } catch (err) {
//     console.error("Error generating barcode:", err);
//     throw err;
//   }
// }

import supabase from "@/lib/supabase";
import QRCode from "qrcode";

export async function generateAndSaveBarcode(text, filename) {
  try {
    // 1. Generate QR Code buffer
    const buffer = await QRCode.toBuffer(text, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // 2. Nama file (path di Supabase)
    const fileName = `barcodes/${filename}.png`;

    // 3. Upload ke Supabase
    const { error } = await supabase.storage
      .from("invoice")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true, // overwrite jika sudah ada
      });

    if (error) throw error;

    // 4. Return path (untuk disimpan di DB)
    return fileName; // contoh: "barcodes/invoice-123.png"
  } catch (err) {
    console.error("Error generating barcode:", err);
    throw err;
  }
}
