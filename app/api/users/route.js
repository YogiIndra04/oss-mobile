// app/api/users/route.js
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET all users
export async function GET() {
  try {
    const users = await prisma.users.findMany();
    return Response.json(users);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// CREATE user
export async function POST(req) {
  try {
    const body = await req.json();
    const { role_user, username, password } = body;

    if (!role_user || !username || !password) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate UUID for id_user
    const id_user = crypto.randomUUID();

    const newUser = await prisma.users.create({
      data: {
        id_user,
        role_user,
        username,
        password: hashedPassword,
      },
    });

    return Response.json(
      {
        message: "User created successfully",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
