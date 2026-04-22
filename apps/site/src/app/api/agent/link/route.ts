import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseLinkRequest, parseLinkResponse } from "@token-burner/shared";

import {
  OwnerTokenInvalidError,
  linkAgentToHuman,
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
    parsed = parseLinkRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid link request", details: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const result = await linkAgentToHuman(parsed);
    const body = parseLinkResponse(result);
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof OwnerTokenInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
