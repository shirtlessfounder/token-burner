import { NextResponse } from "next/server";

import { parseClaimCodeResponse } from "@token-burner/shared";

import { createClaimCode } from "../../../lib/server/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const { code, expiresAt } = await createClaimCode();
  const body = parseClaimCodeResponse({
    code,
    expiresAt: expiresAt.toISOString(),
  });
  return NextResponse.json(body, { status: 201 });
}
