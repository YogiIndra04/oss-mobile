// app/api/companies/route.js
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

// ✅ Get all companies
export async function GET() {
  try {
    const companies = await prisma.companies.findMany()
    return NextResponse.json(companies)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 })
  }
}

// ✅ Create a new company
export async function POST(req) {
  try {
    const data = await req.json()

    const newCompany = await prisma.companies.create({
      data: {
        company_id: data.company_id, // isi UUID manual atau generate di backend
        business_name: data.business_name,
        company_name: data.company_name,
        company_email: data.company_email,
        company_contact: data.company_contact,
        company_web: data.company_web,
        company_registration: data.company_registration,
        company_wa: data.company_wa,
        company_ig: data.company_ig,
        company_yt: data.company_yt,
        company_tt: data.company_tt,
      },
    })

    return NextResponse.json(newCompany)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 })
  }
}
