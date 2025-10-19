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

import { uploadBufferToStorage } from "@/lib/utils/uploadStorage";
import QRCode from "qrcode";

export async function generateAndSaveBarcode(text, filename) {
  try {
    // 1. Generate QR Code buffer
    const buffer = await QRCode.toBuffer(text, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // 2. Penamaan file untuk memudahkan identifikasi di public URL
    const nameHint = `barcode-${filename}.png`;

    // 3. Upload ke Storage OSS dan kembalikan public URL
    const up = await uploadBufferToStorage(buffer, "uploads", "png", "image/png", nameHint);
    return up?.publicUrl || null;
  } catch (err) {
    console.error("Error generating barcode:", err);
    throw err;
  }
}

