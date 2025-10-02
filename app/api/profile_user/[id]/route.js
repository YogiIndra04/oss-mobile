// import prisma from "@/lib/prisma";
// import { deleteFileIfExists, saveUploadedFile } from "@/lib/utils/fileHandler";
// import { NextResponse } from "next/server";

// // ✅ UPDATE profile_user
// export async function PUT(req, { params }) {
//   const { id } = params;

//   try {
//     const formData = await req.formData();
//     const user_name = formData.get("user_name");
//     const email_user = formData.get("email_user");
//     const user_contact = formData.get("user_contact");
//     const user_address = formData.get("user_address");
//     const file = formData.get("profile_image");

//     const oldProfile = await prisma.profile_user.findUnique({
//       where: { id_user: id },
//     });

//     if (!oldProfile) {
//       return NextResponse.json({ error: "Profile not found" }, { status: 404 });
//     }

//     let profileImagePath = oldProfile.profile_image;

//     if (file && file.name) {
//       // hapus lama
//       deleteFileIfExists(oldProfile.profile_image);

//       // simpan baru
//       profileImagePath = await saveUploadedFile(file, "uploads/profiles");
//     }

//     const updatedProfile = await prisma.profile_user.update({
//       where: { id_user: id },
//       data: {
//         user_name: user_name || oldProfile.user_name,
//         email_user: email_user || oldProfile.email_user,
//         user_contact: user_contact || oldProfile.user_contact,
//         user_address: user_address || oldProfile.user_address,
//         profile_image: profileImagePath,
//       },
//     });

//     return NextResponse.json(updatedProfile, { status: 200 });
//   } catch (err) {
//     console.error(err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

// // ✅ DELETE profile_user
// export async function DELETE(req, { params }) {
//   const { id } = params;

//   try {
//     const profile = await prisma.profile_user.findUnique({
//       where: { id_user: id },
//     });

//     if (!profile) {
//       return NextResponse.json({ error: "Profile not found" }, { status: 404 });
//     }

//     // hapus file jika ada
//     deleteFileIfExists(profile.profile_image);

//     await prisma.profile_user.delete({
//       where: { id_user: id },
//     });

//     return NextResponse.json({ message: "Profile deleted" }, { status: 200 });
//   } catch (err) {
//     console.error(err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import {
  deleteFromSupabase,
  uploadToSupabase,
} from "@/lib/utils/uploadSupabase";
import { NextResponse } from "next/server";

// UPDATE profile_user
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const formData = await req.formData();

    const user_name = formData.get("user_name");
    const email_user = formData.get("email_user");
    const user_contact = formData.get("user_contact");
    const user_address = formData.get("user_address");
    const file = formData.get("profile_image");

    const oldProfile = await prisma.profile_user.findUnique({
      where: { id_user: id },
    });

    if (!oldProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    let fileUrl = oldProfile.profile_image;

    // kalau ada file baru → hapus lama lalu upload baru
    if (file && file.name) {
      if (oldProfile.profile_image?.includes("supabase.co")) {
        const oldPath = oldProfile.profile_image.split("/invoice/")[1]; // ambil relative path
        if (oldPath) await deleteFromSupabase(oldPath);
      }

      const uploaded = await uploadToSupabase(file, "profile_image");
      fileUrl = uploaded.publicUrl;
    }

    const updatedProfile = await prisma.profile_user.update({
      where: { id_user: id },
      data: {
        user_name: user_name || oldProfile.user_name,
        email_user: email_user || oldProfile.email_user,
        user_contact: user_contact || oldProfile.user_contact,
        user_address: user_address || oldProfile.user_address,
        profile_image: fileUrl,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(updatedProfile, { status: 200 });
  } catch (err) {
    console.error("❌ Update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE profile_user
export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    const profile = await prisma.profile_user.findUnique({
      where: { id_user: id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // hapus file di Supabase kalau ada
    if (profile.profile_image?.includes("supabase.co")) {
      const oldPath = profile.profile_image.split("/invoice/")[1];
      if (oldPath) await deleteFromSupabase(oldPath);
    }

    await prisma.profile_user.delete({
      where: { id_user: id },
    });

    return NextResponse.json({ message: "Profile deleted" }, { status: 200 });
  } catch (err) {
    console.error("❌ Delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
