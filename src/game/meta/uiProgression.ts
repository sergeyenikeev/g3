import type { SaveData } from "../../platform/save/saveManager";

export type UiProgressStage = "starter" | "growing" | "advanced";

export type UiProgressSnapshot = {
  stage: UiProgressStage;
  sessionsStarted: number;
  runsCompleted: number;
  bestWave: number;
  tutorialCompleted: boolean;
  purchasedNodeCount: number;
};

const WORKSHOP_ORDER = [
  "meta_frame_1",
  "meta_core_1",
  "meta_coil_1",
  "meta_tail_1",
  "meta_salvage_routes",
  "meta_core_2",
  "meta_coil_2",
  "meta_frame_2",
  "meta_tail_2",
  "meta_dash_unlock",
  "meta_recycler_overdrive",
  "meta_flux_rig",
  "meta_recycler_lattice",
  "meta_dash_caps",
] as const;

export function getUiProgressSnapshot(save: SaveData): UiProgressSnapshot {
  const sessionsStarted = clampInt(save.liveops.sessionsStarted);
  const runsCompleted = clampInt(save.stats.runsCompleted);
  const bestWave = clampInt(save.stats.bestWave);
  const tutorialCompleted = Boolean(save.tutorial.completed || save.tutorial.skipped);
  const purchasedNodeCount = Object.values(save.meta.nodeLevels).reduce((total, level) => total + (clampInt(level) > 0 ? 1 : 0), 0);

  if (sessionsStarted <= 2 || (!tutorialCompleted && runsCompleted < 2) || (runsCompleted < 2 && bestWave < 8 && purchasedNodeCount < 2)) {
    return {
      stage: "starter",
      sessionsStarted,
      runsCompleted,
      bestWave,
      tutorialCompleted,
      purchasedNodeCount,
    };
  }

  if (sessionsStarted <= 6 || runsCompleted < 6 || bestWave < 18 || purchasedNodeCount < 5) {
    return {
      stage: "growing",
      sessionsStarted,
      runsCompleted,
      bestWave,
      tutorialCompleted,
      purchasedNodeCount,
    };
  }

  return {
    stage: "advanced",
    sessionsStarted,
    runsCompleted,
    bestWave,
    tutorialCompleted,
    purchasedNodeCount,
  };
}

export function getVisibleWorkshopNodeIds(save: SaveData, nodeIds: readonly string[]): string[] {
  const snapshot = getUiProgressSnapshot(save);
  const baseOrder = orderWorkshopNodeIds(nodeIds);
  const baseVisibleCount = snapshot.stage === "starter" ? 4 : snapshot.stage === "growing" ? 8 : baseOrder.length;
  const purchased = new Set(
    Object.entries(save.meta.nodeLevels)
      .filter(([, level]) => clampInt(level) > 0)
      .map(([nodeId]) => nodeId)
  );
  const visible = new Set<string>(baseOrder.slice(0, baseVisibleCount));
  for (const nodeId of purchased) visible.add(nodeId);
  return baseOrder.filter((nodeId) => visible.has(nodeId));
}

export function getRecommendedWorkshopNodeId(save: SaveData, visibleNodeIds: readonly string[]): string | null {
  const visible = new Set(visibleNodeIds);
  for (const nodeId of WORKSHOP_ORDER) {
    if (!visible.has(nodeId)) continue;
    if (clampInt(save.meta.nodeLevels[nodeId] ?? 0) <= 0) return nodeId;
  }

  for (const nodeId of visibleNodeIds) {
    if (clampInt(save.meta.nodeLevels[nodeId] ?? 0) <= 0) return nodeId;
  }

  return visibleNodeIds[0] ?? null;
}

export function getLeaderboardRowLimit(stage: UiProgressStage): number {
  return stage === "advanced" ? 8 : 3;
}

export function orderWorkshopNodeIds(nodeIds: readonly string[]): string[] {
  const priority = new Map<string, number>(WORKSHOP_ORDER.map((nodeId, index) => [nodeId, index]));
  return [...nodeIds].sort((a, b) => {
    const ai = priority.get(a);
    const bi = priority.get(b);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.localeCompare(b);
  });
}

function clampInt(value: unknown): number {
  return Math.max(0, Math.floor(typeof value === "number" && Number.isFinite(value) ? value : 0));
}
