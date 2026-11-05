export type OfflineRoutingPackage = {
  id: string;
  version: number;
  downloadedAt: number;
  nodes: [number, number, number, number][];
  ways: { nodes: number[]; tags: Record<string, string> }[];
};

const HEADER_SIZE = 52;
const WAY_SIZE = 10;

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && Object.values(value).every((item) => typeof item === 'string');
}

export async function decodeNetworkPackage(
  compressed: Uint8Array,
  networkId: string,
  networkVersion: number,
): Promise<OfflineRoutingPackage> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unpack the offline road network');
  }
  const compressedBuffer = new ArrayBuffer(compressed.byteLength);
  new Uint8Array(compressedBuffer).set(compressed);
  const stream = new Response(compressedBuffer).body;
  if (!stream) throw new Error('Unable to read the offline road network package');
  const packageBytes = new Uint8Array(await new Response(
    stream.pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer());
  if (packageBytes.byteLength < HEADER_SIZE) {
    throw new Error('Offline road network package is incomplete');
  }

  const view = new DataView(packageBytes.buffer, packageBytes.byteOffset, packageBytes.byteLength);
  const magic = String.fromCharCode(...packageBytes.subarray(0, 4));
  const formatVersion = view.getUint16(4, true);
  const headerSize = view.getUint16(6, true);
  const nodeCount = view.getUint32(8, true);
  const wayCount = view.getUint32(12, true);
  const referenceCount = view.getUint32(16, true);
  const tagCount = view.getUint32(20, true);
  const coordinateSize = view.getUint32(24, true);
  const elevationSize = view.getUint32(28, true);
  const waySize = view.getUint32(32, true);
  const referenceSize = view.getUint32(36, true);
  const tagSize = view.getUint32(40, true);
  const downloadedAt = Number(view.getBigUint64(44, true));
  const totalSize = headerSize + coordinateSize + elevationSize + waySize + referenceSize + tagSize;
  if (
    magic !== 'HKRT'
    || formatVersion !== 2
    || headerSize !== HEADER_SIZE
    || elevationSize !== nodeCount * 2
    || waySize !== wayCount * WAY_SIZE
    || totalSize !== packageBytes.byteLength
    || !nodeCount
    || !wayCount
    || !Number.isSafeInteger(downloadedAt)
  ) {
    throw new Error('Offline road network package has an invalid header');
  }

  const readSignedVarint = (cursor: { offset: number }) => {
    let value = 0;
    let shift = 0;
    while (true) {
      if (cursor.offset >= packageBytes.length || shift > 63) {
        throw new Error('Offline road network package contains an invalid coordinate');
      }
      const byte = packageBytes[cursor.offset++];
      value += (byte & 0x7f) * (2 ** shift);
      if (byte < 0x80) break;
      shift += 7;
    }
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  };

  const coordinates: [number, number][] = new Array(nodeCount);
  const coordinateEnd = headerSize + coordinateSize;
  const coordinateCursor = { offset: headerSize };
  let longitude = 0;
  let latitude = 0;
  for (let index = 0; index < nodeCount; index++) {
    longitude += readSignedVarint(coordinateCursor);
    latitude += readSignedVarint(coordinateCursor);
    if (
      coordinateCursor.offset > coordinateEnd
      || Math.abs(longitude) > 1_800_000_000
      || Math.abs(latitude) > 900_000_000
    ) {
      throw new Error('Offline road network package contains invalid coordinates');
    }
    coordinates[index] = [longitude / 10_000_000, latitude / 10_000_000];
  }
  if (coordinateCursor.offset !== coordinateEnd) {
    throw new Error('Offline road network package coordinate data is invalid');
  }

  const elevationsStart = coordinateEnd;
  const waysStart = elevationsStart + elevationSize;
  const nodes: OfflineRoutingPackage['nodes'] = coordinates.map(([longitude, latitude], index) => [
    index,
    longitude,
    latitude,
    view.getInt16(elevationsStart + index * 2, true) / 10,
  ]);
  const referencesStart = waysStart + waySize;
  const referencesEnd = referencesStart + referenceSize;
  const tagsStart = referencesEnd;
  const tagTable: unknown = JSON.parse(new TextDecoder().decode(
    packageBytes.subarray(tagsStart, tagsStart + tagSize),
  ));
  if (!Array.isArray(tagTable) || tagTable.length !== tagCount) {
    throw new Error('Offline road network package tags are invalid');
  }

  const ways: OfflineRoutingPackage['ways'] = new Array(wayCount);
  const referenceCursor = { offset: referencesStart };
  let expectedReferenceOffset = 0;
  for (let index = 0; index < wayCount; index++) {
    const descriptorOffset = waysStart + (index * WAY_SIZE);
    const offset = view.getUint32(descriptorOffset, true);
    const count = view.getUint32(descriptorOffset + 4, true);
    const tagIndex = view.getUint16(descriptorOffset + 8, true);
    if (
      offset !== expectedReferenceOffset
      || count < 2
      || tagIndex >= tagCount
      || count > referenceCount - expectedReferenceOffset
    ) {
      throw new Error('Offline road network package contains an invalid way');
    }
    const references = new Array<number>(count);
    let previous = 0;
    for (let referenceIndex = 0; referenceIndex < count; referenceIndex++) {
      previous += readSignedVarint(referenceCursor);
      if (previous < 0 || previous >= nodeCount || referenceCursor.offset > referencesEnd) {
        throw new Error('Offline road network package contains an invalid node reference');
      }
      references[referenceIndex] = previous;
    }
    const tags = tagTable[tagIndex];
    if (!isStringRecord(tags) || typeof tags.highway !== 'string') {
      throw new Error('Offline road network package contains invalid road tags');
    }
    ways[index] = { nodes: references, tags };
    expectedReferenceOffset += count;
  }
  if (referenceCursor.offset !== referencesEnd || expectedReferenceOffset !== referenceCount) {
    throw new Error('Offline road network package reference data is invalid');
  }

  return { id: networkId, version: networkVersion, downloadedAt, nodes, ways };
}
