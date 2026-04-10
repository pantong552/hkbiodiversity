import os
import time
import requests
import re
from supabase import create_client, Client
from tqdm import tqdm
from dotenv import load_dotenv

# 加載環境變數
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("錯誤：找不到 Supabase 設定，請檢查 .env.local")
    exit(1)

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def clean_scientific_name(name):
    if not name: return ""
    # 1. 移除括號及其內容 (作者/年份)
    name = re.sub(r'\s*\([^)]*\)', '', name)
    # 2. 移除年份
    name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def get_inaturalist_id(original_name):
    """
    專業嚴格匹配模式：要求官方學名必須與輸入完全一致。
    不再支援異名 (matched_term) 或模糊匹配。
    """
    cleaned_name = clean_scientific_name(original_name)
    if not cleaned_name: return None
    
    url = "https://api.inaturalist.org/v1/taxa/autocomplete"
    try:
        params = {"q": cleaned_name, "is_active": "true"}
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if not results: return None

            target = cleaned_name.lower().strip()
            best_match = None
            
            for res in results:
                res_name = res["name"].lower().strip()
                is_species = (res.get("rank") == "species")
                
                # 嚴格匹配：只有名稱 100% 相等才採集
                if res_name == target:
                    if is_species:
                        return res["id"]
                    if best_match is None:
                        best_match = res["id"]
            return best_match
    except Exception:
        pass
    return None

def main():
    print("=== iNaturalist ID 同步工具 (專業嚴格模式 / 序列式單工版本) ===")
    print("模式選擇：")
    print("1. 完整同步 (會重新檢查所有物種，可能覆蓋現有 ID)")
    print("2. 增量更新 (只處理 species_id 為空的物種)")
    
    choice = input("請輸入模式 (1/2): ").strip()
    if choice not in ['1', '2']:
        print("無效選擇，退出程式。")
        return

    main_supabase = get_supabase_client()
    
    if choice == '1':
        confirm = input("注意：這將檢查全表物種。確定繼續嗎？(y/n): ")
        if confirm.lower() != 'y': return
        mode_desc = "完整同步"
    else:
        mode_desc = "增量更新"

    print(f"正在從 Supabase 獲取物種清單 ({mode_desc})...")
    
    all_species = []
    page_size = 1000
    offset = 0
    
    while True:
        query = main_supabase.table("species").select("id, scientific_name")
        if choice == '2':
            query = query.is_("species_id", "null")
            
        response = query.range(offset, offset + page_size - 1).execute()
        data = response.data
        if not data: break
        all_species.extend(data)
        if len(data) < page_size: break
        offset += page_size

    total = len(all_species)
    if total == 0:
        print("沒有需要更新的物種。")
        return

    print(f"找到 {total} 筆。開始序列更新 (1 worker / 確保 100% 寫入成功)...")
    
    success_count = 0
    not_found_count = 0
    fail_count = 0

    # 單執行緒處理，保證序列性與穩定性
    for sp in tqdm(all_species, desc="同步進度"):
        sp_id = sp["id"]
        sci_name = sp["scientific_name"]
        
        # 獲取 ID
        inat_id = get_inaturalist_id(sci_name)
        update_val = str(inat_id) if inat_id else None
        
        try:
            # 確保更新成功，eq("id", sp_id) 確保精準命中
            main_supabase.table("species").update({"species_id": update_val}).eq("id", sp_id).execute()
            if inat_id:
                success_count += 1
            else:
                not_found_count += 1
        except Exception as e:
            print(f"\n寫入失敗 [{sci_name}]: {e}")
            fail_count += 1
        
        # 微小延遲以保護 API
        time.sleep(0.05)

    print(f"\n任務完成！")
    print(f"成功匹配並更新: {success_count}")
    print(f"未找到匹配 (設為 NULL): {not_found_count}")
    print(f"更新錯誤: {fail_count}")

if __name__ == "__main__":
    main()
