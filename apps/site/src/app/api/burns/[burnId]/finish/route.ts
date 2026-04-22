import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseBurnFinishRequest,
  parseBurnFinishResponse,
} from "@token-burner/shared";

import {
  BurnSessionInvalidError,
  finishBurn,
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
    parsed = parseBurnFinishRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid burn finish request", details: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  try {
    const result = await finishBurn({
      burnId,
      burnSessionToken: parsed.burnSessionToken,
      status: parsed.status,
      billedTokensConsumed: parsed.billedTokensConsumed,
    });
    const body = parseBurnFinishResponse(result);
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    if (error instanceof BurnSessionInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    throw error;
  }
}
