
import requests
import os
import json
from dotenv import load_dotenv
from collections import Counter
import sys
import io

# 強制控制台輸出為 UTF-8
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 加載環境變數
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase environment variables")
    exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "merge-duplicates"
}

def query_supabase(table, select="*"):
    all_data = []
    limit = 1000
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&limit={limit}&offset={offset}"
        response = requests.get(url, headers=HEADERS)
        if response.status_code != 200:
            print(f"❌ Query {table} failed: {response.status_code}")
            break
        data = response.json()
        if not data: break
        all_data.extend(data)
        if len(data) < limit: break
        offset += limit
    return all_data

def get_table_columns(table):
    """獲取表格的所有欄位名稱"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=0"
    headers = HEADERS.copy()
    headers["Prefer"] = "count=exact"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        # 從 Content-Range 或其他方式獲取欄位名不太方便，
        # 直接用一個空的 select 請求來測試是否存在
        pass
    
    # 另一種方式：請求第一筆資料來看看有哪些 keys
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1"
    response = requests.get(url, headers=HEADERS)
    if response.status_code == 200 and response.json():
        return list(response.json()[0].keys())
    return []

def migrate():
    ranks = ['phylum', 'class', 'order', 'family', 'genus', 'informal_group']
    raw_mappings = {
        'fauna': {rank: {} for rank in ranks},
        'flora': {rank: {} for rank in ranks}
    }

    # 1. 處理 Fauna (species)
    print("Detecting columns for 'species'...")
    species_cols = get_table_columns('species')
    if not species_cols:
        print("❌ Could not detect columns for species table.")
    else:
        # 只選取存在的欄位
        target_ranks = ['phylum', 'class', 'order', 'family', 'genus', 'informal_group']
        select_parts = []
        for r in target_ranks:
            if f"{r}_eng" in species_cols: select_parts.append(f"{r}_eng")
            if f"{r}_chi" in species_cols: select_parts.append(f"{r}_chi")
        
        if select_parts:
            print(f"Searching Fauna data (Columns: {', '.join(select_parts)})...")
            species_data = query_supabase('species', ','.join(select_parts))
            for s in species_data:
                for r in target_ranks:
                    eng = s.get(f"{r}_eng")
                    chi = s.get(f"{r}_chi")
                    if eng and chi:
                        eng, chi = eng.strip(), chi.strip()
                        if eng not in raw_mappings['fauna'][r]: raw_mappings['fauna'][r][eng] = []
                        raw_mappings['fauna'][r][eng].append(chi)

    # 2. 處理 Flora (plant_species)
    print("\nDetecting columns for 'plant_species'...")
    plant_cols = get_table_columns('plant_species')
    if not plant_cols:
        print("❌ Could not detect columns for plant_species table.")
    else:
        # 只選取存在的欄位
        rank_pairs = [('family', 'family'), ('genus', 'genus'), ('category', 'class')]
        select_parts = []
        for db_r, _ in rank_pairs:
            if f"{db_r}_eng" in plant_cols: select_parts.append(f"{db_r}_eng")
            if f"{db_r}_chi" in plant_cols: select_parts.append(f"{db_r}_chi")
        
        if select_parts:
            print(f"Searching Flora data (Columns: {', '.join(select_parts)})...")
            plant_data = query_supabase('plant_species', ','.join(select_parts))
            for p in plant_data:
                for db_r, map_r in rank_pairs:
                    eng = p.get(f"{db_r}_eng")
                    chi = p.get(f"{db_r}_chi")
                    if eng and chi:
                        eng, chi = eng.strip(), chi.strip()
                        if eng not in raw_mappings['flora'][map_r]: raw_mappings['flora'][map_r][eng] = []
                        raw_mappings['flora'][map_r][eng].append(chi)

    # 3. 識別衝突與決定最終譯名
    final_mappings = []
    conflicts = []

    print("\nProcessing mapping relationships...")
    for taxa_type in ['fauna', 'flora']:
        for rank, eng_map in raw_mappings[taxa_type].items():
            for eng, chi_list in eng_map.items():
                if not chi_list: continue
                # 計算頻率
                freq = {}
                for c in chi_list:
                    freq[c] = freq.get(c, 0) + 1
                
                # 排序並選出最頻繁的
                sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
                final_chi = sorted_freq[0][0]
                
                if len(sorted_freq) > 1:
                    conflicts.append({
                        'type': taxa_type,
                        'rank': rank,
                        'eng': eng,
                        'chosen': final_chi,
                        'options': freq
                    })
                
                final_mappings.append({
                    'rank': rank,
                    'taxa_type': taxa_type,
                    'name_eng': eng,
                    'name_chi': final_chi
                })

    # 4. 顯示衝突
    if conflicts:
        print(f"\n⚠️ Found {len(conflicts)} mapping conflicts (using most frequent):")
        serializable_conflicts = []
        for c in conflicts:
            opts_str = ", ".join([f"{k} ({v} times)" for k, v in c['options'].items()])
            print(f"  [{c['type']}][{c['rank']}] {c['eng']} -> {opts_str}")
            serializable_conflicts.append(c)
            
        os.makedirs("scratch", exist_ok=True)
        with open("scratch/taxonomy_conflicts.json", "w", encoding="utf-8") as f:
            json.dump(serializable_conflicts, f, ensure_ascii=False, indent=2)
        print(f"\nNote: Conflicts saved to scratch/taxonomy_conflicts.json for review.")
    else:
        print("\nNo mapping conflicts found.")

    # 5. 匯入資料 (使用 Upsert 模式)
    if not final_mappings:
        print("Empty: No data to import.")
        return

    print(f"\nImporting/Updating {len(final_mappings)} records to taxonomy_mappings...")
    batch_size = 100
    headers = HEADERS.copy()
    headers["Prefer"] = "resolution=merge-duplicates"

    for i in range(0, len(final_mappings), batch_size):
        batch = final_mappings[i : i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/taxonomy_mappings?on_conflict=rank,taxa_type,name_eng"
        response = requests.post(url, headers=headers, json=batch)
        if response.status_code not in [200, 201]:
            print(f"Error: Batch {i//batch_size + 1} failed: {response.status_code} {response.text}")
        else:
            print(f"  Imported/Updated {min(i + batch_size, len(final_mappings))}/{len(final_mappings)}")

    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
