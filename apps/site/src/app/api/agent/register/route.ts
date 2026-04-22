import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseRegisterRequest,
  parseRegisterResponse,
} from "@token-burner/shared";

import {
  ClaimCodeInvalidError,
  registerHumanFromClaim,
} from "../../../../lib/server/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseRegisterRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid register request", details: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const result = await registerHumanFromClaim(parsed);
    const body = parseRegisterResponse(result);
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof ClaimCodeInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
