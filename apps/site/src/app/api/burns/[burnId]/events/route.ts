import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseTelemetryEventRequest,
  parseTelemetryEventResponse,
} from "@token-burner/shared";

import {
  BurnSessionInvalidError,
  recordBurnEvent,
} from "../../../../../lib/server/burns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ burnId: string }> },
): Promise<Response> {
  const { burnId } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseTelemetryEventRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid telemetry event", details: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const result = await recordBurnEvent({
      burnId,
      burnSessionToken: parsed.burnSessionToken,
      eventType: parsed.eventType,
      eventPayload: parsed.eventPayload,
      billedTokensConsumed: parsed.billedTokensConsumed,
    });
    const body = parseTelemetryEventResponse({
      accepted: result.accepted,
      verifiedStepTokens: result.verifiedStepTokens,
      cumulativeTokens: result.cumulativeTokens,
      verified: result.verified,
    });
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    if (error instanceof BurnSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
