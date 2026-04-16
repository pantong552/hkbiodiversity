import os
import requests
import re
import time
import json
from supabase import create_client
from tqdm import tqdm
from dotenv import load_dotenv

# 加載環境變數
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def clean_scientific_name(name):
    """清理學名，移除括號、年份及資料庫內部後綴 (如 _2)"""
    if not name: return ""
    name = re.sub(r'_\d+$', '', name)
    name = re.sub(r'\s*\([^)]*\)', '', name)
    name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def fetch_taxonomy_v2_deep(scientific_name, species_id=None):
    """
    深度獲取法：
    1. 若有 species_id，直接抓取詳情。
    2. 若無，先搜尋學名獲取 ID，再抓取全量 Taxon 資訊。
    """
    cleaned_name = clean_scientific_name(scientific_name)
    if not cleaned_name: return None

    base_url = "https://api.inaturalist.org/v2/taxa"
    fields = "name,rank,preferred_common_name,ancestors.name,ancestors.rank,ancestors.preferred_common_name"
    
    target_ranks = ['subclass', 'suborder', 'superfamily', 'subfamily']
    results = {rank: {"eng": None, "chi": None} for rank in target_ranks}

    try:
        def get_detail(taxon_id, locale):
            detail_url = f"{base_url}/{taxon_id}"
            detail_params = {"fields": fields, "locale": locale}
            r_detail = requests.get(detail_url, params=detail_params, timeout=10)
            if r_detail.status_code == 200:
                return r_detail.json().get("results", [None])[0]
            return None

        def get_taxon_id_by_search(locale):
            search_params = {"q": cleaned_name, "locale": locale}
            r_search = requests.get(base_url, params=search_params, timeout=10)
            if r_search.status_code == 200 and r_search.json().get("results"):
                return r_search.json()["results"][0]["id"]
            return None

        # 核心邏輯：優先使用傳入的 species_id
        current_id = species_id
        
        # 1. 抓取 zh-HK
        if not current_id:
            current_id = get_taxon_id_by_search("zh-HK")
        
        if not current_id:
            return None # 依然找不到物種
        
        data_hk = get_detail(current_id, "zh-HK")
        if not data_hk:
            return None

        # 2. 解析 (包含 ancestors 及物種本身)
        nodes = data_hk.get("ancestors", []) + [data_hk]
        for node in nodes:
            rank = node.get("rank")
            if rank in target_ranks:
                results[rank]["eng"] = node.get("name")
                results[rank]["chi"] = node.get("preferred_common_name")

        # 3. 補全 zh-TW
        needs_tw = any(results[r]["eng"] and not results[r]["chi"] for r in target_ranks)
        if needs_tw:
            data_tw = get_detail(current_id, "zh-TW")
            if data_tw:
                nodes_tw = data_tw.get("ancestors", []) + [data_tw]
                for node in nodes_tw:
                    rank = node.get("rank")
                    if rank in target_ranks and not results[rank]["chi"]:
                        results[rank]["chi"] = node.get("preferred_common_name")
        
        return results
    except Exception as e:
        return None

def main():
    print("=== 深度分類更新 (二段式精準追蹤版) ===")
    supabase = get_supabase_client()
    
    # 全量覆蓋模式 (分頁讀取確保抓完 2364 筆)
    print("讀取物種清單...")
    all_species = []
    page_size = 1000
    offset = 0
    
    while True:
        response = supabase.table("species").select("id, scientific_name, species_id") \
            .order("id") \
            .range(offset, offset + page_size - 1).execute()
        data = response.data
        if not data: break
        all_species.extend(data)
        if len(data) < page_size: break
        offset += page_size
    
    total = len(all_species)
    print(f"啟動優化版全量更新: {total} 筆物種")
    
    with open("taxonomy_deep_update.log", "w", encoding="utf-8") as log:
        success = 0
        for sp in tqdm(all_species):
            sp_id = sp["id"]
            sci_name = sp["scientific_name"]
            inat_id = sp.get("species_id")
            
            tax = fetch_taxonomy_v2_deep(sci_name, species_id=inat_id)
            if tax:
                update_val = {
                    "sub_class_eng": tax["subclass"]["eng"],
                    "sub_class_chi": tax["subclass"]["chi"],
                    "sub_order_eng": tax["suborder"]["eng"],
                    "sub_order_chi": tax["suborder"]["chi"],
                    "superfamily_eng": tax["superfamily"]["eng"],
                    "superfamily_chi": tax["superfamily"]["chi"],
                    "sub_family_eng": tax["subfamily"]["eng"],
                    "sub_family_chi": tax["subfamily"]["chi"]
                }
                try:
                    supabase.table("species").update(update_val).eq("id", sp_id).execute()
                    success += 1
                    log.write(f"[OK] ID {sp_id}: {sci_name}\n")
                except Exception as e:
                    log.write(f"[FAIL] ID {sp_id}: {e}\n")
            else:
                log.write(f"[SKIP] ID {sp_id}: Not Found\n")
            
            time.sleep(0.12) # 速率限制

    print(f"更新完成！成功: {success}")

if __name__ == "__main__":
    main()
