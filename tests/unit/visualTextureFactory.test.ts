import { describe, expect, it } from "vitest";
import {
  createBgFarSilhouette,
  createBgTile256,
  createDecals,
  createLightGradient,
  createVfxTextures,
  createVignette,
} from "../../src/visual/TextureFactory";

class StubTextureManager {
  private readonly map = new Map<string, any>();

  exists(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): any {
    return this.map.get(key);
  }

  createCanvas(key: string, width: number, height: number): any | null {
    if (this.map.has(key)) return null;
    const tex = {
      key,
      width,
      height,
      context: {
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (_img: any, _x: number, _y: number) => void 0,
      },
      refresh: () => void 0,
    };
    this.map.set(key, tex);
    return tex;
  }
}

describe("TextureFactory (visual)", () => {
  it("создаёт bg_tile_256 (256x256) без ошибок", () => {
    const scene: any = { textures: new StubTextureManager() };
    const tex = createBgTile256(scene, "seed");
    expect(tex).toBeTruthy();
    expect(scene.textures.get("bg_tile_256").width).toBe(256);
    expect(scene.textures.get("bg_tile_256").height).toBe(256);
  });

  it("создаёт bg_far_silhouette (1024x512) без ошибок", () => {
    const scene: any = { textures: new StubTextureManager() };
    const tex = createBgFarSilhouette(scene, "seed");
    expect(tex).toBeTruthy();
    expect(scene.textures.get("bg_far_silhouette").width).toBe(1024);
    expect(scene.textures.get("bg_far_silhouette").height).toBe(512);
  });

  it("создаёт vignette и lightGradient (512x512) без ошибок", () => {
    const scene: any = { textures: new StubTextureManager() };
    createVignette(scene);
    createLightGradient(scene);
    expect(scene.textures.get("vignette").width).toBe(512);
    expect(scene.textures.get("vignette").height).toBe(512);
    expect(scene.textures.get("lightGradient").width).toBe(512);
    expect(scene.textures.get("lightGradient").height).toBe(512);
  });

  it("создаёт decals pack (12 шт) и vfx pack (7 шт)", () => {
    const scene: any = { textures: new StubTextureManager() };
    const decals = createDecals(scene, "seed");
    expect(Object.keys(decals)).toHaveLength(12);
    for (const [k, t] of Object.entries(decals)) {
      expect(k).toMatch(/^decal_(oil|scratch|bolts)_0[1-4]$/);
      expect(t.width).toBe(64);
      expect(t.height).toBe(64);
    }

    const vfx = createVfxTextures(scene);
    expect(Object.keys(vfx)).toHaveLength(7);
    expect(vfx["vfx_ring"]!.width).toBe(256);
    expect(vfx["vfx_ring"]!.height).toBe(256);
    expect(vfx["vfx_glow_blob"]!.width).toBe(128);
    expect(vfx["vfx_glow_blob"]!.height).toBe(128);
    expect(vfx["vfx_spark"]!.width).toBe(32);
    expect(vfx["vfx_spark"]!.height).toBe(32);
    expect(vfx["vfx_smoke_puff"]!.width).toBe(64);
    expect(vfx["vfx_smoke_puff"]!.height).toBe(64);
    expect(vfx["vfx_trail"]!.width).toBe(64);
    expect(vfx["vfx_trail"]!.height).toBe(16);
    expect(vfx["vfx_hit_flash"]!.width).toBe(64);
    expect(vfx["vfx_hit_flash"]!.height).toBe(64);
    expect(vfx["vfx_line"]!.width).toBe(1);
    expect(vfx["vfx_line"]!.height).toBe(64);
  });
});
