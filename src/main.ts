import "./style.css";
import { createGame } from "./app/createGame";

const game = createGame("app");
if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
  (window as any).__MC_GAME__ = game;
}
