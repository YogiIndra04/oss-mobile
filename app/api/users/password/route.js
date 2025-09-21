// app/api/users/[id]/password/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req, { params }) {
  try {
    const { id } = params; // ✅ ambil id_user dengan benar
    const { resetCode, newPassword } = await req.json();

    if (!resetCode || !newPassword) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { id_user: id },
    });

    if (!user || !user.reset_password || !user.reset_password_expires) {
      return Response.json(
        { error: "No active reset request" },
        { status: 400 }
      );
    }

    // cek kedaluwarsa
    if (new Date() > new Date(user.reset_password_expires)) {
      return Response.json({ error: "Code expired" }, { status: 400 });
    }

    // cek percobaan
    if (user.reset_password_attempts >= 5) {
      return Response.json({ error: "Too many attempts" }, { status: 400 });
    }

    // bandingkan OTP (hash vs plaintext)
    const isValid = await bcrypt.compare(resetCode, user.reset_password);
    if (!isValid) {
      await prisma.users.update({
        where: { id_user: id },
        data: { reset_password_attempts: { increment: 1 } },
      });
      return Response.json({ error: "Invalid reset code" }, { status: 400 });
    }

    // hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // update password & reset field OTP
    await prisma.users.update({
      where: { id_user: id },
      data: {
        password: hashedPassword,
        reset_password: null,
        reset_password_expires: null,
        reset_password_attempts: 0,
        updated_at: new Date(),
      },
    });

    return Response.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
