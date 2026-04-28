import pandas as pd
import requests
import re
import time
import argparse
import sys
import os
import glob
from datetime import datetime
from pathlib import Path
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from dotenv import load_dotenv

# 加載環境變數 (.env.local)
load_dotenv(".env.local")
IUCN_TOKEN = os.getenv("IUCN_API_TOKEN")

# 強制控制台輸出為 UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# IUCN 保護等級映射表
IUCN_MAP = {
    "EX": "Extinct", "EW": "Extinct in the Wild", "CR": "Critically Endangered",
    "EN": "Endangered", "VU": "Vulnerable", "NT": "Near Threatened",
    "LC": "Least Concern", "DD": "Data Deficient", "NE": "Not Evaluated",
    "RE": "Regionally Extinct", "NA": "Not Applicable", "LR/lc": "Least Concern (Old)",
    "LR/nt": "Near Threatened (Old)", "LR/cd": "Conservation Dependent"
}

# 鎖機制
df_lock = threading.Lock()
save_lock = threading.Lock()

def clean_scientific_name(name):
    """清理學名，移除括號、年份及資料庫內部後綴"""
    if not name or pd.isna(name): return ""
    name = str(name); name = re.sub(r'_\d+$', '', name)
    name = re.sub(r'\s*\([^)]*\)', '', name); name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']: return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def safe_request(url, params=None, headers=None, max_retries=3, timeout=15):
    """帶重試與提示的 API 請求"""
    for attempt in range(max_retries):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code == 200: return r
            elif r.status_code == 429:
                tqdm.write(f"  [限速] 正在等待 3 秒後重試 (第 {attempt+1} 次)...")
                time.sleep(3); continue
            else: return None
        except Exception: time.sleep(1); continue
    return None

def fetch_inat_taxon_id(scientific_name):
    """使用 autocomplete 精確獲取 ID 與目前學名"""
    cl_name = clean_scientific_name(scientific_name)
    if not cl_name: return None, None
    url = "https://api.inaturalist.org/v2/taxa/autocomplete"
    params = {"q": cl_name, "per_page": 10, "fields": "(id:!t,name:!t,matched_term:!t)"}
    r = safe_request(url, params=params)
    if r:
        results = r.json().get("results", [])
        for item in results:
            target_name = item.get("name", "").lower()
            matched_name = item.get("matched_term", "").lower()
            if target_name == cl_name.lower() or matched_name == cl_name.lower():
                return item["id"], item.get("name")
    return None, None

def fetch_taxonomy_details(taxon_id):
    """Locale Backoff 機制獲取詳盡分類樹"""
    if not taxon_id: return None
    base_url = f"https://api.inaturalist.org/v2/taxa/{taxon_id}"
    fields = "(name:!t,rank:!t,preferred_common_name:!t,ancestors:(name:!t,rank:!t,preferred_common_name:!t))"
    main_node = None
    for loc in ["zh-HK", "zh-TW", "en"]:
        r = safe_request(base_url, params={"fields": fields, "locale": loc})
        if r:
            res = r.json().get("results", [])
            if res and res[0].get("ancestors"): main_node = res[0]; break
    if not main_node: return None
    nodes = main_node.get("ancestors", []) + [main_node]
    rank_map = {node.get("rank"): {"eng": node.get("name"), "chi": node.get("preferred_common_name")} for node in nodes}
    for loc in ["zh-HK", "zh-TW"]:
        if all(v["chi"] for v in rank_map.values()): break
        r = safe_request(base_url, params={"fields": "ancestors:(rank:!t,preferred_common_name:!t),preferred_common_name:!t", "locale": loc})
        if r:
            res = r.json().get("results", []); 
            if res:
                alt_node = res[0]; alt_nodes = alt_node.get("ancestors", []) + [alt_node]
                for n in alt_nodes:
                    rk = n.get("rank")
                    if rk in rank_map and not rank_map[rk]["chi"]: rank_map[rk]["chi"] = n.get("preferred_common_name")
    return rank_map

def fetch_iucn_status(scientific_name):
    """IUCN v4 API 獲取狀態"""
    if not IUCN_TOKEN: return None
    cl_name = clean_scientific_name(scientific_name); parts = cl_name.split()
    if len(parts) < 2: return None
    params = {"genus_name": parts[0], "species_name": parts[1]}
    if len(parts) >= 4 and parts[2].lower() in ['ssp.', 'subsp.', 'var.']: params["infra_name"] = parts[3]
    elif len(parts) >= 3 and parts[2].lower() not in ['ssp.', 'subsp.', 'var.']: params["infra_name"] = parts[2]
    url = "https://api.iucnredlist.org/api/v4/taxa/scientific_name"
    headers = {"Authorization": f"Bearer {IUCN_TOKEN}", "Accept": "application/json"}
    r = safe_request(url, params=params, headers=headers)
    if r:
        data = r.json(); assessments = data.get("assessments", [])
        latest = next((a for a in assessments if a.get("latest")), None)
        if latest:
            code = latest.get("red_list_category_code")
            return IUCN_MAP.get(code, code)
    return None

def process_species(index, row, target_ranks, mode):
    """單個物種處理邏輯"""
    old_sci_name = str(row['scientific_name']).strip()
    existing_id = row.get('species_id')
    results = {"taxon_id": None, "tax_data": None, "rename_info": None, "iucn": None}

    if mode in [1, 2]:
        taxon_id = None; real_official_name = None
        if not pd.isna(existing_id) and str(existing_id).strip():
            try: taxon_id = int(float(existing_id))
            except Exception: pass
        if not taxon_id: taxon_id, real_official_name = fetch_inat_taxon_id(old_sci_name)
        if taxon_id:
            results["taxon_id"] = taxon_id; results["tax_data"] = fetch_taxonomy_details(taxon_id)
            if not real_official_name and results["tax_data"] and 'species' in results["tax_data"]:
                real_official_name = results["tax_data"]['species']['eng']
            if real_official_name and clean_scientific_name(real_official_name).lower() != clean_scientific_name(old_sci_name).lower():
                results["rename_info"] = {"old": old_sci_name, "new": real_official_name}

    if mode in [1, 3]:
        results["iucn"] = fetch_iucn_status(old_sci_name)
    return index, results

def process_single_file(input_path, output_path, filter_mode, mode, workers, is_test):
    """處理單個 CSV 檔案的核心迴圈"""
    tqdm.write(f"\n>>> 正在處理檔案: {os.path.basename(input_path)}")

    try:
        df = pd.read_csv(input_path, encoding='utf-8-sig')
    except Exception:
        df = pd.read_csv(input_path, encoding='utf-8', errors='replace')

    target_ranks = {"phylum": "phylum", "class": "class", "subclass": "sub_class", "order": "order", "suborder": "sub_order", "superfamily": "superfamily", "family": "family", "subfamily": "sub_family", "genus": "genus", "species": "species", "subspecies": "sub_species"}
    
    # 初始化欄位
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

    tasks = []
    max_count = 5 if is_test else len(df)
    for index, row in df.iterrows():
        if len(tasks) >= max_count: break
        
        # 檢查學名是否存在
        if pd.isna(row.get('scientific_name')): continue
        
        # 根據 filter_mode 決定是否需要處理
        # filter_mode: 1 (所有), 2 (僅無 ID)
        has_id = not pd.isna(row.get('species_id'))
        if filter_mode == 2 and has_id:
            continue
            
        # 根據 mode 決定具體同步條件
        needs = False
        if mode == 1: # Sync Both
            needs = pd.isna(row.get('phylum_eng')) or pd.isna(row.get('iucn'))
        elif mode == 2: # Sync Taxonomy Only
            needs = pd.isna(row.get('phylum_eng'))
        elif mode == 3: # Sync IUCN Only
            needs = pd.isna(row.get('iucn'))
            
        # 如果是「處理所有」模式，或者符合「需要同步」的條件，則加入任務
        if filter_mode == 1 or needs:
            tasks.append((index, row))

    if not tasks:
        tqdm.write(f"  狀態: 資料集已最新，跳過處理。")
        return

    checkpoint_interval = 20; processed_count = 0
    def save_df_func(dataframe, p):
        tmp = dataframe.copy()
        if "species_id" in tmp.columns: tmp['species_id'] = pd.to_numeric(tmp['species_id'], errors='coerce').astype('Int64')
        tmp.to_csv(p, index=False, encoding='utf-8')

    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_index = {executor.submit(process_species, idx, r, target_ranks, mode): idx for idx, r in tasks}
        with tqdm(total=len(tasks), desc="  同步進度", unit="sp", leave=False) as pbar:
            for future in as_completed(future_to_index):
                index, res = future.result()
                with df_lock:
                    if res["taxon_id"]: df.at[index, "species_id"] = res["taxon_id"]
                    if res["iucn"]: df.at[index, "iucn"] = res["iucn"]
                    if res["rename_info"]:
                        df.at[index, "scientific_name"] = res["rename_info"]["new"]
                        note_e = f"Taxonomic Update: The scientific name has been revised from {res['rename_info']['old']} to {res['rename_info']['new']} following iNaturalist."
                        note_c = f"分類更新：根據 iNaturalist 分類標準，學名已從 {res['rename_info']['old']} 修訂為 {res['rename_info']['new']}。"
                        for col, n in [("remarks_eng", note_e), ("remarks_chi", note_c)]:
                            v = df.at[index, col]
                            if pd.isna(v) or not str(v).strip(): df.at[index, col] = n
                            elif n not in str(v): df.at[index, col] = f"{v}\n{n}"
                    if res["tax_data"]:
                        for rk, cp in target_ranks.items():
                            if rk in res["tax_data"]:
                                df.at[index, f"{cp}_eng"] = res["tax_data"][rk]["eng"]
                                if f"{cp}_chi" in df.columns: df.at[index, f"{cp}_chi"] = res["tax_data"][rk]["chi"]
                processed_count += 1; pbar.update(1)
                if processed_count % checkpoint_interval == 0:
                    with save_lock: save_df_func(df, output_path)
                time.sleep(0.1)

    tqdm.write(f"  狀態: 完成！輸出至 {os.path.basename(output_path)}")
    save_df_func(df, output_path)

def main():
    print("\n" + "="*50)
    print("  Species Batch-Sync Automation Pro")
    print("="*50)
    print("Step 1: Select Records Scope")
    print("1. Process ALL records (Force refresh)")
    print("2. Process ONLY records WITHOUT species_id")
    print("-" * 30)
    
    scope_choice = input("Please select scope (1-2) or 'q': ").strip().lower()
    if scope_choice == 'q': return
    try:
        filter_mode = int(scope_choice)
        if filter_mode not in [1, 2]: raise ValueError
    except ValueError:
        print("Invalid choice."); return

    print("\nStep 2: Select Sync Action")
    print("1. Sync iNaturalist Taxonomy with IUCN Status")
    print("2. Sync iNaturalist Taxonomy only")
    print("3. Sync IUCN Status only")
    print("-" * 30)
    
    sync_choice = input("Please select action (1-3) or 'q': ").strip().lower()
    if sync_choice == 'q': return
    try:
        mode = int(sync_choice)
        if mode not in [1, 2, 3]: raise ValueError
    except ValueError:
        print("Invalid choice."); return

    # 目錄初始化
    input_dir = "database/input"
    output_dir = "database/output"
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # 獲取當前時間戳記
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    
    # 搜尋 CSV 檔案
    csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
    if not csv_files:
        print(f"\n[Empty] No CSV files found in {input_dir}. Please add files and try again.")
        return

    print(f"\nFound {len(csv_files)} file(s). Target: {output_dir}")
    
    for f_path in csv_files:
        base_name = Path(f_path).stem
        out_path = os.path.join(output_dir, f"{base_name}_{timestamp}.csv")
        process_single_file(f_path, out_path, filter_mode, mode, 3, False)

    print("\n" + "="*50)
    print(f"All tasks completed. Check the results in {output_dir}")
    print("="*50)


if __name__ == "__main__":
    main()
