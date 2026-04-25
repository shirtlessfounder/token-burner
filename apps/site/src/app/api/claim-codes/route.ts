import { NextResponse } from "next/server";

import { parseClaimCodeResponse } from "@token-burner/shared";

import { createClaimCode } from "../../../lib/server/onboarding";
import {
  consumeRateLimit,
  getClientIp,
} from "../../../lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const claimCodeRateLimit = {
  limit: 10,
  windowMilliseconds: 60 * 60 * 1000,
};

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const result = consumeRateLimit(`claim-codes:${ip}`, claimCodeRateLimit);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "claim-code mint rate limit exceeded",
        retryAfterSeconds: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
        },
      },
    );
  }

  const { code, expiresAt } = await createClaimCode();
  const body = parseClaimCodeResponse({
    code,
    expiresAt: expiresAt.toISOString(),
  });
  return NextResponse.json(body, { status: 201 });
}
