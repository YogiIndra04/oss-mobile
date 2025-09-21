import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/utils/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req) {
  try {
    const { username } = await req.json();
    if (!username) {
      return Response.json({ error: "Username wajib diisi" }, { status: 400 });
    }

    // 1) cari user by username
    const user = await prisma.users.findUnique({
      where: { username },
      select: { id_user: true },
    });

    if (!user) {
      return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // 2) ambil profile untuk email
    const profile = await prisma.profile_user.findUnique({
      where: { id_user: user.id_user },
      select: { user_name: true, email_user: true },
    });

    if (!profile?.email_user) {
      return Response.json(
        { error: "Email user tidak ditemukan" },
        { status: 404 }
      );
    }

    // 3) generate OTP, hash, expiry
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const otpHash = await bcrypt.hash(otp, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.users.update({
      where: { id_user: user.id_user },
      data: {
        reset_password: otpHash,
        reset_password_expires: expires,
        reset_password_attempts: 0,
        updated_at: new Date(),
      },
    });

    // 4) kirim email
    await sendMail({
      to: profile.email_user,
      subject: "Kode Reset Password",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Reset Password</h2>
          <p>Hai <b>${
            profile.user_name ?? "Pengguna"
          }</b>, gunakan kode berikut untuk reset password:</p>
          <div style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:12px 0">${otp}</div>
          <p>Kode berlaku selama <b>15 menit</b>. Jika bukan Anda, abaikan email ini.</p>
        </div>
      `,
    });

    // ✅ balikin id_user supaya frontend bisa pakai di step 2
    return Response.json(
      { message: "Reset code sent to email", id_user: user.id_user },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to generate reset code" },
      { status: 500 }
    );
  }
}
