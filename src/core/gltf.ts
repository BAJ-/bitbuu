import type { Model } from './model';

export interface VoxelMesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Uint8Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
  min: [number, number, number];
  max: [number, number, number];
}

// Faces of a unit voxel cube, each as an outward normal plus four corner
// offsets wound counter-clockwise when seen from outside, and the neighbour
// offset whose emptiness makes the face visible. Coordinates are in the model's
// z-up space; the axis conversion to glTF's y-up space happens at emit time.
interface Face {
  nx: number;
  ny: number;
  nz: number;
  dx: number;
  dy: number;
  dz: number;
  corners: ReadonlyArray<readonly [number, number, number]>;
}

const FACES: ReadonlyArray<Face> = [
  {
    nx: 1,
    ny: 0,
    nz: 0,
    dx: 1,
    dy: 0,
    dz: 0,
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    nx: -1,
    ny: 0,
    nz: 0,
    dx: -1,
    dy: 0,
    dz: 0,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    nx: 0,
    ny: 1,
    nz: 0,
    dx: 0,
    dy: 1,
    dz: 0,
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    nx: 0,
    ny: -1,
    nz: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    nx: 0,
    ny: 0,
    nz: 1,
    dx: 0,
    dy: 0,
    dz: 1,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    nx: 0,
    ny: 0,
    nz: -1,
    dx: 0,
    dy: 0,
    dz: -1,
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];

function isSolid(m: Model, x: number, y: number, z: number): boolean {
  if (x < 0 || y < 0 || z < 0 || x >= m.sx || y >= m.sy || z >= m.sz) return false;
  return m.voxels[x + y * m.sx + z * m.sx * m.sy]! !== 0;
}

// glTF treats COLOR_0 as linear, but the palette stores sRGB bytes (what the
// 2D editor displays directly). Decode sRGB -> linear once per palette so a
// compliant engine's linear -> sRGB output reproduces the editor's colours.
function srgbToLinearByte(c: number): number {
  const s = c / 255;
  const lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  return Math.round(lin * 255);
}

function linearizePalette(pal: Uint8Array): Uint8Array {
  const out = new Uint8Array(pal.length);
  for (let i = 0; i < pal.length; i += 4) {
    out[i] = srgbToLinearByte(pal[i]!);
    out[i + 1] = srgbToLinearByte(pal[i + 1]!);
    out[i + 2] = srgbToLinearByte(pal[i + 2]!);
    out[i + 3] = pal[i + 3]!;
  }
  return out;
}

// Face-culled surface mesh: a quad is emitted only where a solid voxel borders
// an empty cell or the model edge, so interior faces are dropped. Vertices are
// not shared between faces, giving each face a flat normal and a flat colour
// (sharp voxel edges). Model z-up coordinates are converted to glTF y-up via
// (x, y, z) -> (x, z, -y), a proper rotation that preserves winding.
export function buildVoxelMesh(m: Model): VoxelMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const pal = linearizePalette(m.palette);

  let vertexCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let z = 0; z < m.sz; z++) {
    for (let y = 0; y < m.sy; y++) {
      for (let x = 0; x < m.sx; x++) {
        const slot = m.voxels[x + y * m.sx + z * m.sx * m.sy]!;
        if (slot === 0) continue;
        const po = slot * 4;
        const r = pal[po]!;
        const g = pal[po + 1]!;
        const b = pal[po + 2]!;
        const a = pal[po + 3]!;

        for (const f of FACES) {
          if (isSolid(m, x + f.dx, y + f.dy, z + f.dz)) continue;
          const base = vertexCount;
          for (const c of f.corners) {
            const mx = x + c[0];
            const my = y + c[1];
            const mz = z + c[2];
            const gx = mx;
            const gy = mz;
            const gz = -my + 0;
            positions.push(gx, gy, gz);
            normals.push(f.nx, f.nz, -f.ny + 0);
            colors.push(r, g, b, a);
            if (gx < minX) minX = gx;
            if (gy < minY) minY = gy;
            if (gz < minZ) minZ = gz;
            if (gx > maxX) maxX = gx;
            if (gy > maxY) maxY = gy;
            if (gz > maxZ) maxZ = gz;
            vertexCount++;
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  if (vertexCount === 0) {
    throw new Error('cannot export an empty model');
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Uint8Array(colors),
    indices: new Uint32Array(indices),
    vertexCount,
    indexCount: indices.length,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
}

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENT_FLOAT = 5126;
const COMPONENT_UBYTE = 5121;
const COMPONENT_UINT = 5125;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;

function pad4(n: number): number {
  return (n + 3) & ~3;
}

export interface GlbOptions {
  // 'unlit' renders the palette colour exactly, ignoring scene lighting (the
  // right default for 2.5D voxel sprites). 'pbr' shades the surface with the
  // engine's lights, using metallic/roughness below.
  lighting?: 'unlit' | 'pbr';
  metallicFactor?: number;
  roughnessFactor?: number;
}

// Serialises a model as a self-contained binary glTF (.glb): a single mesh
// under one named node ("part") so animation can later drive that node's
// transform. Geometry uses per-vertex colour (COLOR_0) sampled from the
// palette, one material, one draw call. Unlit exports omit the NORMAL
// attribute, which a flat unlit material never reads.
export function encodeGlb(m: Model, options: GlbOptions = {}): Uint8Array {
  const lighting = options.lighting ?? 'unlit';
  const lit = lighting === 'pbr';
  const mesh = buildVoxelMesh(m);

  const posLen = mesh.vertexCount * 12;
  const normLen = mesh.vertexCount * 12;
  const colLen = mesh.vertexCount * 4;
  const idxLen = mesh.indexCount * 4;

  const posOffset = 0;
  const normOffset = posOffset + posLen;
  const colOffset = lit ? normOffset + normLen : normOffset;
  const idxOffset = colOffset + colLen;
  const binLength = idxOffset + idxLen;

  const accessors: unknown[] = [
    {
      bufferView: 0,
      componentType: COMPONENT_FLOAT,
      count: mesh.vertexCount,
      type: 'VEC3',
      min: mesh.min,
      max: mesh.max,
    },
  ];
  const bufferViews: unknown[] = [
    { buffer: 0, byteOffset: posOffset, byteLength: posLen, target: TARGET_ARRAY_BUFFER },
  ];
  const attributes: Record<string, number> = { POSITION: 0 };

  if (lit) {
    attributes.NORMAL = accessors.length;
    accessors.push({
      bufferView: bufferViews.length,
      componentType: COMPONENT_FLOAT,
      count: mesh.vertexCount,
      type: 'VEC3',
    });
    bufferViews.push({
      buffer: 0,
      byteOffset: normOffset,
      byteLength: normLen,
      target: TARGET_ARRAY_BUFFER,
    });
  }

  attributes.COLOR_0 = accessors.length;
  accessors.push({
    bufferView: bufferViews.length,
    componentType: COMPONENT_UBYTE,
    normalized: true,
    count: mesh.vertexCount,
    type: 'VEC4',
  });
  bufferViews.push({
    buffer: 0,
    byteOffset: colOffset,
    byteLength: colLen,
    target: TARGET_ARRAY_BUFFER,
  });

  const indicesAccessor = accessors.length;
  accessors.push({
    bufferView: bufferViews.length,
    componentType: COMPONENT_UINT,
    count: mesh.indexCount,
    type: 'SCALAR',
  });
  bufferViews.push({
    buffer: 0,
    byteOffset: idxOffset,
    byteLength: idxLen,
    target: TARGET_ELEMENT_ARRAY_BUFFER,
  });

  const material: Record<string, unknown> = {
    name: 'voxel',
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: lit ? (options.metallicFactor ?? 0) : 0,
      roughnessFactor: lit ? (options.roughnessFactor ?? 1) : 1,
    },
  };
  if (!lit) material.extensions = { KHR_materials_unlit: {} };

  const json = {
    asset: { version: '2.0', generator: 'bitbuu' },
    ...(lit ? {} : { extensionsUsed: ['KHR_materials_unlit'] }),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'part', mesh: 0 }],
    meshes: [{ primitives: [{ attributes, indices: indicesAccessor, material: 0 }] }],
    materials: [material],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }],
  };

  const bin = new Uint8Array(binLength);
  const binView = new DataView(bin.buffer);
  for (let i = 0; i < mesh.positions.length; i++) {
    binView.setFloat32(posOffset + i * 4, mesh.positions[i]!, true);
  }
  if (lit) {
    for (let i = 0; i < mesh.normals.length; i++) {
      binView.setFloat32(normOffset + i * 4, mesh.normals[i]!, true);
    }
  }
  bin.set(mesh.colors, colOffset);
  for (let i = 0; i < mesh.indices.length; i++) {
    binView.setUint32(idxOffset + i * 4, mesh.indices[i]!, true);
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = pad4(jsonBytes.length);
  const binPadded = pad4(binLength);

  const total = 12 + 8 + jsonPadded + 8 + binPadded;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);

  view.setUint32(12, jsonPadded, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  for (let i = jsonBytes.length; i < jsonPadded; i++) out[20 + i] = 0x20;

  const binChunkStart = 20 + jsonPadded;
  view.setUint32(binChunkStart, binPadded, true);
  view.setUint32(binChunkStart + 4, CHUNK_BIN, true);
  out.set(bin, binChunkStart + 8);

  return out;
}
