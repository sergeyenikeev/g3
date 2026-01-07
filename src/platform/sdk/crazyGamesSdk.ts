export type CrazyGamesGameApi = {
  sdkGameLoadingStart?: () => void;
  sdkGameLoadingProgress?: (percent: number) => void;
  sdkGameLoadingStop?: () => void;
  sdkGameplayStart?: () => void;
  sdkGameplayStop?: () => void;
  sdkHappytime?: () => void;
};

export function getCrazyGamesGameApi(): CrazyGamesGameApi | null {
  const w = window as any;
  const sdk = (w?.CrazyGames?.SDK as any) ?? (w?.CrazyGamesSDK as any) ?? null;
  const game = sdk?.game as CrazyGamesGameApi | undefined;
  return game ?? null;
}

