import type { ProviderId } from "@token-burner/shared";

const INNIES_DEFAULT_BASE_URL = "https://api.innies.computer";

const inniesKeyPrefixes = ["in_live_", "in_test_"] as const;

export const isInniesKey = (apiKey: string): boolean =>
  inniesKeyPrefixes.some((prefix) => apiKey.startsWith(prefix));

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const resolveInniesRoot = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string => trimTrailingSlash(env.INNIES_BASE_URL ?? INNIES_DEFAULT_BASE_URL);

export const resolveInniesProxyBaseUrl = (
  providerId: ProviderId,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string => {
  const root = resolveInniesRoot(env);
  if (providerId === "openai") {
    return `${root}/v1/proxy/v1`;
  }
  if (providerId === "anthropic") {
    return `${root}/v1/proxy`;
  }
  throw new Error(`unknown provider ${providerId} for innies routing`);
};
