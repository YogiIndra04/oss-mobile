import fs from "fs";
import path from "path";
import QRCode from "qrcode";

export async function generateAndSaveBarcode(text, filename) {
  try {
    // Pastikan folder ada
    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "barcodes"
    );
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Nama file barcode
    const fileName = `${filename}.png`;
    const filePath = path.join(uploadsDir, fileName);

    // Generate QR Code langsung ke file
    await QRCode.toFile(filePath, text, {
      type: "png",
      width: 300,
      errorCorrectionLevel: "H",
    });

    // Return relative path untuk simpan di DB
    return `/uploads/barcodes/${fileName}`;
  } catch (err) {
    console.error("Error generating barcode:", err);
    throw err;
  }
}
