import os
import time
import requests
import re
import csv
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
from dotenv import load_dotenv

# 加載環境變數
load_dotenv(".env.local")

IUCN_TOKEN = os.getenv("IUCN_API_TOKEN")

if not IUCN_TOKEN:
    print("錯誤：找不到 IUCN 設定 (IUCN_API_TOKEN)，請檢查 .env.local")
    exit(1)

def clean_scientific_name(name):
    """
    清理學名：移除括號中的作者資訊、年份。
    """
    if not name or pd.isna(name): return ""
    # 移除括號內容
    name = re.sub(r'\s*\([^)]*\)', '', str(name))
    # 移除末尾年份
    name = re.sub(r'\s*,?\s*\d{4}$', '', name)
    parts = name.strip().split()
    if len(parts) > 2:
        if parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
            return " ".join(parts[:4])
        return " ".join(parts[:2])
    return name.strip()

def get_iucn_status_code(scientific_name, retries=3):
    """
    呼叫 IUCN API v4 獲取保護等級 Code (如 LC, VU)
    """
    cleaned_name = clean_scientific_name(scientific_name)
    if not cleaned_name: return ""
    
    parts = cleaned_name.split()
    if len(parts) < 2: return ""
    
    params = {
        "genus_name": parts[0],
        "species_name": parts[1]
    }
    
    if len(parts) >= 4 and parts[2].lower() in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[3]
    elif len(parts) >= 3 and parts[2].lower() not in ['ssp.', 'subsp.', 'var.']:
        params["infra_name"] = parts[2]

    url = "https://api.iucnredlist.org/api/v4/taxa/scientific_name"
    headers = {
        "Authorization": f"Bearer {IUCN_TOKEN}",
        "Accept": "application/json"
    }
    
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                assessments = data.get("assessments", [])
                
                # 篩選出所有 latest 為 True 的評估
                latest_assessments = [a for a in assessments if a.get("latest")]
                
                if latest_assessments:
                    # 優先尋找 Global (scope code "1") 的評估
                    global_assessment = next(
                        (a for a in latest_assessments if any(s.get("code") == "1" for s in a.get("scopes", []))), 
                        None
                    )
                    
                    # 如果有 Global 則用 Global，否則用第一個 latest
                    target_assessment = global_assessment if global_assessment else latest_assessments[0]
                    
                    code = target_assessment.get("red_list_category_code")
                    return code if code else ""
                return ""
            elif response.status_code == 404:
                return ""
            elif response.status_code == 401:
                return "ERROR_AUTH"
            elif response.status_code == 429: # Rate limit
                time.sleep(2 * (attempt + 1))
                continue
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)
                continue
    return ""

def main():
    input_file = r"database\IUCN update\Marine_fish.csv"
    output_file = r"database\IUCN update\Marine_fish_updated.csv"
    
    print(f"正在讀取檔案: {input_file}")
    try:
        df = pd.read_csv(input_file)
    except Exception as e:
        print(f"讀取失敗: {e}")
        return

    if 'scientific_name' not in df.columns:
        print("錯誤：CSV 檔案中找不到 'scientific_name' 欄位")
        return

    # 初始化 IUCN Status 欄位（如果不存在）
    if 'IUCN Status' not in df.columns:
        df['IUCN Status'] = ""

    total = len(df)
    results = [None] * total
    
    # 找出還沒處理的 rows (如果要支援斷點續傳可以檢查內容)
    # 這裡我們直接全部處理或處理空白的
    
    print(f"開始處理 {total} 筆資料，使用 3 個 worker...")
    
    # 使用 ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_index = {
            executor.submit(get_iucn_status_code, df.iloc[i]['scientific_name']): i 
            for i in range(total)
        }
        
        processed_count = 0
        for future in tqdm(as_completed(future_to_index), total=total, desc="進度"):
            index = future_to_index[future]
            try:
                status = future.result()
                if status == "ERROR_AUTH":
                    print("\n[錯誤] IUCN Token 無效，請檢查 .env.local")
                    break
                df.at[index, 'IUCN Status'] = status
            except Exception as e:
                print(f"\n索引 {index} 處理失敗: {e}")
            
            processed_count += 1
            
            # 每 20 筆存檔一次
            if processed_count % 20 == 0:
                # 存檔時強制所有欄位用引號括住
                df.to_csv(output_file, index=False, quoting=csv.QUOTE_ALL, encoding='utf-8-sig')
    
    # 最後存檔
    df.to_csv(output_file, index=False, quoting=csv.QUOTE_ALL, encoding='utf-8-sig')
    print(f"\n任務完成！已導出至: {output_file}")

if __name__ == "__main__":
    main()
