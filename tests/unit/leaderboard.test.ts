import { describe, expect, it } from "vitest";
import {
  buildLeaderboardEntry,
  computeRunScore,
  filterLeaderboardEntries,
  getLeaderboardBestScore,
  getLeaderboardDivision,
  getLeaderboardNextDivision,
  getLeaderboardPromotionRewards,
  getLeaderboardRank,
  upsertLeaderboardEntries,
} from "../../src/game/run/leaderboard";
import { createRng } from "../../src/core/prng";
import { createEndlessLevelProgress } from "../../src/game/run/endlessLevels";

function makeRunState(overrides: Partial<Parameters<typeof buildLeaderboardEntry>[0]> = {}) {
  const endless = createEndlessLevelProgress(createRng("leaderboard-seed"));
  endless.current.index = 4;
  return {
    startedAtMs: 1000,
    mode: "run" as const,
    waveIndex: 13,
    bolts: 120,
    cores: 2,
    tailMaxLen: 18,
    endless,
    daily: undefined,
    ...overrides,
  };
}

describe("leaderboard", () => {
  it("computes a stable score from run stats", () => {
    expect(computeRunScore(makeRunState())).toBe(15030);
  });

  it("upserts and sorts leaderboard entries by score", () => {
    const low = buildLeaderboardEntry(makeRunState({ startedAtMs: 1000, bolts: 20 }));
    const high = buildLeaderboardEntry(makeRunState({ startedAtMs: 2000, bolts: 240 }));

    const entries = upsertLeaderboardEntries([low], high, 5);
    expect(entries[0]?.id).toBe(high.id);
    expect(getLeaderboardRank(entries, high.id)).toBe(1);
    expect(getLeaderboardRank(entries, low.id)).toBe(2);
  });

  it("updates an existing run entry instead of duplicating it", () => {
    const first = buildLeaderboardEntry(makeRunState({ startedAtMs: 3000, bolts: 60 }));
    const boosted = buildLeaderboardEntry(makeRunState({ startedAtMs: 3000, bolts: 180 }), first.id);

    const entries = upsertLeaderboardEntries([first], boosted, 5);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.score).toBeGreaterThan(first.score);
  });

  it("uses a preferred pilot name when one is configured", () => {
    const entry = buildLeaderboardEntry(makeRunState({ startedAtMs: 3500 }), undefined, "  ORBIT-7  ");
    expect(entry.pilot).toBe("ORBIT-7");
  });

  it("maps scores into leaderboard divisions", () => {
    expect(getLeaderboardDivision(5_000).id).toBe("scrapper");
    expect(getLeaderboardDivision(20_000).id).toBe("raider");
    expect(getLeaderboardDivision(40_000).id).toBe("ace");
    expect(getLeaderboardDivision(65_000).id).toBe("elite");
    expect(getLeaderboardDivision(95_000).id).toBe("legend");
    expect(getLeaderboardNextDivision(40_000)?.id).toBe("elite");
    expect(getLeaderboardNextDivision(95_000)).toBeNull();
  });

  it("filters entries by leaderboard mode", () => {
    const runEntry = buildLeaderboardEntry(makeRunState({ startedAtMs: 4000, mode: "run" }));
    const dailyEntry = buildLeaderboardEntry(
      makeRunState({
        startedAtMs: 5000,
        mode: "daily",
        daily: { dateUtc: "2026-04-06", variantId: "daily_fast_flip" },
      })
    );

    expect(filterLeaderboardEntries([runEntry, dailyEntry], "all")).toHaveLength(2);
    expect(filterLeaderboardEntries([runEntry, dailyEntry], "run")).toEqual([runEntry]);
    expect(filterLeaderboardEntries([runEntry, dailyEntry], "daily")).toEqual([dailyEntry]);
  });

  it("finds the best prior score excluding the current entry", () => {
    const current = buildLeaderboardEntry(makeRunState({ startedAtMs: 6000, bolts: 160 }), "run:6000");
    const prior = buildLeaderboardEntry(makeRunState({ startedAtMs: 5000, bolts: 120 }), "run:5000");
    const older = buildLeaderboardEntry(makeRunState({ startedAtMs: 4000, bolts: 80 }), "run:4000");

    expect(getLeaderboardBestScore([current, prior, older], current.id)).toBe(prior.score);
    expect(getLeaderboardBestScore([], current.id)).toBeNull();
  });

  it("grants cumulative rewards for newly reached divisions", () => {
    expect(getLeaderboardPromotionRewards("scrapper", 40_000)).toEqual({
      divisions: ["raider", "ace"],
      reward: { bolts: 250, cores: 1 },
    });
    expect(getLeaderboardPromotionRewards("ace", 95_000, ["elite"])).toEqual({
      divisions: ["legend"],
      reward: { bolts: 400, cores: 3 },
    });
  });
});
