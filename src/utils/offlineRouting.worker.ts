import { decodeNetworkPackage } from './offlineRoutingPackage';

type RoutePoint = [number, number];
type RouteCoordinate = [number, number, number];
type RouteProfile = 'foot' | 'bike';
type StoredNode = [number, number, number];
type StoredWay = { nodes: number[]; tags: Record<string, string> };
type StoredNetwork = {
  id: string;
  version: number;
  downloadedAt: number;
  nodes: StoredNode[];
  ways: StoredWay[];
};
type StoredNetworkMetadata = {
  id: string;
  version: number;
  elevationZoom: number;
  downloadedAt: number;
};
type StoredNetworkPackage = {
  id: string;
  version: number;
  downloadedAt: number;
  blob: Blob;
};
type StoredElevationTile = { id: string; blob: Blob };
type RequestMessage =
  | { id: number; type: 'check' }
  | { id: number; type: 'download'; forceNetwork?: boolean }
  | {
    id: number;
    type: 'route';
    points: RoutePoint[];
    profile: RouteProfile;
    allowPrivateRoads: boolean;
  };
type ResponseMessage =
  | { id: number; type: 'status'; available: boolean; downloadedAt: number | null }
  | {
    id: number;
    type: 'download-progress';
    progress: number | null;
    attempt?: number;
    maxAttempts?: number;
  }
  | { id: number; type: 'downloaded'; downloadedAt: number }
  | { id: number; type: 'route'; coordinates: RouteCoordinate[] }
  | { id: number; type: 'error'; error: string };
type GraphEdge = { to: number; cost: number };
type RoutingGraph = {
  coordinates: RoutePoint[];
  edges: GraphEdge[][];
  incoming: Uint8Array;
  outgoing: Uint8Array;
};

const DATABASE_NAME = 'hkbiodiversity-offline-routing';
const DATABASE_VERSION = 1;
const NETWORK_ID = 'hong-kong-osm-roads';
const NETWORK_VERSION = 3;
const ELEVATION_ZOOM = 14;
const ELEVATION_TILE_PREFIX = `elevation-${ELEVATION_ZOOM}-`;
const HONG_KONG_BOUNDS = { west: 113.75, south: 22.15, east: 114.52, north: 22.58 };
const NETWORK_PACKAGE_URL = '/offline-routing/hong-kong-v1.bin';
const MAX_SNAP_DISTANCE_METERS = 500;
const MAX_DOWNLOAD_ATTEMPTS = 3;

let cachedGraph: RoutingGraph | null = null;
let cachedGraphKey: string | null = null;
let cachedNetwork: StoredNetwork | null = null;
const cachedElevationPixels = new Map<string, Uint8ClampedArray>();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('networks')) {
        request.result.createObjectStore('networks', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline routing storage'));
    request.onblocked = () => reject(new Error('Offline routing storage is blocked by another tab'));
  });
}

async function readNetwork(): Promise<StoredNetwork | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('networks', 'readonly')
        .objectStore('networks')
        .get(NETWORK_ID);
      request.onsuccess = () => {
        const result: unknown = request.result;
        if (
          isRecord(result)
          && result.version === NETWORK_VERSION
          && typeof result.downloadedAt === 'number'
          && result.blob instanceof Blob
        ) {
          void result.blob.arrayBuffer()
            .then((buffer) => decodeNetworkPackage(new Uint8Array(buffer), NETWORK_ID, NETWORK_VERSION))
            .then(resolve, reject);
          return;
        }
        resolve((result as StoredNetwork | undefined) ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to read offline routing data'));
    });
  } finally {
    database.close();
  }
}

async function readNetworkMetadata(): Promise<StoredNetworkMetadata | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('networks', 'readonly')
        .objectStore('networks')
        .get(`${NETWORK_ID}-metadata`);
      request.onsuccess = () => resolve((request.result as StoredNetworkMetadata | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Unable to read offline routing status'));
    });
  } finally {
    database.close();
  }
}

async function readElevationTiles(ids: string[]) {
  const database = await openDatabase();
  try {
    return await new Promise<StoredElevationTile[]>((resolve, reject) => {
      const request = database.transaction('networks', 'readonly')
        .objectStore('networks')
        .getAll(IDBKeyRange.bound(ELEVATION_TILE_PREFIX, `${ELEVATION_TILE_PREFIX}\uffff`));
      request.onsuccess = () => {
        const wantedIds = new Set(ids);
        const tiles = (request.result as unknown[]).filter((value): value is StoredElevationTile => (
          isRecord(value)
          && typeof value.id === 'string'
          && wantedIds.has(value.id)
          && value.blob instanceof Blob
        ));
        resolve(tiles);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to read offline elevation data'));
    });
  } finally {
    database.close();
  }
}

async function writeNetwork(
  network: StoredNetwork,
  elevationTiles: StoredElevationTile[],
  networkPackage?: Blob,
) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('networks', 'readwrite');
      const store = transaction.objectStore('networks');
      store.put(networkPackage
        ? {
          id: network.id,
          version: network.version,
          downloadedAt: network.downloadedAt,
          blob: networkPackage,
        } satisfies StoredNetworkPackage
        : network);
      store.put({
        id: `${NETWORK_ID}-metadata`,
        version: network.version,
        elevationZoom: ELEVATION_ZOOM,
        downloadedAt: network.downloadedAt,
      } satisfies StoredNetworkMetadata);
      elevationTiles.forEach((tile) => store.put(tile));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save offline routing data'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Unable to save offline routing data'));
    });
  } finally {
    database.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function downloadNetwork(id: number, forceNetwork: boolean) {
  let network: StoredNetwork | null = null;
  let networkPackage: Blob | undefined;
  if (!forceNetwork) {
    const savedNetwork = await readNetwork();
    if (savedNetwork?.version === NETWORK_VERSION) network = savedNetwork;
  }
  if (!network) {
    const downloaded = await fetchNetworkPackage(id, forceNetwork);
    network = downloaded.network;
    networkPackage = downloaded.blob;
  }
  const elevationTiles = await downloadElevationTiles(id);
  post({ id, type: 'download-progress', progress: 95 });
  post({ id, type: 'download-progress', progress: 97 });
  await writeNetwork(network, elevationTiles, networkPackage);
  cachedNetwork = network;
  cachedGraph = null;
  cachedGraphKey = null;
  cachedElevationPixels.clear();
  post({ id, type: 'downloaded', downloadedAt: network.downloadedAt });
}

function isRetryableDownloadError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) return true;
  return error instanceof Error
    && /^(OpenStreetMap|Elevation tile) download failed \((408|425|429|5\d\d)\)$/.test(error.message);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchNetworkPackage(id: number, forceNetwork: boolean) {
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    post({
      id,
      type: 'download-progress',
      progress: attempt === 1 ? 0 : null,
      attempt,
      maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
    });
    try {
      const response = await fetch(NETWORK_PACKAGE_URL, {
        cache: forceNetwork ? 'reload' : 'default',
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`OpenStreetMap download failed (${response.status})`);
      const compressed = await readResponseBytes(response, id, 70);
      post({ id, type: 'download-progress', progress: 70 });
      const network = await decodeNetworkPackage(compressed, NETWORK_ID, NETWORK_VERSION);
      const buffer = new ArrayBuffer(compressed.byteLength);
      new Uint8Array(buffer).set(compressed);
      return {
        network,
        blob: new Blob([buffer], { type: 'application/octet-stream' }),
      };
    } catch (error) {
      if (!isRetryableDownloadError(error) || attempt === MAX_DOWNLOAD_ATTEMPTS) throw error;
      await wait(1000 * (2 ** (attempt - 1)));
    }
  }
  throw new Error('OpenStreetMap package download failed after retries');
}

async function readResponseBytes(response: Response, id: number, progressEnd: number) {
  const totalBytes = Number(response.headers.get('content-length'));
  const total = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    post({
      id,
      type: 'download-progress',
      progress: total ? Math.min(progressEnd, Math.round((loaded / total) * progressEnd)) : null,
    });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}

function getElevationTileCoordinates() {
  const tileCount = 2 ** ELEVATION_ZOOM;
  const toTileX = (longitude: number) => Math.floor(((longitude + 180) / 360) * tileCount);
  const toTileY = (latitude: number) => {
    const radians = (latitude * Math.PI) / 180;
    return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * tileCount);
  };
  const tiles: { x: number; y: number }[] = [];
  for (let x = toTileX(HONG_KONG_BOUNDS.west); x <= toTileX(HONG_KONG_BOUNDS.east); x++) {
    for (let y = toTileY(HONG_KONG_BOUNDS.north); y <= toTileY(HONG_KONG_BOUNDS.south); y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

async function downloadElevationTiles(id: number) {
  const coordinates = getElevationTileCoordinates();
  const tiles: StoredElevationTile[] = new Array(coordinates.length);
  let nextIndex = 0;
  let completed = 0;
  const downloadNext = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= coordinates.length) return;
      const { x, y } = coordinates[index];
      const response = await fetchElevationTile(x, y, id);
      const blob = await response.blob();
      if (blob.size === 0 || !blob.type.includes('image/png')) {
        throw new Error(`Elevation tile ${x}/${y} returned invalid image data`);
      }
      tiles[index] = { id: `${ELEVATION_TILE_PREFIX}${x}-${y}`, blob };
      completed++;
      post({
        id,
        type: 'download-progress',
        progress: 70 + Math.round((completed / coordinates.length) * 24),
        attempt: 1,
        maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, coordinates.length) }, () => downloadNext()));
  return tiles;
}

async function fetchElevationTile(x: number, y: number, id: number) {
  const url = `/api/map/dem/aws/${ELEVATION_ZOOM}/${x}/${y}.png`;
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Elevation tile download failed (${response.status})`);
      return response;
    } catch (error) {
      if (!isRetryableDownloadError(error) || attempt === MAX_DOWNLOAD_ATTEMPTS) throw error;
      post({
        id,
        type: 'download-progress',
        progress: null,
        attempt: attempt + 1,
        maxAttempts: MAX_DOWNLOAD_ATTEMPTS,
      });
      await wait(1000 * (2 ** (attempt - 1)));
    }
  }
  throw new Error(`Elevation tile download failed for ${x}/${y}`);
}

function isRoutable(tags: Record<string, string>, profile: RouteProfile, allowPrivateRoads: boolean) {
  const highway = tags.highway;
  if (!highway || ['construction', 'proposed', 'raceway'].includes(highway)) return false;
  const forbiddenHighways = profile === 'foot'
    ? ['motorway', 'motorway_link', 'trunk', 'trunk_link']
    : ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'steps'];
  if (forbiddenHighways.includes(highway)) return false;

  const access = tags[`${profile}:access`] ?? tags[profile] ?? tags.access;
  if (access === 'no' || access === 'use_sidepath') return false;
  if (access === 'private' && !allowPrivateRoads) return false;
  if (
    profile === 'bike'
    && ['footway', 'pedestrian'].includes(highway)
    && !['yes', 'designated', 'permissive', 'dismount'].includes(tags.bicycle)
  ) return false;
  return true;
}

function getSpeed(tags: Record<string, string>, profile: RouteProfile) {
  if (profile === 'foot') {
    if (tags.highway === 'steps') return 0.65;
    if (tags.sac_scale === 'demanding_mountain_hiking') return 0.9;
    return 1.25;
  }
  if (tags['bicycle:dismount'] === 'yes' || tags.bicycle === 'dismount') return 1.1;
  if (tags.highway === 'cycleway') return 5.2;
  if (['path', 'track'].includes(tags.highway)) return 3.4;
  if (['primary', 'primary_link'].includes(tags.highway)) return 2.8;
  if (['secondary', 'secondary_link'].includes(tags.highway)) return 3.2;
  if (['tertiary', 'tertiary_link'].includes(tags.highway)) return 3.6;
  return 4.2;
}

function getSurfacePenalty(tags: Record<string, string>, profile: RouteProfile) {
  if (profile === 'foot') {
    return tags.highway === 'steps' ? 1.25 : 1;
  }
  if (['gravel', 'ground', 'dirt', 'unpaved', 'sand'].includes(tags.surface)) return 1.55;
  if (tags.smoothness === 'bad' || tags.smoothness === 'very_bad') return 1.35;
  return 1;
}

function shouldReverse(tags: Record<string, string>, profile: RouteProfile) {
  const direction = profile === 'foot'
    ? tags['oneway:foot'] ?? 'no'
    : tags['oneway:bicycle'] ?? tags.oneway ?? (tags.junction === 'roundabout' ? 'yes' : 'no');
  if (
    profile === 'bike'
    && tags.cycleway?.includes('opposite')
    && tags['oneway:bicycle'] !== 'yes'
  ) return false;
  return direction === '-1';
}

function isOneWay(tags: Record<string, string>, profile: RouteProfile) {
  const direction = profile === 'foot'
    ? tags['oneway:foot']
    : tags['oneway:bicycle'] ?? tags.oneway ?? (tags.junction === 'roundabout' ? 'yes' : undefined);
  if (profile === 'bike' && tags.cycleway?.includes('opposite') && direction !== 'yes') return false;
  return direction === 'yes' || direction === '1' || direction === '-1';
}

function distanceMeters(start: RoutePoint, end: RoutePoint) {
  const radians = Math.PI / 180;
  const latitude1 = start[1] * radians;
  const latitude2 = end[1] * radians;
  const latitudeDelta = (end[1] - start[1]) * radians;
  const longitudeDelta = (end[0] - start[0]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function buildGraph(network: StoredNetwork, profile: RouteProfile, allowPrivateRoads: boolean): RoutingGraph {
  const coordinates: RoutePoint[] = [];
  const nodeIndexById = new Map<number, number>();
  network.nodes.forEach(([id, longitude, latitude]) => {
    nodeIndexById.set(id, coordinates.length);
    coordinates.push([longitude, latitude]);
  });
  const edges: GraphEdge[][] = coordinates.map(() => []);
  const incoming = new Uint8Array(coordinates.length);
  const outgoing = new Uint8Array(coordinates.length);

  network.ways.forEach(({ nodes, tags }) => {
    if (!isRoutable(tags, profile, allowPrivateRoads)) return;
    const oneWay = isOneWay(tags, profile);
    const reverse = shouldReverse(tags, profile);
    const speed = getSpeed(tags, profile) / getSurfacePenalty(tags, profile);
    for (let index = 1; index < nodes.length; index++) {
      const from = nodeIndexById.get(nodes[index - 1]);
      const to = nodeIndexById.get(nodes[index]);
      if (from === undefined || to === undefined || from === to) continue;
      const distance = distanceMeters(coordinates[from], coordinates[to]);
      if (distance <= 0 || distance > 20_000) continue;
      const edge = { to: reverse ? from : to, cost: distance / speed };
      edges[reverse ? to : from].push(edge);
      outgoing[reverse ? to : from] = 1;
      incoming[edge.to] = 1;
      if (!oneWay) {
        const reverseEdge = { to: reverse ? to : from, cost: edge.cost };
        edges[reverse ? from : to].push(reverseEdge);
        outgoing[reverse ? from : to] = 1;
        incoming[reverseEdge.to] = 1;
      }
    }
  });

  return { coordinates, edges, incoming, outgoing };
}

async function getGraph(profile: RouteProfile, allowPrivateRoads: boolean) {
  const graphKey = `${profile}:${allowPrivateRoads}`;
  if (cachedGraph && cachedGraphKey === graphKey) return cachedGraph;

  const network = cachedNetwork ?? await readNetwork();
  if (!network || network.version !== NETWORK_VERSION) {
    throw new Error('Download the Hong Kong offline routing network first');
  }
  cachedNetwork = network;
  cachedGraph = buildGraph(network, profile, allowPrivateRoads);
  cachedGraphKey = graphKey;
  cachedNetwork = null;
  return cachedGraph;
}

function snapToNode(graph: RoutingGraph, point: RoutePoint, canStart: boolean, canEnd: boolean) {
  const latitudeScale = Math.cos((point[1] * Math.PI) / 180);
  let closestIndex = -1;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let index = 0; index < graph.coordinates.length; index++) {
    if (
      (canStart && !graph.outgoing[index])
      || (canEnd && !graph.incoming[index])
    ) continue;
    const coordinate = graph.coordinates[index];
    const longitudeDistance = (coordinate[0] - point[0]) * 111_320 * latitudeScale;
    const latitudeDistance = (coordinate[1] - point[1]) * 111_320;
    const distanceSquared = longitudeDistance ** 2 + latitudeDistance ** 2;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestIndex = index;
    }
  }
  if (closestIndex < 0 || closestDistanceSquared > MAX_SNAP_DISTANCE_METERS ** 2) {
    throw new Error('A waypoint is more than 500 m from the downloaded road network');
  }
  return closestIndex;
}

function searchRoute(graph: RoutingGraph, start: number, destination: number, profile: RouteProfile) {
  const count = graph.coordinates.length;
  const costs = new Float64Array(count);
  costs.fill(Number.POSITIVE_INFINITY);
  const previous = new Int32Array(count);
  previous.fill(-1);
  const closed = new Uint8Array(count);
  const heapNodes: number[] = [];
  const heapPriorities: number[] = [];
  const speed = profile === 'foot' ? 1.25 : 4.2;

  const heuristic = (node: number) => distanceMeters(
    graph.coordinates[node],
    graph.coordinates[destination],
  ) / speed;
  const push = (node: number, priority: number) => {
    let index = heapNodes.length;
    heapNodes.push(node);
    heapPriorities.push(priority);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heapPriorities[parent] <= priority) break;
      heapNodes[index] = heapNodes[parent];
      heapPriorities[index] = heapPriorities[parent];
      index = parent;
    }
    heapNodes[index] = node;
    heapPriorities[index] = priority;
  };
  const pop = () => {
    const node = heapNodes[0];
    const priority = heapPriorities[0];
    const lastNode = heapNodes.pop();
    const lastPriority = heapPriorities.pop();
    if (heapNodes.length > 0 && lastNode !== undefined && lastPriority !== undefined) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heapNodes.length) break;
        const child = right < heapNodes.length && heapPriorities[right] < heapPriorities[left] ? right : left;
        if (heapPriorities[child] >= lastPriority) break;
        heapNodes[index] = heapNodes[child];
        heapPriorities[index] = heapPriorities[child];
        index = child;
      }
      heapNodes[index] = lastNode;
      heapPriorities[index] = lastPriority;
    }
    return { node, priority };
  };

  costs[start] = 0;
  push(start, heuristic(start));
  while (heapNodes.length > 0) {
    const { node } = pop();
    if (closed[node]) continue;
    if (node === destination) break;
    closed[node] = 1;
    graph.edges[node].forEach((edge) => {
      if (closed[edge.to]) return;
      const candidate = costs[node] + edge.cost;
      if (candidate >= costs[edge.to]) return;
      costs[edge.to] = candidate;
      previous[edge.to] = node;
      push(edge.to, candidate + heuristic(edge.to));
    });
  }
  if (start !== destination && previous[destination] === -1) {
    throw new Error('No offline route connects these waypoints');
  }

  const path = [destination];
  let current = destination;
  while (current !== start) {
    current = previous[current];
    if (current < 0) throw new Error('No offline route connects these waypoints');
    path.push(current);
  }
  path.reverse();
  return path.map((index) => graph.coordinates[index]);
}

async function calculateRoute(
  points: RoutePoint[],
  profile: RouteProfile,
  allowPrivateRoads: boolean,
) {
  if (points.length < 2) throw new Error('Add at least two waypoints to calculate a route');
  const graph = await getGraph(profile, allowPrivateRoads);
  const snapped = points.map((point, index) => snapToNode(
    graph,
    point,
    index < points.length - 1,
    index > 0,
  ));
  const coordinates: RoutePoint[] = [];
  for (let index = 1; index < snapped.length; index++) {
    const segment = searchRoute(graph, snapped[index - 1], snapped[index], profile);
    if (index === 1) coordinates.push(points[index - 1]);
    coordinates.push(...segment, points[index]);
  }
  return addElevations(coordinates);
}

function getElevationTilePosition([longitude, latitude]: RoutePoint) {
  const tileCount = 2 ** ELEVATION_ZOOM;
  const x = ((longitude + 180) / 360) * tileCount;
  const radians = (latitude * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * tileCount;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return {
    id: `${ELEVATION_TILE_PREFIX}${tileX}-${tileY}`,
    pixelX: Math.min(255, (x - tileX) * 256),
    pixelY: Math.min(255, (y - tileY) * 256),
  };
}

function getPixelElevation(pixels: Uint8ClampedArray, x: number, y: number) {
  const offset = (y * 256 + x) * 4;
  return pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
}

function interpolatePixelElevation(pixels: Uint8ClampedArray, x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, 255);
  const y1 = Math.min(y0 + 1, 255);
  const fractionX = x - x0;
  const fractionY = y - y0;
  const top = getPixelElevation(pixels, x0, y0)
    + (getPixelElevation(pixels, x1, y0) - getPixelElevation(pixels, x0, y0)) * fractionX;
  const bottom = getPixelElevation(pixels, x0, y1)
    + (getPixelElevation(pixels, x1, y1) - getPixelElevation(pixels, x0, y1)) * fractionX;
  return top + (bottom - top) * fractionY;
}

async function decodeElevationTile(blob: Blob) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('This browser cannot read offline elevation tiles');
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Unable to read offline elevation tile');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  } finally {
    bitmap.close();
  }
}

async function addElevations(coordinates: RoutePoint[]): Promise<RouteCoordinate[]> {
  const positions = coordinates.map(getElevationTilePosition);
  const tileIds = [...new Set(positions.map((position) => position.id))];
  const missingIds = tileIds.filter((id) => !cachedElevationPixels.has(id));
  if (missingIds.length > 0) {
    const tiles = await readElevationTiles(missingIds);
    const tilesById = new Map(tiles.map((tile) => [tile.id, tile]));
    const missingTileId = missingIds.find((id) => !tilesById.has(id));
    if (missingTileId) {
      throw new Error('Offline elevation data is missing. Update the Hong Kong road network while online.');
    }
    await Promise.all(missingIds.map(async (id) => {
      const tile = tilesById.get(id);
      if (!tile) return;
      cachedElevationPixels.set(id, await decodeElevationTile(tile.blob));
    }));
  }

  return coordinates.map(([longitude, latitude], index) => {
    const position = positions[index];
    const pixels = cachedElevationPixels.get(position.id);
    if (!pixels) throw new Error('Unable to read offline elevation data');
    const elevation = interpolatePixelElevation(pixels, position.pixelX, position.pixelY);
    return [longitude, latitude, elevation];
  });
}

function post(message: ResponseMessage) {
  self.postMessage(message);
}

self.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
  const request = event.data;
  void (async () => {
    try {
      if (request.type === 'check') {
        const metadata = await readNetworkMetadata();
        const available = metadata?.version === NETWORK_VERSION
          && metadata.elevationZoom === ELEVATION_ZOOM;
        post({
          id: request.id,
          type: 'status',
          available,
          downloadedAt: available ? metadata.downloadedAt : null,
        });
      } else if (request.type === 'download') {
        post({ id: request.id, type: 'download-progress', progress: 0 });
        await downloadNetwork(request.id, request.forceNetwork ?? false);
      } else {
        const coordinates = await calculateRoute(
          request.points,
          request.profile,
          request.allowPrivateRoads,
        );
        post({ id: request.id, type: 'route', coordinates });
      }
    } catch (error) {
      post({
        id: request.id,
        type: 'error',
        error: error instanceof Error ? error.message : 'Offline routing failed',
      });
    }
  })();
});
