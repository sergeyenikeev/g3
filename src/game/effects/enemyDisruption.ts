export type EnemyDisruptionState = {
  impulseX: number;
  impulseY: number;
  controlLockSec: number;
};

export function createEnemyDisruptionState(): EnemyDisruptionState {
  return {
    impulseX: 0,
    impulseY: 0,
    controlLockSec: 0,
  };
}

export function addEnemyDisruption(
  state: EnemyDisruptionState,
  impulseX: number,
  impulseY: number,
  controlLockSec: number
): EnemyDisruptionState {
  return {
    impulseX: state.impulseX + impulseX,
    impulseY: state.impulseY + impulseY,
    controlLockSec: Math.max(state.controlLockSec, Math.max(0, controlLockSec)),
  };
}

export function resolveEnemyVelocity(
  desiredX: number,
  desiredY: number,
  state: EnemyDisruptionState,
  dt: number
): {
  velocityX: number;
  velocityY: number;
  next: EnemyDisruptionState;
  controlLocked: boolean;
} {
  const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
  const controlLocked = state.controlLockSec > 0.001;
  const aiWeight = controlLocked ? 0 : 1;
  const velocityX = desiredX * aiWeight + state.impulseX;
  const velocityY = desiredY * aiWeight + state.impulseY;

  const damping = Math.exp(-8 * safeDt);
  const nextImpulseX = dampSmall(state.impulseX * damping);
  const nextImpulseY = dampSmall(state.impulseY * damping);

  return {
    velocityX,
    velocityY,
    controlLocked,
    next: {
      impulseX: nextImpulseX,
      impulseY: nextImpulseY,
      controlLockSec: Math.max(0, state.controlLockSec - safeDt),
    },
  };
}

function dampSmall(value: number): number {
  return Math.abs(value) < 4 ? 0 : value;
}
