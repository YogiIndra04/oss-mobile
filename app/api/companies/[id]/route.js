// app/api/companies/[id]/route.js
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

// ✅ Get company by ID
export async function GET(req, { params }) {
  try {
    const { id } = params
    const company = await prisma.companies.findUnique({
      where: { company_id: id },
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 })
  }
}

// ✅ Update company by ID
export async function PUT(req, { params }) {
  try {
    const { id } = params
    const data = await req.json()

    const updated = await prisma.companies.update({
      where: { company_id: id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 })
  }
}

// ✅ Delete company by ID
export async function DELETE(req, { params }) {
  try {
    const { id } = params

    await prisma.companies.delete({
      where: { company_id: id },
    })

    return NextResponse.json({ message: "Company deleted successfully" })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 })
  }
}
