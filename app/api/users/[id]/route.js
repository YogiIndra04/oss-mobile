import prisma from "@/lib/prisma";
import {
  deleteFromStorage,
  uploadToStorage,
} from "@/lib/utils/uploadStorage";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

// GET user by ID (include profile)
export async function GET(req, { params }) {
  try {
    const user = await prisma.users.findUnique({
      where: { id_user: params.id },
      include: { profile_user: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /users/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// UPDATE user (form-data + upload file)
export async function PUT(req, { params }) {
  try {
    const formData = await req.formData();

    const role_user = formData.get("role_user");
    const username = formData.get("username");
    const password = formData.get("password");
    const user_name = formData.get("user_name");
    const email_user = formData.get("email_user");
    const user_contact = formData.get("user_contact");
    const user_address = formData.get("user_address");
    const file = formData.get("profile_image");

    const oldUser = await prisma.users.findUnique({
      where: { id_user: params.id },
      include: { profile_user: true },
    });

    if (!oldUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // hash password jika ada input baru
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    let fileUrl = oldUser.profile_user?.profile_image || null;

    // kalau ada file baru → hapus lama & upload baru
    if (file && file.name) {
      if (fileUrl) {
        const oldPath = fileUrl.split("/invoice/")[1];
        if (oldPath) {
          await deleteFromStorage(oldPath);
        }
      }
      const uploaded = await uploadToStorage(file, "profile_image");
      fileUrl = uploaded.publicUrl;
    }

    const updatedUser = await prisma.users.update({
      where: { id_user: params.id },
      data: {
        role_user: role_user || oldUser.role_user,
        username: username || oldUser.username,
        ...(hashedPassword && { password: hashedPassword }),
        profile_user: {
          update: {
            user_name: user_name || oldUser.profile_user?.user_name,
            email_user: email_user || oldUser.profile_user?.email_user,
            user_contact: user_contact || oldUser.profile_user?.user_contact,
            user_address: user_address || oldUser.profile_user?.user_address,
            profile_image: fileUrl,
          },
        },
      },
      include: { profile_user: true },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("PUT /users/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE user (profile ikut kehapus otomatis - Cascade)
export async function DELETE(req, { params }) {
  try {
    await prisma.users.delete({
      where: { id_user: params.id },
    });
    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("DELETE /users/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

