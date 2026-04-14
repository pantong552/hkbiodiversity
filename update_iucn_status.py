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
IUCN_TOKEN = os.getenv("IUCN_API_TOKEN")

# IUCN 保護等級 Code -> Label 映射表
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

if not SUPABASE_URL or not SUPABASE_KEY or not IUCN_TOKEN:
    print("錯誤：找不到 Supabase 或 IUCN 設定，請檢查 .env.local")
    exit(1)

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def clean_scientific_name(name):
    """
    清理學名：移除括號中的作者資訊、年份。
    """
    if not name: return ""
    name = re.sub(r'\s*\([^)]*\)', '', name)
    name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def get_iucn_status(scientific_name):
    """
    呼叫 IUCN API v4 獲取保護等級
    """
    cleaned_name = clean_scientific_name(scientific_name)
    if not cleaned_name: return None
    
    parts = cleaned_name.split()
    if len(parts) < 2: return None
    
    # 準備參數
    params = {
        "genus_name": parts[0],
        "species_name": parts[1]
    }
    
    # 處理亞種或變種 (三名法)
    if len(parts) >= 4 and parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[3]
    elif len(parts) >= 3 and parts[2].lower() not in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[2]

    url = "https://api.iucnredlist.org/api/v4/taxa/scientific_name"
    headers = {
        "Authorization": f"Bearer {IUCN_TOKEN}",
        "Accept": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            # v4 API 結構解析: 尋找 assessments 列表中 latest 為 true 的評估
            assessments = data.get("assessments", [])
            latest_assessment = next((a for a in assessments if a.get("latest")), None)
            
            if latest_assessment:
                code = latest_assessment.get("red_list_category_code")
                if code:
                    # 轉換為完整標籤 (Label)
                    return IUCN_MAP.get(code, code)
        elif response.status_code == 404:
            return None
        elif response.status_code == 401:
            print(f"\n[錯誤] IUCN Token 無效。")
            return "ERROR_AUTH"
    except Exception:
        pass
    return None

def main():
    print("=== IUCN 保護等級自動更新工具 (API v4 正式修正版) ===")
    print("模式：更新所有物種，寫入完整名稱 (Label)")
    
    main_supabase = get_supabase_client()
    
    print("正在從 Supabase 獲取物種清單...")
    
    all_species = []
    page_size = 1000
    offset = 0
    
    while True:
        response = main_supabase.table("species").select("id, scientific_name").range(offset, offset + page_size - 1).execute()
        data = response.data
        if not data: break
        all_species.extend(data)
        if len(data) < page_size: break
        offset += page_size

    total = len(all_species)
    if total == 0:
        print("資料庫中沒有物種。")
        return

    print(f"找到 {total} 筆。開始更新...")
    
    success_count = 0
    not_found_count = 0
    fail_count = 0

    for sp in tqdm(all_species, desc="同步進度"):
        sp_id = sp["id"]
        sci_name = sp["scientific_name"]
        
        # 獲取 IUCN 狀態
        iucn_status = get_iucn_status(sci_name)
        
        if iucn_status == "ERROR_AUTH":
            print("認證失敗，停止工作。")
            break
            
        update_val = iucn_status if iucn_status else None
        
        try:
            main_supabase.table("species").update({"iucn": update_val}).eq("id", sp_id).execute()
            if iucn_status:
                success_count += 1
            else:
                not_found_count += 1
        except Exception:
            fail_count += 1
        
        # 稍微延遲以遵守速率限制
        time.sleep(0.1)

    print(f"\n任務完成！")
    print(f"成功更新狀態: {success_count}")
    print(f"查無結果 (設為 NULL): {not_found_count}")
    print(f"執行錯誤: {fail_count}")

if __name__ == "__main__":
    main()
