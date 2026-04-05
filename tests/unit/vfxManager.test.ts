import { describe, expect, it } from "vitest";
import { VfxManager } from "../../src/visual/VfxManager";

function makeObj(kind: string, x: number, y: number) {
  const calls: Record<string, number> = {};
  const inc = (m: string) => {
    calls[m] = (calls[m] ?? 0) + 1;
  };

  const obj: any = {
    kind,
    x,
    y,
    calls,
    destroyed: false,
    setDepth: (_d: number) => {
      inc("setDepth");
      return obj;
    },
    setBlendMode: (_b: any) => {
      inc("setBlendMode");
      return obj;
    },
    setTint: (_t: number) => {
      inc("setTint");
      return obj;
    },
    setAlpha: (_a: number) => {
      inc("setAlpha");
      return obj;
    },
    setScale: (_s: number) => {
      inc("setScale");
      return obj;
    },
    setRotation: (_r: number) => {
      inc("setRotation");
      return obj;
    },
    setDisplaySize: (_w: number, _h: number) => {
      inc("setDisplaySize");
      return obj;
    },
    setScrollFactor: (_sf: number) => {
      inc("setScrollFactor");
      return obj;
    },
    setOrigin: (_x: number, _y?: number) => {
      inc("setOrigin");
      return obj;
    },
    setPosition: (nx: number, ny: number) => {
      inc("setPosition");
      obj.x = nx;
      obj.y = ny;
      return obj;
    },
    destroy: () => {
      inc("destroy");
      obj.destroyed = true;
    },
  };

  return obj;
}

function makeWorld() {
  const created: any[] = [];
  const world: any = {
    created,
    add: {
      image: (x: number, y: number, key: string) => {
        const o = makeObj(key, x, y);
        created.push(o);
        return o;
      },
    },
    cameras: { main: { shake: () => void 0, scrollX: 0, scrollY: 0, zoom: 1 } },
  };
  return world;
}

function makeUi() {
  const created: any[] = [];
  const ui: any = {
    created,
    scale: { width: 1280, height: 720 },
    registry: {
      get: (key: string) => {
        if (key === "locale") return "ru";
        if (key === "uiBoltsPos") return { x: 1180, y: 42 };
        return undefined;
      },
    },
    add: {
      image: (x: number, y: number, key: string) => {
        const o = makeObj(key, x, y);
        created.push(o);
        return o;
      },
      text: (x: number, y: number, _text: string, _style: any) => {
        const o = makeObj("text", x, y);
        created.push(o);
        return o;
      },
    },
  };
  return ui;
}

describe("VfxManager", () => {
  it("меняет лимиты при смене quality preset", () => {
    const vfx = new VfxManager(makeWorld(), makeUi(), { quality: "low" });
    expect(vfx.getParticleCap()).toBe(120);
    expect(vfx.getMagnetLineCap()).toBe(4);
    vfx.setQuality("high");
    expect(vfx.getParticleCap()).toBe(360);
    expect(vfx.getMagnetLineCap()).toBe(8);
  });

  it("flip_used создаёт ring и не превышает cap по частицам", () => {
    const world = makeWorld();
    const ui = makeUi();
    const vfx = new VfxManager(world, ui, { quality: "low" });

    vfx.emit("flip_used", { x: 100, y: 200, radius: 160 });
    expect(world.created.some((o: any) => o.kind === "vfx_ring")).toBe(true);

    for (let i = 0; i < 40; i++) vfx.emit("scrap_collected", { x: 0, y: 0, tex: "scrap_common" });
    expect(vfx.getActiveCounts().particles).toBeLessThanOrEqual(vfx.getParticleCap());
  });

  it("магнитные линии обновляются не чаще 1 раза в 120мс", () => {
    const world = makeWorld();
    const vfx = new VfxManager(world, undefined, { quality: "medium" });

    vfx.setMagnetLines(
      { x: 0, y: 0 },
      [
        { x: 10, y: 0 },
        { x: 0, y: 20 },
        { x: -30, y: 0 },
      ]
    );

    vfx.update(0.01); // 10ms => первая отрисовка
    const line = world.created.find((o: any) => o.kind === "vfx_line");
    expect(line).toBeTruthy();
    expect(line.calls.setPosition).toBe(1);

    for (let i = 0; i < 11; i++) vfx.update(0.01); // +110ms => ещё рано
    expect(line.calls.setPosition).toBe(1);

    vfx.update(0.01); // +10ms => 120ms с момента последнего апдейта
    expect(line.calls.setPosition).toBe(2);
  });
  it("combat and bank events spawn readable hit, kill, and reward feedback", () => {
    const world = makeWorld();
    const ui = makeUi();
    const vfx = new VfxManager(world, ui, { quality: "medium" });

    vfx.emit("enemy_hit", { x: 120, y: 160, enemyType: "shooter" });
    vfx.emit("enemy_killed", { x: 140, y: 180, enemyType: "cutter" });
    vfx.emit("bank_complete", { x: 220, y: 260, bolts: 12, hpHealed: 6 });

    expect(world.created.some((o: any) => o.kind === "vfx_hit_flash")).toBe(true);
    expect(world.created.some((o: any) => o.kind === "enemy_cutter")).toBe(true);
    expect(ui.created.some((o: any) => o.kind === "text")).toBe(true);
    expect(ui.created.some((o: any) => o.kind === "vfx_spark")).toBe(true);
  });
});
