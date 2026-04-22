import { createElement } from "../../apps/site/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../apps/site/node_modules/react-dom/server.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LiveBurnFeedEntry,
  ProviderSplitLeaderboard,
} from "../../apps/site/src/lib/db/queries";
import HomePage from "../../apps/site/src/app/page";
import {
  getLiveBurnFeed,
  getProviderAllTimeLeaderboard,
  getProviderDailyLeaderboard,
  getProviderWeeklyLeaderboard,
} from "../../apps/site/src/lib/db/queries";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("../../apps/site/src/app/_components/burns-realtime-refresher", () => ({
  BurnsRealtimeRefresher: () => null,
}));

vi.mock("../../apps/site/src/lib/db/queries", () => ({
  getLiveBurnFeed: vi.fn(),
  getProviderAllTimeLeaderboard: vi.fn(),
  getProviderDailyLeaderboard: vi.fn(),
  getProviderWeeklyLeaderboard: vi.fn(),
}));

const mockedGetProviderDailyLeaderboard = vi.mocked(getProviderDailyLeaderboard);
const mockedGetProviderWeeklyLeaderboard = vi.mocked(
  getProviderWeeklyLeaderboard,
);
const mockedGetProviderAllTimeLeaderboard = vi.mocked(
  getProviderAllTimeLeaderboard,
);
const mockedGetLiveBurnFeed = vi.mocked(getLiveBurnFeed);

const renderHomePage = async ({
  daily,
  weekly,
  allTime,
  liveFeed,
  appUrl = "https://token-burner.example",
}: {
  daily: ProviderSplitLeaderboard;
  weekly: ProviderSplitLeaderboard;
  allTime: ProviderSplitLeaderboard;
  liveFeed: LiveBurnFeedEntry[];
  appUrl?: string;
}) => {
  process.env.NEXT_PUBLIC_APP_URL = appUrl;

  mockedGetProviderDailyLeaderboard.mockResolvedValue(daily);
  mockedGetProviderWeeklyLeaderboard.mockResolvedValue(weekly);
  mockedGetProviderAllTimeLeaderboard.mockResolvedValue(allTime);
  mockedGetLiveBurnFeed.mockResolvedValue(liveFeed);

  return renderToStaticMarkup(await HomePage());
};

const normalizeMarkup = (markup: string) => markup.replace(/\s+/g, " ").trim();

const buildLeaderboard = ({
  openai = [],
  anthropic = [],
}: Partial<ProviderSplitLeaderboard> = {}): ProviderSplitLeaderboard => ({
  openai,
  anthropic,
});

describe("homepage", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("renders provider-split leaderboards, live feed, and CLI onboarding in homepage order", async () => {
    const markup = normalizeMarkup(
      await renderHomePage({
        allTime: buildLeaderboard({
          openai: [
            {
              humanId: "human-openai-all-time",
              handle: "emberlord",
              avatarUrl: "🔥",
              provider: "openai",
              totalBilledTokens: 1048576,
              rank: 1,
            },
          ],
          anthropic: [
            {
              humanId: "human-anthropic-all-time",
              handle: "velvetash",
              avatarUrl: "🕯️",
              provider: "anthropic",
              totalBilledTokens: 524288,
              rank: 1,
            },
          ],
        }),
        weekly: buildLeaderboard({
          openai: [
            {
              humanId: "human-openai-weekly",
              handle: "coalopera",
              avatarUrl: "🎭",
              provider: "openai",
              totalBilledTokens: 48000,
              rank: 1,
            },
          ],
          anthropic: [
            {
              humanId: "human-anthropic-weekly",
              handle: "cindersilk",
              avatarUrl: "🪩",
              provider: "anthropic",
              totalBilledTokens: 36000,
              rank: 1,
            },
          ],
        }),
        daily: buildLeaderboard({
          openai: [
            {
              humanId: "human-openai-daily",
              handle: "gildedash",
              avatarUrl: "🪙",
              provider: "openai",
              totalBilledTokens: 12000,
              rank: 1,
            },
          ],
          anthropic: [
            {
              humanId: "human-anthropic-daily",
              handle: "operafuel",
              avatarUrl: "🕯️",
              provider: "anthropic",
              totalBilledTokens: 9000,
              rank: 1,
            },
          ],
        }),
        liveFeed: [
          {
            burnId: "burn-1",
            humanId: "human-live",
            handle: "torchbaron",
            avatarUrl: "🔥",
            provider: "openai",
            model: "gpt-5.4",
            requestedBilledTokenTarget: 200000,
            billedTokensConsumed: 64000,
            status: "running",
            createdAt: new Date("2026-04-22T17:00:00.000Z"),
            startedAt: new Date("2026-04-22T17:01:00.000Z"),
            finishedAt: null,
            lastHeartbeatAt: new Date("2026-04-22T17:02:00.000Z"),
          },
        ],
      }),
    );

    expect(markup).toContain("TOKEN");
    expect(markup).toContain("BURNER");
    expect(markup).toContain("all time");
    expect(markup).toContain("this week");
    expect(markup).toContain("today");
    expect(markup).toContain("OPENAI");
    expect(markup).toContain("ANTHROPIC");
    expect(markup).toContain("emberlord");
    expect(markup).toContain("velvetash");
    expect(markup).toContain("burning now");
    expect(markup).toContain("1 active");
    expect(markup).toContain("torchbaron");
    expect(markup).toContain("gpt-5.4");
    expect(markup).toContain("watch");
    expect(markup).toContain("onboard a new burner");
    expect(markup).toContain("step 01 — mint a one-time code");
    expect(markup).toContain("mint claim code");
    expect(markup).toContain("step 02 — paste into your cli agent");
    expect(markup).toContain(
      "read https://token-burner.example/skill.md then register me on token-burner with the claim code i will paste next. pick a short handle and a single-emoji avatar. store the owner token locally.",
    );

    expect(markup.indexOf("all time")).toBeLessThan(markup.indexOf("burning now"));
    expect(markup.indexOf("burning now")).toBeLessThan(
      markup.indexOf("onboard a new burner"),
    );

    expect(mockedGetProviderDailyLeaderboard).toHaveBeenCalledWith({ limit: 10 });
    expect(mockedGetProviderWeeklyLeaderboard).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(mockedGetProviderAllTimeLeaderboard).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(mockedGetLiveBurnFeed).toHaveBeenCalledWith({ limit: 10 });
  });

  it("renders homepage empty states without removing the onboarding section", async () => {
    const markup = normalizeMarkup(
      await renderHomePage({
        allTime: buildLeaderboard(),
        weekly: buildLeaderboard(),
        daily: buildLeaderboard(),
        liveFeed: [],
      }),
    );

    expect((markup.match(/nothing burned/gi) ?? []).length).toBe(6);
    expect(markup).toContain("0 active");
    expect(markup).toContain("the pyre is cold. start one from your CLI.");
    expect(markup).toContain("onboard a new burner");
    expect(markup).toContain("mint claim code");
    expect(markup).toContain(
      "agent fetches the bootstrap doc, hits /api/agent/register, saves the reusable owner token to your machine. provider keys stay local.",
    );
  });
});
