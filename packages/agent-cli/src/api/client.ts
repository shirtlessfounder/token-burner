import {
  parseLinkResponse,
  parseRegisterResponse,
  type LinkRequest,
  type LinkResponse,
  type RegisterRequest,
  type RegisterResponse,
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
