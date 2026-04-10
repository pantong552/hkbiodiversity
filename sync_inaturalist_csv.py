import pandas as pd
import requests
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

# 配置
INPUT_CSV = "species_rows.csv"
OUTPUT_CSV = "species_rows_updated.csv"
MAX_WORKERS = 1  # 本地處理可以稍微快一點，但要尊重 iNaturalist API 頻率

def clean_scientific_name(name):
    if not name or pd.isna(name): return ""
    name = str(name)
    name = re.sub(r'\s*\([^)]*\)', '', name)
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
    
    # 標準流程：僅針對清理後的名稱進行嚴格搜尋
    try:
        params = {"q": cleaned_name, "is_active": "true"}
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if not results: return None

            target = cleaned_name.lower().strip()
            
            # 嚴格篩選：名稱必須完全一致
            best_match = None
            for res in results:
                res_name = res["name"].lower().strip()
                is_species = (res.get("rank") == "species")
                
                # 只有名稱 100% 相等才進入考慮
                if res_name == target:
                    if is_species:
                        # 找到完全匹配的物種，直接回傳
                        return res["id"]
                    if best_match is None:
                        # 備選 (如亞種)，但名稱仍須完全一致
                        best_match = res["id"]
            
            return best_match
            
        time.sleep(0.05)
    except Exception:
        pass
        
    return None

def process_row(index, sci_name):
    inat_id = get_inaturalist_id(sci_name)
    return index, inat_id

def main():
    print(f"正在讀取 {INPUT_CSV}...")
    
    # 嘗試不同的編碼讀取
    try:
        df = pd.read_csv(INPUT_CSV, header=None, low_memory=False)
    except UnicodeDecodeError:
        df = pd.read_csv(INPUT_CSV, header=None, encoding='cp950', low_memory=False)

    print(f"成功加載 {len(df)} 筆數據。")
    
    # 根據觀測到的結構：
    # index 1 是 species_id (iNaturalist ID)
    # index 5 是 scientific_name
    
    # 找出需要同步的行 (species_id 為空)
    target_mask = df[1].isna() | (df[1].astype(str).str.strip() == "")
    targets = df[target_mask]
    
    print(f"需要同步的空值記錄共: {len(targets)} 筆。")

    if len(targets) == 0:
        print("沒有需要更新的記錄。")
        return

    # 使用字典儲存結果以確保對應正確
    results = {}
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_idx = {
            executor.submit(process_row, idx, row[5]): idx 
            for idx, row in targets.iterrows()
        }
        
        for future in tqdm(as_completed(future_to_idx), total=len(targets), desc="iNaturalist 匹配進度"):
            idx, inat_id = future.result()
            if inat_id:
                results[idx] = inat_id

    print(f"\n匹配完成。正在將 {len(results)} 筆獲取的 ID 寫入表格...")
    
    # 更新 DataFrame
    for idx, inat_id in results.items():
        df.at[idx, 1] = str(inat_id)

    # 儲存 CSV (保留原本的編碼風格，使用 utf-8-sig 以便 Excel 開啟)
    df.to_csv(OUTPUT_CSV, index=False, header=False, encoding='utf-8-sig')
    print(f"處理完成！結果已儲存至: {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
