// import prisma from "@/lib/prisma";
// import { saveUploadedFile } from "@/lib/utils/fileHandler";
// import { NextResponse } from "next/server";

// export async function POST(req) {
//   try {
//     const formData = await req.formData();

//     const id_user = formData.get("id_user");
//     const user_name = formData.get("user_name");
//     const email_user = formData.get("email_user");
//     const user_contact = formData.get("user_contact");
//     const user_address = formData.get("user_address");
//     const file = formData.get("profile_image"); // File

//     // ✅ gunakan helper
//     const filePath = await saveUploadedFile(file, "uploads/profiles");

//     const newProfile = await prisma.profile_user.create({
//       data: {
//         id_user,
//         user_name,
//         email_user,
//         user_contact,
//         user_address,
//         profile_image: filePath,
//       },
//     });

//     return NextResponse.json(newProfile, { status: 201 });
//   } catch (err) {
//     console.error("❌ Upload error:", err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

// export async function GET() {
//   try {
//     const profiles = await prisma.profile_user.findMany({
//       include: { user: true },
//     });
//     return NextResponse.json(profiles, { status: 200 });
//   } catch (err) {
//     console.error("❌ Fetch error:", err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

import prisma from "@/lib/prisma";
import { uploadToStorage } from "@/lib/utils/uploadStorage";
import { NextResponse } from "next/server";

// CREATE profile_user
export async function POST(req) {
  try {
    const formData = await req.formData();

    const id_user = formData.get("id_user");
    const user_name = formData.get("user_name");
    const email_user = formData.get("email_user");
    const user_contact = formData.get("user_contact");
    const user_address = formData.get("user_address");
    const file = formData.get("profile_image");

    // ✅ upload ke Storage
    let fileUrl = null;
    if (file && file.name) {
      const nameHint = `profile_image-${id_user || Date.now()}.${(file.name.split('.').pop() || 'png')}`;
      const uploaded = await uploadToStorage(file, "uploads", nameHint);
    }

    const newProfile = await prisma.profile_user.create({
      data: {
        id_user,
        user_name,
        email_user,
        user_contact,
        user_address,
        profile_image: fileUrl,
      },
    });

    return NextResponse.json(newProfile, { status: 201 });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET all profiles
export async function GET() {
  try {
    const profiles = await prisma.profile_user.findMany({
      include: { user: true },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(profiles, { status: 200 });
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

//testing miracast untuk upload file ke storage




