export type InputState = {
  moveX: number;
  moveY: number;
  flipPressed: boolean;
  dashPressed: boolean;
};

export const inputState: InputState = {
  moveX: 0,
  moveY: 0,
  flipPressed: false,
  dashPressed: false,
};

export function consumeActions(): { flip: boolean; dash: boolean } {
  const flip = inputState.flipPressed;
  const dash = inputState.dashPressed;
  inputState.flipPressed = false;
  inputState.dashPressed = false;
  return { flip, dash };
}

