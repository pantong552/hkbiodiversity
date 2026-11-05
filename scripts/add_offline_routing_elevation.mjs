import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const INPUT = path.join(ROOT, '.next', 'offline-routing', 'hong-kong-v1.bin');
const OUTPUT = path.join(ROOT, 'public', 'offline-routing', 'hong-kong-v2.bin');
const ZOOM = 15;
const TILE_COUNT = 2 ** ZOOM;
const TILE_SIZE = 256;
const HEADER_SIZE = 48;
const WAY_SIZE = 10;
const WATER_ELEVATION_THRESHOLD = -10;
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

function decodeSignedVarint(bytes, cursor) {
  let value = 0;
  let shift = 0;
  while (true) {
    if (cursor.offset >= bytes.length || shift > 63) {
      throw new Error('Road package contains an invalid varint');
    }
    const byte = bytes[cursor.offset++];
    value += (byte & 0x7f) * (2 ** shift);
    if (byte < 0x80) break;
    shift += 7;
  }
  return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function encodeSignedVarint(value) {
  let encodedValue = value >= 0 ? value * 2 : (-value * 2) - 1;
  const bytes = [];
  while (encodedValue > 0x7f) {
    bytes.push((encodedValue & 0x7f) | 0x80);
    encodedValue = Math.floor(encodedValue / 128);
  }
  bytes.push(encodedValue);
  return bytes;
}

function decodeBasePackage(bytes) {
  if (bytes.length < HEADER_SIZE) throw new Error('Road package is incomplete');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  const version = view.getUint16(4, true);
  const headerSize = view.getUint16(6, true);
  const nodeCount = view.getUint32(8, true);
  const wayCount = view.getUint32(12, true);
  const referenceCount = view.getUint32(16, true);
  const tagCount = view.getUint32(20, true);
  const coordinateSize = view.getUint32(24, true);
  const waySize = view.getUint32(28, true);
  const referenceSize = view.getUint32(32, true);
  const tagSize = view.getUint32(36, true);
  const downloadedAt = Number(view.getBigUint64(40, true));
  if (
    magic !== 'HKRT'
    || version !== 1
    || headerSize !== HEADER_SIZE
    || waySize !== wayCount * WAY_SIZE
    || headerSize + coordinateSize + waySize + referenceSize + tagSize !== bytes.length
  ) {
    throw new Error('Expected a valid version 1 Hong Kong road package');
  }

  const nodes = new Array(nodeCount);
  const cursor = { offset: headerSize };
  let longitude = 0;
  let latitude = 0;
  for (let index = 0; index < nodeCount; index++) {
    longitude += decodeSignedVarint(bytes, cursor);
    latitude += decodeSignedVarint(bytes, cursor);
    nodes[index] = [longitude / 10_000_000, latitude / 10_000_000];
  }
  if (cursor.offset !== headerSize + coordinateSize) {
    throw new Error('Road package coordinates failed validation');
  }

  const waysStart = cursor.offset;
  const referencesStart = waysStart + waySize;
  const referencesEnd = referencesStart + referenceSize;
  const tags = JSON.parse(new TextDecoder().decode(bytes.subarray(
    referencesEnd,
    referencesEnd + tagSize,
  )));
  if (!Array.isArray(tags) || tags.length !== tagCount) {
    throw new Error('Road package tags failed validation');
  }

  const references = [];
  const ways = new Array(wayCount);
  cursor.offset = referencesStart;
  let expectedOffset = 0;
  for (let index = 0; index < wayCount; index++) {
    const offset = waysStart + index * WAY_SIZE;
    const referenceOffset = view.getUint32(offset, true);
    const count = view.getUint32(offset + 4, true);
    const tagIndex = view.getUint16(offset + 8, true);
    if (
      referenceOffset !== expectedOffset
      || count < 2
      || count > referenceCount - expectedOffset
      || tagIndex >= tagCount
    ) {
      throw new Error('Road package way table failed validation');
    }
    const wayReferences = new Array(count);
    let previous = 0;
    for (let refIndex = 0; refIndex < count; refIndex++) {
      previous += decodeSignedVarint(bytes, cursor);
      if (previous < 0 || previous >= nodeCount || cursor.offset > referencesEnd) {
        throw new Error('Road package node references failed validation');
      }
      wayReferences[refIndex] = previous;
    }
    ways[index] = { nodes: wayReferences, tags: tags[tagIndex] };
    expectedOffset += count;
  }
  if (cursor.offset !== referencesEnd || expectedOffset !== referenceCount) {
    throw new Error('Road package reference section failed validation');
  }
  return { nodes, ways, references, downloadedAt };
}

function pixelLocation([longitude, latitude]) {
  const worldX = ((longitude + 180) / 360) * TILE_COUNT * TILE_SIZE;
  const radians = (latitude * Math.PI) / 180;
  const worldY = ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * TILE_COUNT * TILE_SIZE;
  return { x: worldX, y: worldY };
}

function getTileKey(x, y) {
  return `${Math.floor(x / TILE_SIZE)}/${Math.floor(y / TILE_SIZE)}`;
}

async function fetchTile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${x}/${y}.png`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Terrain tile ${x}/${y} returned HTTP ${response.status}`);
      const png = Buffer.from(await response.arrayBuffer());
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== TILE_SIZE || info.height !== TILE_SIZE || info.channels !== 4) {
        throw new Error(`Terrain tile ${x}/${y} has unexpected dimensions`);
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to download terrain tile ${x}/${y}`);
}

async function addNodeElevations(nodes) {
  const nodesByTile = new Map();
  nodes.forEach((node, nodeIndex) => {
    const { x, y } = pixelLocation(node);
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const tileKey = getTileKey(x, y);
    if (!nodesByTile.has(tileKey)) nodesByTile.set(tileKey, []);
    nodesByTile.get(tileKey).push([
      nodeIndex,
      x - tileX * TILE_SIZE,
      y - tileY * TILE_SIZE,
    ]);
  });
  const tiles = [...nodesByTile.entries()];
  const elevations = new Int16Array(nodes.length);
  let nextTile = 0;
  let completedTiles = 0;
  const worker = async () => {
    while (true) {
      const index = nextTile++;
      if (index >= tiles.length) return;
      const [key, references] = tiles[index];
      const [tileX, tileY] = key.split('/').map(Number);
      const pixels = await fetchTile(tileX, tileY);
      references.forEach(([nodeIndex, pixelX, pixelY]) => {
        const x0 = Math.floor(pixelX);
        const y0 = Math.floor(pixelY);
        const x1 = Math.min(x0 + 1, TILE_SIZE - 1);
        const y1 = Math.min(y0 + 1, TILE_SIZE - 1);
        const fractionX = pixelX - x0;
        const fractionY = pixelY - y0;
        const getElevation = (x, y) => {
          const offset = (y * TILE_SIZE + x) * 4;
          if (pixels[offset + 3] === 0) {
            throw new Error(`Terrain tile ${key} contains a missing elevation pixel`);
          }
          return pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
        };
        const topLeft = getElevation(x0, y0);
        const topRight = getElevation(x1, y0);
        const bottomLeft = getElevation(x0, y1);
        const bottomRight = getElevation(x1, y1);
        const top = topLeft + (topRight - topLeft) * fractionX;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;
        const sampledElevation = top + (bottom - top) * fractionY;
        if (!Number.isFinite(sampledElevation) || sampledElevation > 10_000) {
          throw new Error(`Terrain tile ${key} contains an invalid elevation`);
        }
        const elevation = sampledElevation < WATER_ELEVATION_THRESHOLD ? 0 : sampledElevation;
        const quantized = Math.round(elevation * 10);
        if (quantized < -32_768 || quantized > 32_767) {
          throw new Error(`Terrain tile ${key} elevation exceeds the package range`);
        }
        elevations[nodeIndex] = quantized;
      });
      completedTiles++;
      if (completedTiles % 25 === 0 || completedTiles === tiles.length) {
        console.log(`Elevation tiles: ${completedTiles}/${tiles.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  return { elevations, tileCount: tiles.length };
}

function buildElevatedPackage(network, elevations) {
  const coordinateBytes = [];
  let lastLongitude = 0;
  let lastLatitude = 0;
  network.nodes.forEach(([longitude, latitude]) => {
    const scaledLongitude = Math.round(longitude * 10_000_000);
    const scaledLatitude = Math.round(latitude * 10_000_000);
    coordinateBytes.push(...encodeSignedVarint(scaledLongitude - lastLongitude));
    coordinateBytes.push(...encodeSignedVarint(scaledLatitude - lastLatitude));
    lastLongitude = scaledLongitude;
    lastLatitude = scaledLatitude;
  });
  const elevationBytes = Buffer.alloc(elevations.length * 2);
  elevations.forEach((value, index) => elevationBytes.writeInt16LE(value, index * 2));
  const wayBytes = Buffer.alloc(network.ways.length * WAY_SIZE);
  const referenceBytes = [];
  let offset = 0;
  network.ways.forEach((way, index) => {
    wayBytes.writeUInt32LE(offset, index * WAY_SIZE);
    wayBytes.writeUInt32LE(way.nodes.length, index * WAY_SIZE + 4);
    wayBytes.writeUInt16LE(network.tagIndexes[index], index * WAY_SIZE + 8);
    let previous = 0;
    way.nodes.forEach((nodeIndex) => {
      referenceBytes.push(...encodeSignedVarint(nodeIndex - previous));
      previous = nodeIndex;
    });
    offset += way.nodes.length;
  });
  const tagBytes = Buffer.from(JSON.stringify(network.tags));
  const headerSize = 52;
  const coordinateBuffer = Buffer.from(coordinateBytes);
  const refsBuffer = Buffer.from(referenceBytes);
  const header = Buffer.alloc(headerSize);
  header.write('HKRT', 0);
  header.writeUInt16LE(2, 4);
  header.writeUInt16LE(headerSize, 6);
  header.writeUInt32LE(network.nodes.length, 8);
  header.writeUInt32LE(network.ways.length, 12);
  header.writeUInt32LE(offset, 16);
  header.writeUInt32LE(network.tags.length, 20);
  header.writeUInt32LE(coordinateBuffer.length, 24);
  header.writeUInt32LE(elevationBytes.length, 28);
  header.writeUInt32LE(wayBytes.length, 32);
  header.writeUInt32LE(refsBuffer.length, 36);
  header.writeUInt32LE(tagBytes.length, 40);
  header.writeBigUInt64LE(BigInt(network.downloadedAt), 44);
  return Buffer.concat([header, coordinateBuffer, elevationBytes, wayBytes, refsBuffer, tagBytes]);
}

function verifyPackage(bytes, expected) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.toString('ascii', 0, 4) !== 'HKRT'
    || view.getUint16(4, true) !== 2
    || view.getUint16(6, true) !== 52
    || view.getUint32(8, true) !== expected.nodes
    || view.getUint32(12, true) !== expected.ways
    || view.getUint32(28, true) !== expected.nodes * 2
  ) {
    throw new Error('Generated elevated package failed header validation');
  }
  const sectionSize = [24, 28, 32, 36, 40]
    .reduce((sum, offset) => sum + view.getUint32(offset, true), 52);
  if (sectionSize !== bytes.length) throw new Error('Generated elevated package size is invalid');
  const elevationStart = 52 + view.getUint32(24, true);
  let min = Infinity;
  let max = -Infinity;
  for (let index = 0; index < expected.nodes; index++) {
    const elevation = view.getInt16(elevationStart + index * 2, true) / 10;
    min = Math.min(min, elevation);
    max = Math.max(max, elevation);
  }
  if (!Number.isFinite(min) || min < -100 || max > 10_000) {
    throw new Error('Generated elevated package contains invalid elevation values');
  }
  return { min, max };
}

async function main() {
  const started = performance.now();
  const compressedBase = await fs.readFile(INPUT);
  const baseBytes = await gunzip(compressedBase);
  const baseNetwork = decodeBasePackage(baseBytes);
  const tagIndexByKey = new Map();
  const tags = [];
  baseNetwork.ways.forEach((way) => {
    const key = JSON.stringify(Object.entries(way.tags).sort(([a], [b]) => a.localeCompare(b)));
    if (!tagIndexByKey.has(key)) {
      tagIndexByKey.set(key, tags.length);
      tags.push(way.tags);
    }
    way.tagIndex = tagIndexByKey.get(key);
  });
  const { elevations, tileCount } = await addNodeElevations(baseNetwork.nodes);
  baseNetwork.tags = tags;
  baseNetwork.tagIndexes = baseNetwork.ways.map((way) => way.tagIndex);
  const packageBytes = buildElevatedPackage(baseNetwork, elevations);
  const range = verifyPackage(packageBytes, {
    nodes: baseNetwork.nodes.length,
    ways: baseNetwork.ways.length,
  });
  const compressed = await gzip(packageBytes, { level: 9, mtime: 0 });
  await fs.writeFile(OUTPUT, compressed);
  console.log(`Road nodes: ${baseNetwork.nodes.length.toLocaleString()}`);
  console.log(`Unique zoom-${ZOOM} DEM tiles sampled: ${tileCount.toLocaleString()}`);
  console.log(`Elevation range: ${range.min.toFixed(1)} to ${range.max.toFixed(1)} m`);
  console.log(`Package before gzip: ${packageBytes.length.toLocaleString()} bytes`);
  console.log(`Package download: ${compressed.length.toLocaleString()} bytes (${(compressed.length / 1048576).toFixed(2)} MiB)`);
  console.log(`Output: ${OUTPUT}`);
  console.log(`Elapsed: ${((performance.now() - started) / 1000).toFixed(1)} seconds`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
