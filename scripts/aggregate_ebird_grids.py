#!/usr/bin/env python3
"""Aggregate eBird point coordinates into Common 1 km grid counts."""

from __future__ import annotations

import argparse
import csv
import json
import math
import bisect
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT / "database/ebird"
DEFAULT_GRID = ROOT / "public/data/Common_1km_grid.geojson"
DEFAULT_OUTPUT = ROOT / "database/ebird/ebird_species_summary_grid.csv"

# Run from the repository root: python scripts/aggregate_ebird_grids.py
# By default all source CSV files in database/ebird are merged. Pass --input
# to process one source file, or --input-dir to select another directory.


def load_grids(path: Path) -> list[dict[str, Any]]:
    collection = json.loads(path.read_text(encoding="utf-8"))
    grids = [
        {"grid_no": str(feature["properties"]["grid_no"]), "geometry": feature["geometry"]}
        for feature in collection["features"]
        if feature.get("properties", {}).get("grid_no") is not None
    ]
    if not grids:
        raise ValueError(f"No grid features with properties.grid_no in {path}")
    return grids


def point_on_segment(lon: float, lat: float, a: list[float], b: list[float]) -> bool:
    cross = (lon - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0])
    if abs(cross) > 1e-10:
        return False
    return min(a[0], b[0]) - 1e-10 <= lon <= max(a[0], b[0]) + 1e-10 and min(a[1], b[1]) - 1e-10 <= lat <= max(a[1], b[1]) + 1e-10


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    for index, a in enumerate(ring):
        b = ring[(index + 1) % len(ring)]
        if point_on_segment(lon, lat, a, b):
            return True
        if (a[1] > lat) != (b[1] > lat):
            crossing_lon = (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]
            if lon < crossing_lon:
                inside = not inside
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    geometry_type = geometry["type"]
    polygons = [geometry["coordinates"]] if geometry_type == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if not any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            return True
    return False


def grid_for_point(lon: float, lat: float, grids: list[dict[str, Any]]) -> str | None:
    # Source feature order is the deterministic tie-break for shared boundaries.
    candidate_ids = set()
    min_lat, max_lat = lat - 0.02, lat + 0.02
    first = bisect.bisect_left(_GRID_MIN_LATS, min_lat)
    last = bisect.bisect_right(_GRID_MIN_LATS, max_lat)
    for _, index in _GRID_LAT_INDEX[first:last]:
        candidate_ids.add(index)
    for index in sorted(candidate_ids):
        grid = grids[index]
        if point_in_geometry(lon, lat, grid["geometry"]):
            return grid["grid_no"]
    return None


_GRID_LAT_INDEX: list[tuple[float, int]] = []
_GRID_MIN_LATS: list[float] = []


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Process one source CSV instead of a directory")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--grid", type=Path, default=DEFAULT_GRID)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    grids = load_grids(args.grid)
    for index, grid in enumerate(grids):
        geometry = grid["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        min_lat = min(point[1] for polygon in polygons for ring in polygon for point in ring)
        _GRID_LAT_INDEX.append((min_lat, index))
    _GRID_LAT_INDEX.sort()
    _GRID_MIN_LATS.extend(item[0] for item in _GRID_LAT_INDEX)
    csv.field_size_limit(100_000_000)
    processed = 0
    unassigned = 0
    latest_rows: dict[str, dict[str, str]] = {}
    args.output.parent.mkdir(parents=True, exist_ok=True)

    input_files = [args.input] if args.input else sorted(args.input_dir.glob("*.csv"))
    input_files = [path for path in input_files if path.resolve() != args.output.resolve()]
    if not input_files:
        raise FileNotFoundError(f"No source CSV files found in {args.input_dir}")

    fieldnames: list[str] | None = None
    for input_path in input_files:
        with input_path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            if not reader.fieldnames or "points_json" not in reader.fieldnames:
                raise ValueError(f"{input_path} must contain a points_json column")
            candidate_fields = [name for name in reader.fieldnames if name not in {"points_json", "grid_json"}]
            if fieldnames is None:
                fieldnames = candidate_fields
            elif candidate_fields != fieldnames:
                raise ValueError(f"CSV columns do not match in {input_path}")

            for row_number, row in enumerate(reader, start=2):
                species_code = (row.get("species_code") or "").strip()
                if not species_code:
                    raise ValueError(f"Missing species_code at {input_path} row {row_number}")
                # If a source batch repeats a species, keep its most recently updated summary.
                existing = latest_rows.get(species_code)
                if existing and (existing.get("updated_at") or "") > (row.get("updated_at") or ""):
                    continue
                latest_rows[species_code] = row

    assert fieldnames is not None
    fieldnames.append("grid_json")

    with args.output.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        for row in latest_rows.values():
            species_code = row.get("species_code", "?")
            try:
                point_records = json.loads(row.get("points_json") or "[]")
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid points_json for species {species_code}: {exc}") from exc

            counts: dict[str, int] = {}
            for record in point_records:
                try:
                    lon, lat = float(record["x"]), float(record["y"])
                except (KeyError, TypeError, ValueError):
                    unassigned += 1
                    continue
                if not math.isfinite(lon) or not math.isfinite(lat):
                    unassigned += 1
                    continue
                grid_no = grid_for_point(lon, lat, grids)
                if grid_no is None:
                    unassigned += 1
                else:
                    counts[grid_no] = counts.get(grid_no, 0) + 1
                    processed += 1

            output_row = {key: value for key, value in row.items() if key in fieldnames and key != "grid_json"}
            output_row["grid_json"] = json.dumps(counts, ensure_ascii=False, separators=(",", ":"))
            writer.writerow(output_row)

    print(f"Read {len(input_files)} input files; retained {len(latest_rows)} unique species")
    print(f"Wrote {args.output}")
    print(f"Assigned point records: {processed}; unassigned/invalid: {unassigned}")


if __name__ == "__main__":
    main()
