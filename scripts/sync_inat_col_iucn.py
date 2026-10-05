"""Sync iNaturalist taxonomy, then fetch matching COL and IUCN data.

Place CSV files containing a ``scientific_name`` column in ``database/input``.
Results are written to ``database/output``. The iNaturalist accepted name is
used for both the COL and IUCN lookups.
"""

import glob
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from tqdm import tqdm
from urllib3.util.retry import Retry


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
load_dotenv(PROJECT_DIR / ".env.local")

INAT_BASE_URL = "https://api.inaturalist.org/v2"
COL_BASE_URL = "https://api.checklistbank.org"
COL_DATASET_KEY = "314965"
IUCN_TOKEN = os.getenv("IUCN_API_TOKEN")

IUCN_MAP = {
    "EX": "Extinct",
    "EW": "Extinct in the Wild",
    "CR": "Critically Endangered",
    "EN": "Endangered",
    "VU": "Vulnerable",
    "NT": "Near Threatened",
    "LC": "Least Concern",
    "DD": "Data Deficient",
    "NE": "Not Evaluated",
    "RE": "Regionally Extinct",
    "NA": "Not Applicable",
    "LR/lc": "Least Concern (Old)",
    "LR/nt": "Near Threatened (Old)",
    "LR/cd": "Conservation Dependent",
}

TARGET_RANKS = {
    "phylum": "phylum",
    "class": "class",
    "order": "order",
    "family": "family",
    "genus": "genus",
    "species": "species",
    "subspecies": "sub_species",
}

COL_COLUMNS = [
    "scientific_name_col",
    "usage_id",
    "Synonyms",
    "Author",
    "Phylum",
    "Class",
    "Order",
    "Family",
    "Genus",
    "remark",
]


def create_col_session():
    session = requests.Session()
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


COL_SESSION = create_col_session()


def clean_scientific_name(name):
    """Remove database suffixes and author/year notes from a name."""
    if not name or pd.isna(name):
        return ""
    name = re.sub(r"_\d+$", "", str(name))
    name = re.sub(r"\s*\([^)]*\)", "", name)
    name = re.sub(r"\s*,?\s*\d{4}$", "", name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in {"ssp.", "subsp.", "var."}:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()


def get_inat_json(url, params=None):
    response = requests.get(url, params=params, timeout=20)
    if response.status_code == 429 or response.status_code >= 500:
        for attempt in range(3):
            tqdm.write(f"  iNaturalist 暫時無法回應，重試中 ({attempt + 1}/3)...")
            time.sleep(2 ** attempt)
            response = requests.get(url, params=params, timeout=20)
            if response.status_code != 429 and response.status_code < 500:
                break
    response.raise_for_status()
    return response.json()


def fetch_inat_taxon_id(scientific_name):
    query_name = clean_scientific_name(scientific_name)
    if not query_name:
        return None, None

    data = get_inat_json(
        f"{INAT_BASE_URL}/taxa/autocomplete",
        params={
            "q": query_name,
            "per_page": 10,
            "fields": "(id:!t,name:!t,matched_term:!t)",
        },
    )
    for item in data.get("results", []):
        target_name = item.get("name", "")
        matched_name = item.get("matched_term", "")
        if target_name.lower() == query_name.lower() or matched_name.lower() == query_name.lower():
            return item.get("id"), target_name
    return None, None


def fetch_inat_taxonomy(taxon_id):
    fields = (
        "(name:!t,rank:!t,preferred_common_name:!t,"
        "ancestors:(name:!t,rank:!t,preferred_common_name:!t))"
    )
    main_node = None
    for locale in ["zh-HK", "zh-TW", "en"]:
        data = get_inat_json(
            f"{INAT_BASE_URL}/taxa/{taxon_id}",
            params={"fields": fields, "locale": locale},
        )
        results = data.get("results", [])
        if results and results[0].get("ancestors"):
            main_node = results[0]
            break

    if not main_node:
        return None, None

    nodes = main_node.get("ancestors", []) + [main_node]
    rank_map = {
        node.get("rank"): {
            "eng": node.get("name"),
            "chi": node.get("preferred_common_name"),
        }
        for node in nodes
        if node.get("rank")
    }

    for locale in ["zh-HK", "zh-TW"]:
        if all(value["chi"] for value in rank_map.values()):
            break
        data = get_inat_json(
            f"{INAT_BASE_URL}/taxa/{taxon_id}",
            params={
                "fields": (
                    "(ancestors:(rank:!t,preferred_common_name:!t),"
                    "preferred_common_name:!t)"
                ),
                "locale": locale,
            },
        )
        results = data.get("results", [])
        if not results:
            continue
        localized_nodes = results[0].get("ancestors", []) + [results[0]]
        for node in localized_nodes:
            rank = node.get("rank")
            if rank in rank_map and not rank_map[rank]["chi"]:
                rank_map[rank]["chi"] = node.get("preferred_common_name")

    return main_node.get("name"), rank_map


def fetch_col_synonyms(usage_id):
    response = COL_SESSION.get(
        f"{COL_BASE_URL}/dataset/{COL_DATASET_KEY}/taxon/{usage_id}/synonyms",
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    names = []
    for category in ["heterotypic", "homotypic", "misapplied"]:
        items = data.get(category, [])
        for item in items:
            for synonym in item if isinstance(item, list) else [item]:
                name_obj = synonym.get("name", {})
                if isinstance(name_obj, dict):
                    name = name_obj.get("scientificName", "")
                    if name:
                        names.append(name)
    return ",".join(dict.fromkeys(names))


def fetch_col_taxonomy(scientific_name):
    """Look up the iNaturalist name in COL and return its accepted taxon data."""
    data = {
        "scientific_name_col": "",
        "usage_id": "",
        "Synonyms": "",
        "Author": "",
        "Phylum": "",
        "Class": "",
        "Order": "",
        "Family": "",
        "Genus": "",
        "remark": "",
    }
    response = COL_SESSION.get(
        f"{COL_BASE_URL}/dataset/{COL_DATASET_KEY}/nameusage/search",
        params={"q": scientific_name, "type": "exact"},
        timeout=20,
    )
    response.raise_for_status()
    results = response.json().get("result", [])
    species_results = [
        result
        for result in results
        if result.get("usage", {}).get("name", {}).get("rank", "").lower()
        in {"species", "subspecies"}
    ]

    final_id = None
    for result in species_results:
        usage = result.get("usage", {})
        if usage.get("status") == "accepted":
            final_id = result.get("id")
            break
        if usage.get("status") in {"synonym", "ambiguous synonym"}:
            accepted = usage.get("accepted", {})
            if accepted:
                final_id = accepted.get("id")
                data["remark"] = (
                    f"Synonym of {accepted.get('label', '')} "
                    f"(usage id: {final_id})"
                )
                break

    if not final_id:
        data["remark"] = "Not Found"
        return data

    taxon_response = COL_SESSION.get(
        f"{COL_BASE_URL}/dataset/{COL_DATASET_KEY}/taxon/{final_id}",
        timeout=20,
    )
    taxon_response.raise_for_status()
    taxon_info = taxon_response.json()
    name_obj = taxon_info.get("name", {})
    data["scientific_name_col"] = name_obj.get("scientificName", "")
    data["usage_id"] = final_id
    data["Author"] = name_obj.get("authorship", "")

    classification_response = COL_SESSION.get(
        f"{COL_BASE_URL}/dataset/{COL_DATASET_KEY}/taxon/{final_id}/classification",
        timeout=20,
    )
    classification_response.raise_for_status()
    for item in classification_response.json():
        rank = item.get("rank", "").capitalize()
        if rank in {"Phylum", "Class", "Order", "Family", "Genus"}:
            data[rank] = item.get("name", "")

    data["Synonyms"] = fetch_col_synonyms(final_id)
    return data


def fetch_iucn_status(scientific_name):
    if not IUCN_TOKEN:
        return ""

    cleaned_name = clean_scientific_name(scientific_name)
    parts = cleaned_name.split()
    if len(parts) < 2:
        return ""

    params = {"genus_name": parts[0], "species_name": parts[1]}
    if len(parts) >= 4 and parts[2].lower() in {"ssp.", "subsp.", "var."}:
        params["infra_name"] = parts[3]
    elif len(parts) >= 3 and parts[2].lower() not in {"ssp.", "subsp.", "var."}:
        params["infra_name"] = parts[2]

    response = requests.get(
        "https://api.iucnredlist.org/api/v4/taxa/scientific_name",
        params=params,
        headers={"Authorization": f"Bearer {IUCN_TOKEN}", "Accept": "application/json"},
        timeout=20,
    )
    if response.status_code == 404:
        return ""
    response.raise_for_status()

    assessments = response.json().get("assessments", [])
    latest = next((assessment for assessment in assessments if assessment.get("latest")), None)
    if not latest:
        return ""
    code = latest.get("red_list_category_code")
    return IUCN_MAP.get(code, code or "")


def process_species(row):
    """Run the lookups in order: iNaturalist, then COL and IUCN."""
    result = row.copy()
    original_name = str(row.get("scientific_name", "")).replace("\xa0", " ").strip()
    for column in COL_COLUMNS:
        result[column] = ""
    result["iucn"] = ""
    result["iucn_remark"] = ""

    if not original_name or original_name.lower() == "nan":
        result["remark"] = "Empty Scientific Name"
        return result

    try:
        existing_id = row.get("species_id")
        taxon_id = None
        inat_name = None
        if pd.notna(existing_id) and str(existing_id).strip():
            try:
                taxon_id = int(float(existing_id))
            except (TypeError, ValueError, OverflowError):
                taxon_id = None

        if taxon_id:
            inat_name, inat_taxonomy = fetch_inat_taxonomy(taxon_id)
        else:
            taxon_id, inat_name = fetch_inat_taxon_id(original_name)
            inat_taxonomy = None
            if taxon_id:
                inat_name, inat_taxonomy = fetch_inat_taxonomy(taxon_id)

        if not taxon_id or not inat_name:
            result["remark"] = "iNaturalist taxon not found; COL and IUCN lookups skipped"
            return result

        result["species_id"] = taxon_id
        result["scientific_name"] = inat_name
        if inat_taxonomy:
            for rank, column_prefix in TARGET_RANKS.items():
                rank_data = inat_taxonomy.get(rank)
                if rank_data:
                    result[f"{column_prefix}_eng"] = rank_data.get("eng")
                    result[f"{column_prefix}_chi"] = rank_data.get("chi")

        if clean_scientific_name(original_name).lower() != clean_scientific_name(inat_name).lower():
            note_eng = (
                f"Taxonomic Update: The scientific name has been revised from "
                f"{original_name} to {inat_name} following iNaturalist."
            )
            note_chi = f"分類更新：根據 iNaturalist 分類標準，學名已從 {original_name} 修訂為 {inat_name}。"
            for column, note in [("remarks_eng", note_eng), ("remarks_chi", note_chi)]:
                previous = result.get(column)
                if pd.isna(previous) or not str(previous).strip():
                    result[column] = note
                elif note not in str(previous):
                    result[column] = f"{previous}\n{note}"

        try:
            result.update(fetch_col_taxonomy(inat_name))
        except requests.RequestException as error:
            result["remark"] = f"COL request failed: {error}"
        except (ValueError, KeyError, TypeError) as error:
            result["remark"] = f"COL response could not be processed: {error}"

        if IUCN_TOKEN:
            try:
                result["iucn"] = fetch_iucn_status(inat_name)
            except requests.RequestException as error:
                result["iucn_remark"] = f"Request failed: {error}"
                tqdm.write(f"  IUCN 查詢失敗 ({inat_name}): {error}")
        else:
            result["iucn_remark"] = "Skipped: IUCN_API_TOKEN not configured"

    except requests.RequestException as error:
        result["remark"] = f"iNaturalist request failed: {error}"
    except (ValueError, KeyError, TypeError) as error:
        result["remark"] = f"iNaturalist response could not be processed: {error}"

    return result


def process_file(input_path, output_dir):
    input_path = Path(input_path)
    output_path = Path(output_dir) / (
        f"{input_path.stem}_{datetime.now().strftime('%Y%m%d_%H%M')}{input_path.suffix}"
    )
    tqdm.write(f"\n>>> 正在處理檔案: {input_path.name}")

    try:
        dataframe = pd.read_csv(input_path, encoding="utf-8-sig")
    except UnicodeDecodeError:
        dataframe = pd.read_csv(input_path, encoding="utf-8", encoding_errors="replace")

    if "scientific_name" not in dataframe.columns:
        raise ValueError(f"{input_path.name} 找不到 'scientific_name' 欄位")

    if "species_id" not in dataframe.columns:
        dataframe.insert(1, "species_id", None)
    for rank_column in TARGET_RANKS.values():
        for suffix in ["_eng", "_chi"]:
            column = f"{rank_column}{suffix}"
            if column not in dataframe.columns:
                dataframe[column] = None
    for column in ["remarks_eng", "remarks_chi", "iucn", "iucn_remark", *COL_COLUMNS]:
        if column not in dataframe.columns:
            dataframe[column] = None

    output_rows = []
    for _, row in tqdm(dataframe.iterrows(), total=len(dataframe), desc=input_path.name, unit="sp"):
        output_rows.append(process_species(row))

    output = pd.DataFrame(output_rows, columns=dataframe.columns)
    output["species_id"] = pd.to_numeric(output["species_id"], errors="coerce").astype("Int64")
    output.to_csv(output_path, index=False, encoding="utf-8-sig")
    tqdm.write(f"  完成！輸出至: {output_path}")


def main():
    input_dir = PROJECT_DIR / "database" / "input"
    output_dir = PROJECT_DIR / "database" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    csv_files = glob.glob(str(input_dir / "*.csv"))
    if not csv_files:
        print(f"找不到 CSV 檔案: {input_dir}")
        return

    if not IUCN_TOKEN:
        print("注意：未設定 IUCN_API_TOKEN，將略過 IUCN 查詢。")

    print(f"找到 {len(csv_files)} 個檔案；處理完成後輸出至 {output_dir}")
    for csv_file in csv_files:
        process_file(csv_file, output_dir)

    print("\n所有任務已完成。")


if __name__ == "__main__":
    if sys.platform == "win32":
        import io

        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
