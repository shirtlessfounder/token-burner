import {
  parseBurnFinishResponse,
  parseBurnStartResponse,
  parseHeartbeatResponse,
  parseLinkResponse,
  parseRegisterResponse,
  parseTelemetryEventResponse,
  type BurnFinishRequest,
  type BurnFinishResponse,
  type BurnStartRequest,
  type BurnStartResponse,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type LinkRequest,
  type LinkResponse,
  type RegisterRequest,
  type RegisterResponse,
  type TelemetryEventRequest,
  type TelemetryEventResponse,
} from "@token-burner/shared";

export type FetchLike = typeof fetch;

export type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

const postJson = async <TResponse>(
  path: string,
  body: unknown,
  parse: (input: unknown) => TResponse,
  { baseUrl, fetchImpl = fetch }: ApiClientOptions,
): Promise<TResponse> => {
  const url = `${trimTrailingSlash(baseUrl)}${path}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed: unknown = raw.length > 0 ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `request to ${path} failed (${response.status})`;
    throw new ApiError(message, response.status, parsed);
  }

  return parse(parsed);
};

const trimTrailingSlash = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const registerAgent = (
  body: RegisterRequest,
  options: ApiClientOptions,
): Promise<RegisterResponse> =>
  postJson("/api/agent/register", body, parseRegisterResponse, options);

export const linkAgent = (
  body: LinkRequest,
  options: ApiClientOptions,
): Promise<LinkResponse> =>
  postJson("/api/agent/link", body, parseLinkResponse, options);

export const startBurn = (
  body: BurnStartRequest,
  options: ApiClientOptions,
): Promise<BurnStartResponse> =>
  postJson("/api/burns/start", body, parseBurnStartResponse, options);

export const postHeartbeat = (
  burnId: string,
  body: HeartbeatRequest,
  options: ApiClientOptions,
): Promise<HeartbeatResponse> =>
  postJson(
    `/api/burns/${encodeURIComponent(burnId)}/heartbeat`,
    body,
    parseHeartbeatResponse,
    options,
  );

export const postBurnEvent = (
  burnId: string,
  body: TelemetryEventRequest,
  options: ApiClientOptions,
): Promise<TelemetryEventResponse> =>
  postJson(
    `/api/burns/${encodeURIComponent(burnId)}/events`,
    body,
    parseTelemetryEventResponse,
    options,
  );

export const finishBurn = (
  burnId: string,
  body: BurnFinishRequest,
  options: ApiClientOptions,
): Promise<BurnFinishResponse> =>
  postJson(
    `/api/burns/${encodeURIComponent(burnId)}/finish`,
    body,
    parseBurnFinishResponse,
    options,
  );
