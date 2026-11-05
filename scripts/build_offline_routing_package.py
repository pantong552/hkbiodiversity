import gzip
import json
import math
import pathlib
import struct
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "offline-routing" / "hong-kong-v1.bin"
BOUNDS = (22.15, 113.75, 22.58, 114.52)
TAGS = {
    "highway",
    "access",
    "foot",
    "bicycle",
    "foot:access",
    "bicycle:access",
    "oneway",
    "oneway:foot",
    "oneway:bicycle",
    "junction",
    "surface",
    "smoothness",
    "sac_scale",
    "cycleway",
    "bicycle:dismount",
}
HEADER = struct.Struct("<4sHHIIIIIIIIQ")
WAY = struct.Struct("<IIH")


def fetch_osm():
    south, west, north, east = BOUNDS
    query = (
        "[out:json][timeout:180];"
        f'way["highway"]({south},{west},{north},{east});'
        "out body;>;out skel qt;"
    )
    errors = []
    for endpoint in (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ):
        for attempt in range(3):
            request = urllib.request.Request(
                endpoint,
                data=urllib.parse.urlencode({"data": query}).encode(),
                headers={
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "User-Agent": "HongKongBiodiversityMap/1.0",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=240) as response:
                    if response.status != 200:
                        raise RuntimeError(f"Overpass returned HTTP {response.status}")
                    return response.read()
            except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
                errors.append(f"{endpoint} (attempt {attempt + 1}): {error}")
                if attempt < 2:
                    time.sleep(2**attempt)
    raise RuntimeError("All Overpass endpoints failed: " + "; ".join(errors))


def encode_signed_varint(value):
    value = (value << 1) ^ (value >> 63)
    encoded = bytearray()
    while value > 0x7F:
        encoded.append((value & 0x7F) | 0x80)
        value >>= 7
    encoded.append(value)
    return encoded


def decode_signed_varint(data, offset):
    value = 0
    shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            break
        shift += 7
        if shift > 63:
            raise ValueError("Invalid varint in generated package")
    return (value >> 1) ^ -(value & 1), offset


def build_payload(raw):
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
        raise ValueError("Overpass response does not contain an elements array")

    nodes_by_id = {}
    source_ways = []
    for element in data["elements"]:
        if not isinstance(element, dict) or not isinstance(element.get("id"), int):
            continue
        if (
            element.get("type") == "node"
            and isinstance(element.get("lon"), (int, float))
            and isinstance(element.get("lat"), (int, float))
            and math.isfinite(element["lon"])
            and math.isfinite(element["lat"])
        ):
            nodes_by_id[element["id"]] = (element["lon"], element["lat"])
        elif (
            element.get("type") == "way"
            and isinstance(element.get("nodes"), list)
            and len(element["nodes"]) > 1
            and isinstance(element.get("tags"), dict)
            and isinstance(element["tags"].get("highway"), str)
        ):
            tags = {
                key: value
                for key, value in element["tags"].items()
                if key in TAGS and isinstance(value, str)
            }
            source_ways.append((element["nodes"], tags))

    used_node_ids = []
    node_indexes = {}
    for refs, _ in source_ways:
        for node_id in refs:
            if node_id in nodes_by_id and node_id not in node_indexes:
                node_indexes[node_id] = len(used_node_ids)
                used_node_ids.append(node_id)
    if not used_node_ids:
        raise ValueError("No routable Hong Kong roads were present in the response")

    coordinates = bytearray()
    last_longitude = 0
    last_latitude = 0
    for node_id in used_node_ids:
        longitude, latitude = nodes_by_id[node_id]
        longitude = round(longitude * 10_000_000)
        latitude = round(latitude * 10_000_000)
        coordinates.extend(encode_signed_varint(longitude - last_longitude))
        coordinates.extend(encode_signed_varint(latitude - last_latitude))
        last_longitude = longitude
        last_latitude = latitude

    tag_indexes = {}
    tag_table = []
    way_rows = bytearray()
    references = bytearray()
    reference_count = 0
    way_count = 0
    for refs, tags in source_ways:
        indexes = [node_indexes[node_id] for node_id in refs if node_id in node_indexes]
        if len(indexes) < 2:
            continue
        tag_key = tuple(sorted(tags.items()))
        tag_index = tag_indexes.get(tag_key)
        if tag_index is None:
            tag_index = len(tag_table)
            if tag_index > 0xFFFF:
                raise ValueError("Too many distinct road tag combinations")
            tag_indexes[tag_key] = tag_index
            tag_table.append(dict(tag_key))

        way_rows.extend(WAY.pack(reference_count, len(indexes), tag_index))
        previous = 0
        for node_index in indexes:
            references.extend(encode_signed_varint(node_index - previous))
            previous = node_index
        reference_count += len(indexes)
        way_count += 1

    tag_bytes = json.dumps(
        tag_table, separators=(",", ":"), ensure_ascii=True
    ).encode()
    timestamp = int(time.time() * 1000)
    header = HEADER.pack(
        b"HKRT",
        1,
        HEADER.size,
        len(used_node_ids),
        way_count,
        reference_count,
        len(tag_table),
        len(coordinates),
        len(way_rows),
        len(references),
        len(tag_bytes),
        timestamp,
    )
    return (
        header + coordinates + way_rows + references + tag_bytes,
        len(used_node_ids),
        way_count,
        reference_count,
    )


def verify_package(package, expected_counts):
    (
        magic,
        version,
        header_size,
        node_count,
        way_count,
        reference_count,
        tag_count,
        coordinate_size,
        way_size,
        reference_size,
        tag_size,
        _,
    ) = HEADER.unpack_from(package)
    if magic != b"HKRT" or version != 1 or header_size != HEADER.size:
        raise ValueError("Generated package header failed validation")
    if (node_count, way_count, reference_count) != expected_counts:
        raise ValueError("Generated package counts do not match the source data")
    if way_size != way_count * WAY.size:
        raise ValueError("Generated package way table has an invalid size")
    if HEADER.size + coordinate_size + way_size + reference_size + tag_size != len(package):
        raise ValueError("Generated package sections do not match its total size")

    coordinates_end = HEADER.size + coordinate_size
    offset = HEADER.size
    longitude = 0
    latitude = 0
    for _ in range(node_count):
        delta, offset = decode_signed_varint(package, offset)
        longitude += delta
        delta, offset = decode_signed_varint(package, offset)
        latitude += delta
        if not (-1_800_000_000 <= longitude <= 1_800_000_000):
            raise ValueError("Generated package contains an invalid longitude")
        if not (-900_000_000 <= latitude <= 900_000_000):
            raise ValueError("Generated package contains an invalid latitude")
    if offset != coordinates_end:
        raise ValueError("Generated package coordinate section failed validation")

    ways_offset = coordinates_end
    refs_start = ways_offset + way_size
    refs_end = refs_start + reference_size
    tags_start = refs_end
    tags = json.loads(package[tags_start : tags_start + tag_size])
    if len(tags) != tag_count:
        raise ValueError("Generated package tag table failed validation")

    expected_offset = 0
    refs_offset = refs_start
    for way_index in range(way_count):
        reference_offset, count, tag_index = WAY.unpack_from(
            package, ways_offset + way_index * WAY.size
        )
        if reference_offset != expected_offset or count < 2 or tag_index >= tag_count:
            raise ValueError("Generated package way table failed validation")
        previous = 0
        for _ in range(count):
            delta, refs_offset = decode_signed_varint(package, refs_offset)
            previous += delta
            if not (0 <= previous < node_count):
                raise ValueError("Generated package contains an invalid node reference")
        expected_offset += count
    if refs_offset != refs_end or expected_offset != reference_count:
        raise ValueError("Generated package reference section failed validation")


def main():
    started = time.perf_counter()
    raw = fetch_osm()
    package, node_count, way_count, reference_count = build_payload(raw)
    expected_counts = (node_count, way_count, reference_count)
    verify_package(package, expected_counts)
    compressed = gzip.compress(package, compresslevel=9, mtime=0)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(compressed)
    print(f"Source Overpass JSON: {len(raw):,} bytes ({len(raw) / 1048576:.2f} MiB)")
    print(f"Package before gzip: {len(package):,} bytes ({len(package) / 1048576:.2f} MiB)")
    print(f"Package download: {len(compressed):,} bytes ({len(compressed) / 1048576:.2f} MiB)")
    print(f"Nodes: {node_count:,}; ways: {way_count:,}; node references: {reference_count:,}")
    print(f"Validated package written to {OUTPUT}")
    print(f"Elapsed: {time.perf_counter() - started:.1f} seconds")


if __name__ == "__main__":
    main()
