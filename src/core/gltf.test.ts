import { describe, expect, it } from 'vitest';
import { createModel, setVoxel, type Model } from './model';
import { buildVoxelMesh, encodeGlb } from './gltf';

interface GltfJson {
  asset: { version: string };
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: { name: string; mesh: number }[];
  meshes: {
    primitives: { attributes: Record<string, number>; indices: number; material: number }[];
  }[];
  materials: {
    extensions?: { KHR_materials_unlit?: object };
    pbrMetallicRoughness: { metallicFactor: number; roughnessFactor: number };
  }[];
  accessors: { count: number; min?: number[]; max?: number[] }[];
  bufferViews: unknown[];
  buffers: { byteLength: number }[];
  extensionsUsed?: string[];
}

function parseGlb(bytes: Uint8Array): {
  magic: number;
  version: number;
  total: number;
  json: GltfJson;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const total = view.getUint32(8, true);
  const jsonLen = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  expect(jsonType).toBe(0x4e4f534a);
  const jsonBytes = bytes.subarray(20, 20 + jsonLen);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes)) as GltfJson;
  return { magic, version, total, json };
}

function single(slot = 1): Model {
  const m = createModel(1, 1, 1);
  setVoxel(m, 0, 0, 0, slot);
  return m;
}

describe('buildVoxelMesh', () => {
  it('emits six faces for an isolated voxel', () => {
    const mesh = buildVoxelMesh(single());
    expect(mesh.vertexCount).toBe(24);
    expect(mesh.indexCount).toBe(36);
  });

  it('drops fully enclosed interior faces', () => {
    const m = createModel(3, 3, 3);
    for (let z = 0; z < 3; z++)
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setVoxel(m, x, y, z, 1);
    const mesh = buildVoxelMesh(m);
    // Surface of a solid 3x3x3 cube: 6 faces of 9 quads each.
    expect(mesh.vertexCount).toBe(54 * 4);
    expect(mesh.indexCount).toBe(54 * 6);
  });

  it('sRGB-decodes the voxel palette colour into every vertex', () => {
    const m = single(1);
    const po = 1 * 4;
    const toLinear = (c: number) => {
      const s = c / 255;
      const lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      return Math.round(lin * 255);
    };
    const mesh = buildVoxelMesh(m);
    for (let v = 0; v < mesh.vertexCount; v++) {
      expect(mesh.colors[v * 4]).toBe(toLinear(m.palette[po]!));
      expect(mesh.colors[v * 4 + 1]).toBe(toLinear(m.palette[po + 1]!));
      expect(mesh.colors[v * 4 + 2]).toBe(toLinear(m.palette[po + 2]!));
      expect(mesh.colors[v * 4 + 3]).toBe(m.palette[po + 3]);
    }
  });

  it('maps model z-up to glTF y-up', () => {
    const m = createModel(2, 3, 4);
    setVoxel(m, 0, 0, 0, 1);
    setVoxel(m, 1, 2, 3, 1);
    const mesh = buildVoxelMesh(m);
    // glTF Y spans model Z (0..4); glTF Z spans -model Y (-3..0).
    expect(mesh.min).toEqual([0, 0, -3]);
    expect(mesh.max).toEqual([2, 4, 0]);
  });

  it('rejects an empty model', () => {
    expect(() => buildVoxelMesh(createModel(2, 2, 2))).toThrow(/empty/);
  });
});

describe('encodeGlb', () => {
  it('writes a well-formed glb container', () => {
    const bytes = encodeGlb(single());
    expect(bytes.length % 4).toBe(0);
    const { magic, version, total } = parseGlb(bytes);
    expect(magic).toBe(0x46546c67);
    expect(version).toBe(2);
    expect(total).toBe(bytes.length);
  });

  it('defaults to an unlit material with no NORMAL attribute', () => {
    const { json } = parseGlb(encodeGlb(single()));
    expect(json.asset.version).toBe('2.0');
    expect(json.scenes[0].nodes).toEqual([0]);
    expect(json.nodes).toHaveLength(1);
    expect(json.nodes[0].name).toBe('part');
    expect(json.nodes[0].mesh).toBe(0);
    expect(json.meshes[0].primitives[0].attributes).toEqual({
      POSITION: 0,
      COLOR_0: 1,
    });
    expect(json.materials).toHaveLength(1);
    expect(json.materials[0].extensions.KHR_materials_unlit).toEqual({});
    expect(json.extensionsUsed).toContain('KHR_materials_unlit');
  });

  it('emits NORMAL and a plain PBR material when lit', () => {
    const { json } = parseGlb(
      encodeGlb(single(), { lighting: 'pbr', metallicFactor: 0.25, roughnessFactor: 0.5 }),
    );
    expect(json.meshes[0].primitives[0].attributes).toEqual({
      POSITION: 0,
      NORMAL: 1,
      COLOR_0: 2,
    });
    expect(json.extensionsUsed).toBeUndefined();
    expect(json.materials[0].extensions).toBeUndefined();
    expect(json.materials[0].pbrMetallicRoughness.metallicFactor).toBe(0.25);
    expect(json.materials[0].pbrMetallicRoughness.roughnessFactor).toBe(0.5);
  });

  it('keeps accessor counts in step with the mesh', () => {
    const m = single();
    const mesh = buildVoxelMesh(m);
    const { json } = parseGlb(encodeGlb(m));
    const idxAccessor = json.meshes[0].primitives[0].indices;
    expect(json.accessors[0].count).toBe(mesh.vertexCount);
    expect(json.accessors[0].min).toEqual(mesh.min);
    expect(json.accessors[0].max).toEqual(mesh.max);
    expect(json.accessors[idxAccessor].count).toBe(mesh.indexCount);
    expect(json.buffers[0].byteLength).toBe(
      mesh.vertexCount * 12 + mesh.vertexCount * 4 + mesh.indexCount * 4,
    );
  });

  it('includes the normal buffer in the lit byte length', () => {
    const m = single();
    const mesh = buildVoxelMesh(m);
    const { json } = parseGlb(encodeGlb(m, { lighting: 'pbr' }));
    expect(json.buffers[0].byteLength).toBe(
      mesh.vertexCount * 12 + mesh.vertexCount * 12 + mesh.vertexCount * 4 + mesh.indexCount * 4,
    );
  });
});
