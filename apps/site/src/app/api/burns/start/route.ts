import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseBurnStartRequest,
  parseBurnStartResponse,
} from "@token-burner/shared";

import {
  BurnSessionInvalidError,
  OwnerTokenInvalidError,
  startBurn,
} from "../../../../lib/server/burns";
import { ActiveBurnConflictError } from "../../../../lib/server/housekeeping";

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
    parsed = parseBurnStartRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid burn start request", details: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const result = await startBurn({
      ownerToken: parsed.ownerToken,
      agentInstallationId: parsed.agentInstallationId,
      provider: parsed.provider,
      targetTokens: parsed.targetTokens,
      presetId: parsed.presetId ?? null,
      model: parsed.model,
    });
    const body = parseBurnStartResponse(result);
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof OwnerTokenInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ActiveBurnConflictError) {
      return NextResponse.json(
        { error: error.message, burnId: error.burnId, status: error.status },
        { status: 409 },
      );
    }
    if (error instanceof BurnSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
