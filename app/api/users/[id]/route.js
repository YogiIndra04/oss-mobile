// app/api/users/[id]/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET user by ID
export async function GET(req, { params }) {
  try {
    const user = await prisma.users.findUnique({
      where: { id_user: params.id },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// UPDATE user
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    const { role_user, username, password } = body;

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const updatedUser = await prisma.users.update({
      where: { id_user: params.id },
      data: {
        role_user,
        username,
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    return Response.json(updatedUser);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(req, { params }) {
  try {
    await prisma.users.delete({
      where: { id_user: params.id },
    });
    return Response.json({ message: "User deleted" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
