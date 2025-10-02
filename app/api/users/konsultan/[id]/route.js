import prisma from "@/lib/prisma";
import {
  deleteFromSupabase,
  uploadToSupabase,
} from "@/lib/utils/uploadSupabase";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

// ✅ UPDATE konsultan (support JSON & FormData)
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const contentType = req.headers.get("content-type") || "";
    let body = {};
    let file = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = {
        username: formData.get("username"),
        password: formData.get("password"),
        user_name: formData.get("user_name"),
        email_user: formData.get("email_user"),
        user_contact: formData.get("user_contact"),
        user_address: formData.get("user_address"),
      };
      file = formData.get("profile_image");
    } else {
      body = await req.json();
    }

    const {
      username,
      password,
      user_name,
      email_user,
      user_contact,
      user_address,
    } = body;

    const oldUser = await prisma.users.findUnique({
      where: { id_user: id },
      include: { profile_user: true },
    });

    if (!oldUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let hashedPassword = oldUser.password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // upload foto baru
    let profileImageUrl = oldUser.profile_user?.profile_image;
    if (file && file.name) {
      if (profileImageUrl?.includes("supabase.co")) {
        const path = profileImageUrl.split("/invoice/")[1];
        await deleteFromSupabase(path);
      }
      const uploaded = await uploadToSupabase(file, "profile_image");
      profileImageUrl = uploaded.publicUrl;
    }

    const updatedUser = await prisma.users.update({
      where: { id_user: id },
      data: {
        username: username || oldUser.username,
        password: hashedPassword,
        profile_user: {
          update: {
            user_name: user_name || oldUser.profile_user?.user_name,
            email_user: email_user || oldUser.profile_user?.email_user,
            user_contact: user_contact || oldUser.profile_user?.user_contact,
            user_address: user_address || oldUser.profile_user?.user_address,
            profile_image: profileImageUrl,
          },
        },
      },
      include: { profile_user: true },
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    console.error("PUT /users/konsultan/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update konsultan user" },
      { status: 500 }
    );
  }
}

// ✅ DELETE konsultan
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    const konsultan = await prisma.users.findUnique({
      where: { id_user: id },
      include: { profile_user: true },
    });

    if (!konsultan) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // hapus foto dari Supabase kalau ada
    if (konsultan.profile_user?.profile_image?.includes("supabase.co")) {
      const path = konsultan.profile_user.profile_image.split("/invoice/")[1];
      await deleteFromSupabase(path);
    }

    await prisma.users.delete({
      where: { id_user: id },
    });

    return NextResponse.json({ message: "Konsultan deleted" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /users/konsultan/:id error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete konsultan user" },
      { status: 500 }
    );
  }
}
