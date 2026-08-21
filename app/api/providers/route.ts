import { NextResponse } from "next/server"
import { allProviderMetadata } from "@/lib/providers/types"

export async function GET() {
  return NextResponse.json(allProviderMetadata())
}

