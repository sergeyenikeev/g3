import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/prng";
import {
  createEndlessLevelProgress,
  getCurrentEndlessLevelFinale,
  getCurrentEndlessLevelModifier,
  getCurrentEndlessLevelObjective,
  getEndlessLevelFinaleForLevel,
  getPendingEndlessLevelModifier,
  getPendingEndlessLevelObjective,
  getWaveInEndlessLevel,
  isEndlessLevelObjectiveComplete,
  isEndlessLevelFinalWave,
  promotePendingEndlessLevel,
  queueNextEndlessLevel,
} from "../../src/game/run/endlessLevels";

describe("endlessLevels", () => {
  it("starts with level 1 and a valid modifier", () => {
    const progress = createEndlessLevelProgress(createRng("level-seed"));
    expect(progress.current.index).toBe(1);
    expect(progress.pending).toBeNull();
    expect(getCurrentEndlessLevelModifier(progress).id).toBe(progress.current.modifierId);
    expect(getCurrentEndlessLevelObjective(progress).target).toBeGreaterThan(0);
  });

  it("queues the next level reward and promotes pending progress", () => {
    const rng = createRng("level-seed-2");
    const initial = createEndlessLevelProgress(rng);
    const queued = queueNextEndlessLevel(initial, rng);

    expect(queued.pending?.index).toBe(2);
    expect(queued.lastCleared?.levelIndex).toBe(1);
    expect(queued.lastCleared?.rewardBolts).toBeGreaterThan(0);
    expect(getPendingEndlessLevelModifier(queued)?.id).toBe(queued.pending?.modifierId);
    expect(getPendingEndlessLevelObjective(queued)?.target).toBeGreaterThan(0);
    expect(queued.lastCleared?.objectiveTarget).toBeGreaterThan(0);
    expect(queued.lastCleared?.finaleRewardBolts ?? 0).toBeGreaterThanOrEqual(0);

    const promoted = promotePendingEndlessLevel(queued);
    expect(promoted.current.index).toBe(2);
    expect(promoted.pending).toBeNull();
    expect(promoted.lastCleared).toBeNull();
  });

  it("assigns special finales only to eligible levels", () => {
    expect(getEndlessLevelFinaleForLevel(2, "crossfire_protocol")?.id).toBe("crossfire_overseer");
    expect(getEndlessLevelFinaleForLevel(6, "iron_convoy")?.id).toBe("scrap_juggernaut");
    expect(getEndlessLevelFinaleForLevel(3, "salvage_surge")?.id).toBe("salvage_storm");
    expect(getEndlessLevelFinaleForLevel(2, "salvage_surge")).toBeNull();
    expect(getEndlessLevelFinaleForLevel(4, "razor_parade")).toBeNull();
  });

  it("exposes the current finale when the level rolled one", () => {
    const progress = createEndlessLevelProgress(createRng("level-seed-4"));
    progress.current.index = 6;
    progress.current.modifierId = "iron_convoy";
    progress.current.finaleId = "scrap_juggernaut";
    expect(getCurrentEndlessLevelFinale(progress)?.id).toBe("scrap_juggernaut");
  });

  it("marks level objectives complete when progress reaches the target", () => {
    const progress = createEndlessLevelProgress(createRng("level-seed-3"));
    progress.current.objective.progress = progress.current.objective.target;
    expect(isEndlessLevelObjectiveComplete(progress.current.objective)).toBe(true);
  });

  it("maps waves into repeating 4-wave levels", () => {
    expect(getWaveInEndlessLevel(1)).toBe(1);
    expect(getWaveInEndlessLevel(4)).toBe(4);
    expect(getWaveInEndlessLevel(5)).toBe(1);
    expect(isEndlessLevelFinalWave(3)).toBe(false);
    expect(isEndlessLevelFinalWave(4)).toBe(true);
    expect(isEndlessLevelFinalWave(8)).toBe(true);
  });
});
