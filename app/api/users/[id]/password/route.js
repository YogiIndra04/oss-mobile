// app/api/users/[id]/password/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const { resetCode, newPassword } = body;

    if (!resetCode || !newPassword) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    // cari user berdasarkan id dan reset_password
    const user = await prisma.users.findFirst({
      where: {
        id_user: params.id,
        reset_password: resetCode,
      },
    });

    if (!user) {
      return Response.json({ error: "Invalid reset code" }, { status: 400 });
    }

    // hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // update password & hapus reset_password
    await prisma.users.update({
      where: { id_user: params.id },
      data: {
        password: hashedPassword,
        reset_password: null,
        updated_at: new Date(),
      },
    });

    return Response.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update password" }, { status: 500 });
  }
}
