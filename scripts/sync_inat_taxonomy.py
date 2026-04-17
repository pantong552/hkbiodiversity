import pandas as pd
import requests
import re
import time
import argparse
import sys
import os
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from dotenv import load_dotenv

# 加載環境變數
load_dotenv(".env.local")
IUCN_TOKEN = os.getenv("IUCN_API_TOKEN")

# 強制控制台輸出為 UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# IUCN 保護等級映射表
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
    "LR/cd": "Conservation Dependent"
}

# 共享變數與鎖
df_lock = threading.Lock()
save_lock = threading.Lock()

def clean_scientific_name(name):
    """清理學名，移除括號、年份及資料庫內部後綴"""
    if not name or pd.isna(name): return ""
    name = str(name)
    name = re.sub(r'_\d+$', '', name)
    name = re.sub(r'\s*\([^)]*\)', '', name)
    name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def safe_request(url, params=None, headers=None, max_retries=3, timeout=15):
    """具備重試機制的通用請求函數"""
    for attempt in range(max_retries):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r
            elif r.status_code == 429:
                tqdm.write(f"  [限速中] 正在休眠 3 秒後重試 (第 {attempt+1} 次)...")
                time.sleep(3)
                continue
            elif r.status_code == 404:
                return None
            else:
                return None
        except Exception as e:
            time.sleep(1)
            continue
    return None

def fetch_inat_taxon_id(scientific_name):
    """從 iNat 獲取 Taxon ID 與正式名稱"""
    cleaned_name = clean_scientific_name(scientific_name)
    if not cleaned_name: return None, None
    url = "https://api.inaturalist.org/v2/taxa/autocomplete"
    params = {"q": cleaned_name, "per_page": 10, "fields": "(id:!t,name:!t,matched_term:!t)"}
    r = safe_request(url, params=params)
    if r:
        results = r.json().get("results", [])
        for item in results:
            target_name = item.get("name", "").lower()
            matched_name = item.get("matched_term", "").lower()
            if target_name == cleaned_name.lower() or matched_name == cleaned_name.lower():
                return item["id"], item.get("name")
    return None, None

def fetch_taxonomy_details(taxon_id):
    """獲取詳盡的 iNat 分類層級"""
    if not taxon_id: return None
    base_url = f"https://api.inaturalist.org/v2/taxa/{taxon_id}"
    fields = "(name:!t,rank:!t,preferred_common_name:!t,ancestors:(name:!t,rank:!t,preferred_common_name:!t))"
    locales = ["zh-HK", "zh-TW", "en"]
    main_node = None
    for loc in locales:
        params = {"fields": fields, "locale": loc}
        r = safe_request(base_url, params=params)
        if r:
            res = r.json().get("results", [])
            if res and res[0].get("ancestors"):
                main_node = res[0]; break
    if not main_node: return None
    nodes = main_node.get("ancestors", []) + [main_node]
    rank_map = {node.get("rank"): {"eng": node.get("name"), "chi": node.get("preferred_common_name")} for node in nodes}
    for loc in ["zh-HK", "zh-TW"]:
        if all(v["chi"] for v in rank_map.values()): break
        r = safe_request(base_url, params={"fields": "ancestors:(rank:!t,preferred_common_name:!t),preferred_common_name:!t", "locale": loc})
        if r:
            res = r.json().get("results", [])
            if res:
                alt_node = res[0]; alt_nodes = alt_node.get("ancestors", []) + [alt_node]
                for n in alt_nodes:
                    rk = n.get("rank")
                    if rk in rank_map and not rank_map[rk]["chi"]:
                        rank_map[rk]["chi"] = n.get("preferred_common_name")
    return rank_map

def fetch_iucn_status(scientific_name):
    """從 IUCN Red List API v4 獲取保護等級"""
    if not IUCN_TOKEN: return None
    cleaned_name = clean_scientific_name(scientific_name)
    parts = cleaned_name.split()
    if len(parts) < 2: return None
    params = {"genus_name": parts[0], "species_name": parts[1]}
    if len(parts) >= 4 and parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[3]
    elif len(parts) >= 3 and parts[2].lower() not in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[2]
    url = "https://api.iucnredlist.org/api/v4/taxa/scientific_name"
    headers = {"Authorization": f"Bearer {IUCN_TOKEN}", "Accept": "application/json"}
    r = safe_request(url, params=params, headers=headers)
    if r:
        data = r.json()
        assessments = data.get("assessments", [])
        latest = next((a for a in assessments if a.get("latest")), None)
        if latest:
            code = latest.get("red_list_category_code")
            return IUCN_MAP.get(code, code)
    return None

def process_species(index, row, target_ranks, mode):
    """處理單個物種 (根據模式執行抓取)"""
    old_sci_name = str(row['scientific_name']).strip()
    existing_id = row.get('species_id')
    results = {"taxon_id": None, "tax_data": None, "rename_info": None, "iucn": None}

    # 1. 處理 iNat Taxonomy
    if mode in [1, 2]:
        taxon_id = None
        real_official_name = None
        if not pd.isna(existing_id) and str(existing_id).strip():
            try:
                taxon_id = int(float(existing_id))
            except Exception: pass
        if not taxon_id:
            taxon_id, real_official_name = fetch_inat_taxon_id(old_sci_name)
        if taxon_id:
            results["taxon_id"] = taxon_id
            results["tax_data"] = fetch_taxonomy_details(taxon_id)
            if not real_official_name and results["tax_data"] and 'species' in results["tax_data"]:
                real_official_name = results["tax_data"]['species']['eng']
            if real_official_name and clean_scientific_name(real_official_name).lower() != clean_scientific_name(old_sci_name).lower():
                results["rename_info"] = {"old": old_sci_name, "new": real_official_name}

    # 2. 處理 IUCN Status
    if mode in [1, 3]:
        results["iucn"] = fetch_iucn_status(old_sci_name)

    return index, results

def main():
    print("\n" + "="*50)
    print("  Species Data Sync Pro (iNat + IUCN Red List)")
    print("="*50)
    print("1. Sync iNaturalist Taxonomy with IUCN Status")
    print("2. Sync iNaturalist Taxonomy only")
    print("3. Sync IUCN Status only")
    print("="*50)
    
    try:
        choice = input("Please select a mode (1-3) or 'q' to quit: ").strip().lower()
        if choice == 'q': return
        mode = int(choice)
        if mode not in [1, 2, 3]: raise ValueError
    except ValueError:
        print("Invalid choice. Exiting..."); return

    if (mode in [1, 3]) and not IUCN_TOKEN:
        print("\n[Warning] IUCN_API_TOKEN not found in .env.local.")
        if input("Continue without IUCN? (y/n): ").lower() != 'y': return

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="database/MarineFish.csv")
    parser.add_argument("--output", default="database/MarineFish_updated.csv")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()

    try:
        df = pd.read_csv(args.input, encoding='utf-8-sig')
    except Exception:
        df = pd.read_csv(args.input, encoding='utf-8', errors='replace')

    # 初始化欄位
    target_ranks = {"phylum": "phylum", "class": "class", "subclass": "sub_class", "order": "order", "suborder": "sub_order", "superfamily": "superfamily", "family": "family", "subfamily": "sub_family", "genus": "genus", "species": "species", "subspecies": "sub_species"}
    if mode in [1, 2]:
        for cp in target_ranks.values():
            for sf in ["_eng", "_chi"]:
                if sf == "_chi" and cp in ["species", "sub_species"]: continue
                cn = f"{cp}{sf}"
                if cn not in df.columns: df[cn] = None
                df[cn] = df[cn].astype(object)
        for cn in ["remarks_eng", "remarks_chi"]:
            if cn not in df.columns: df[cn] = None
            df[cn] = df[cn].astype(object)
        if "species_id" not in df.columns: df.insert(1, "species_id", None)
        df["species_id"] = pd.to_numeric(df["species_id"], errors='coerce')
    
    if mode in [1, 3]:
        if "iucn" not in df.columns: df["iucn"] = None
        df["iucn"] = df["iucn"].astype(object)

    # 任務分析
    tasks = []
    total_to_process = 5 if args.test else len(df)
    for index, row in df.iterrows():
        if len(tasks) >= total_to_process: break
        needs = False
        if mode == 1: needs = pd.isna(row.get('phylum_eng')) or pd.isna(row.get('iucn'))
        elif mode == 2: needs = pd.isna(row.get('phylum_eng'))
        elif mode == 3: needs = pd.isna(row.get('iucn'))
        if needs and not pd.isna(row.get('scientific_name')):
            tasks.append((index, row))

    if not tasks:
        print("Everything looks up to date.")
        return

    print(f"\nStarting Sync (Mode {mode}, Workers: {args.workers}): Processing {len(tasks)} items...")
    checkpoint_interval = 20
    processed_count = 0

    def save_df(dataframe, path):
        temp_df = dataframe.copy()
        if "species_id" in temp_df.columns:
            temp_df['species_id'] = pd.to_numeric(temp_df['species_id'], errors='coerce').astype('Int64')
        temp_df.to_csv(path, index=False, encoding='utf-8')

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_to_index = {executor.submit(process_species, idx, r, target_ranks, mode): idx for idx, r in tasks}
        with tqdm(total=len(tasks), desc="Work In Progress", unit="sp") as pbar:
            for future in as_completed(future_to_index):
                index, res = future.result()
                with df_lock:
                    if res["taxon_id"]: df.at[index, "species_id"] = res["taxon_id"]
                    if res["iucn"]: df.at[index, "iucn"] = res["iucn"]
                    if res["rename_info"]:
                        df.at[index, "scientific_name"] = res["rename_info"]["new"]
                        note_eng = f"Taxonomic Update: The scientific name has been revised from {res['rename_info']['old']} to {res['rename_info']['new']} following iNaturalist standards."
                        note_chi = f"分類更新：根據 iNaturalist 分類標準，學名已從 {res['rename_info']['old']} 修訂為 {res['rename_info']['new']}。"
                        for col, n in [("remarks_eng", note_eng), ("remarks_chi", note_chi)]:
                            v = df.at[index, col]
                            if pd.isna(v) or not str(v).strip(): df.at[index, col] = n
                            elif n not in str(v): df.at[index, col] = f"{v}\n{n}"
                    if res["tax_data"]:
                        for rk, cp in target_ranks.items():
                            if rk in res["tax_data"]:
                                df.at[index, f"{cp}_eng"] = res["tax_data"][rk]["eng"]
                                if f"{cp}_chi" in df.columns: df.at[index, f"{cp}_chi"] = res["tax_data"][rk]["chi"]
                processed_count += 1
                pbar.update(1)
                if processed_count % checkpoint_interval == 0:
                    with save_lock: save_df(df, args.output)
                time.sleep(0.1)

    print(f"\nSaving final results to {args.output}...")
    save_df(df, args.output)
    print("Task Completed Successfully!")

if __name__ == "__main__":
    main()
