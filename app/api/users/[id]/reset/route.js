// app/api/users/[id]/reset/route.js
import prisma from "@/lib/prisma";

export async function POST(req, { params }) {
  try {
    // generate kode random 6 digit
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.users.update({
      where: { id_user: params.id },
      data: {
        reset_password: resetCode,
        updated_at: new Date(),
      },
    });

    // biasanya di sini kamu kirim email/sms berisi resetCode
    return Response.json({ message: "Reset code generated", resetCode });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to generate reset code" },
      { status: 500 }
    );
  }
}
