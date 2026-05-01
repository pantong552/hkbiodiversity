import requests
import csv
import sys
import os
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from tqdm import tqdm

# API 基礎設定
BASE_URL = "https://api.checklistbank.org"
DATASET_KEY = "314965"  # COL Latest Release (COL26.4 XR, Version: 2026-04-18)

# 設定重試機制
def get_session():
    session = requests.Session()
    retry_strategy = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session

session = get_session()

def get_synonyms_list(usage_id):
    """獲取同物異名清單"""
    if not usage_id:
        return []
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}/synonyms"
    try:
        response = session.get(url, timeout=20)
        if response.status_code == 200:
            data = response.json()
            all_items = []
            for category in ["heterotypic", "homotypic", "misapplied"]:
                items = data.get(category, [])
                for item in items:
                    if isinstance(item, list):
                        all_items.extend(item)
                    else:
                        all_items.append(item)
            return all_items
    except Exception:
        pass
    return []

def get_synonyms_str(usage_id):
    """獲取同物異名（僅名稱，逗號分隔字串）"""
    items = get_synonyms_list(usage_id)
    names = []
    for item in items:
        name_obj = item.get("name", {})
        if isinstance(name_obj, dict):
            name_str = name_obj.get("scientificName", "")
            if name_str:
                names.append(name_str)
    return ",".join(list(dict.fromkeys(names)))

def get_taxon_info(usage_id):
    """根據 usage_id 獲取該物種的詳細資訊"""
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}"
    try:
        response = session.get(url, timeout=20)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        # print(f"Error getting taxon info for {usage_id}: {e}")
        pass
    return None

def get_classification_info(usage_id):
    """根據 usage_id 獲取分類階層"""
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}/classification"
    try:
        response = session.get(url, timeout=20)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        # print(f"Error getting classification for {usage_id}: {e}")
        pass
    return []

def process_species(row, original_fields):
    """處理單個物種資料列"""
    scientific_name_orig = row.get("scientific_name", "").strip()
    if not scientific_name_orig:
        return {**row, "remark": "Empty Scientific Name"}
    
    search_url = f"{BASE_URL}/dataset/{DATASET_KEY}/nameusage/search"
    
    taxonomy_data = {
        "scientific_name_col": "",
        "usage_id": "",
        "Synonyms": "",
        "Author": "",
        "Phylum": "",
        "Class": "",
        "Order": "",
        "Family": "",
        "Genus": "",
        "remark": ""
    }
    
    try:
        # 執行精確搜尋
        params = {"q": scientific_name_orig, "type": "exact"}
        response = session.get(search_url, params=params, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        results = res_json.get("result", [])
        
        # 只考慮種級結果
        species_results = [r for r in results if r.get("usage", {}).get("name", {}).get("rank", "").lower() in ["species", "subspecies"]]
        
        final_id = None
        
        # 遍歷搜尋結果尋找最適合的 ID
        for res in species_results:
            usage = res.get("usage", {})
            status = usage.get("status", "")
            
            # 如果是 accepted，直接使用
            if status == "accepted":
                final_id = res.get("id")
                break
            
            # 如果是 synonym，獲取其正名 ID
            elif status in ["synonym", "ambiguous synonym"]:
                accepted = usage.get("accepted", {})
                if accepted:
                    final_id = accepted.get("id")
                    accepted_label = accepted.get("label", "")
                    taxonomy_data["remark"] = f"Synonym of {accepted_label} (usage id: {final_id})"
                    break

        # 如果以上皆無，返回 Not Found
        if not final_id:
            taxonomy_data["remark"] = "Not Found"

        if final_id:
            taxon_info = get_taxon_info(final_id)
            if taxon_info:
                name_obj = taxon_info.get("name", {})
                taxonomy_data["scientific_name_col"] = name_obj.get("scientificName", "")
                taxonomy_data["usage_id"] = final_id
                taxonomy_data["Author"] = name_obj.get("authorship", "")
                
                classification = get_classification_info(final_id)
                for item in classification:
                    rank = item.get("rank", "").capitalize()
                    if rank in ["Phylum", "Class", "Order", "Family", "Genus"]:
                        taxonomy_data[rank] = item.get("name", "")
                
                taxonomy_data["Synonyms"] = get_synonyms_str(final_id)
            
    except Exception as e:
        # print(f"Error processing {scientific_name_orig}: {e}")
        taxonomy_data["remark"] = f"Error: {str(e)}"
    
    output_row = {}
    for field in original_fields:
        output_row[field] = row.get(field, "")
    output_row.update(taxonomy_data)
    return output_row

def process_file(input_path, output_dir):
    filename = os.path.basename(input_path)
    name_part, ext_part = os.path.splitext(filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    output_filename = f"{name_part}_{timestamp}{ext_part}"
    output_path = os.path.join(output_dir, output_filename)

    print(f"\n[處理檔案] {filename}")
    
    try:
        with open(input_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            original_fields = reader.fieldnames
            rows = list(reader)
    except Exception as e:
        print(f"讀取檔案失敗: {input_path}, 錯誤: {e}")
        return

    if not original_fields or 'scientific_name' not in original_fields:
        print(f"錯誤：檔案 {filename} 找不到 'scientific_name' 欄位")
        return

    new_columns = ["scientific_name_col", "usage_id", "Synonyms", "Author", "Phylum", "Class", "Order", "Family", "Genus", "remark"]
    all_headers = original_fields + new_columns

    total_rows = len(rows)
    results = []
    
    # 這裡可以根據需要調整 max_workers，因為是通用腳本，預設給 10
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_row = {executor.submit(process_species, row, original_fields): i for i, row in enumerate(rows)}
        
        # 使用 tqdm 顯示進度條
        with tqdm(total=total_rows, desc=f"進度 ({filename})") as pbar:
            temp_results = [None] * total_rows
            for future in as_completed(future_to_row):
                index = future_to_row[future]
                try:
                    temp_results[index] = future.result()
                except Exception as e:
                    print(f"處理列 {index} 時發生嚴重錯誤: {e}")
                    temp_results[index] = {**rows[index], "remark": "Internal Processing Error"}
                pbar.update(1)
            results = temp_results

    with open(output_path, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=all_headers, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(results)

    print(f"完成！輸出至: {output_path}")

def main():
    input_dir = r"database\col_fetch_input"
    output_dir = r"database\col_fetch_output"
    
    if not os.path.exists(input_dir):
        print(f"找不到輸入目錄: {input_dir}")
        return
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    csv_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.csv')]
    
    if not csv_files:
        print(f"目錄 {input_dir} 中沒有發現任何 CSV 檔案。")
        return

    print(f"找到 {len(csv_files)} 個檔案，準備開始處理...")
    
    for csv_file in csv_files:
        input_path = os.path.join(input_dir, csv_file)
        process_file(input_path, output_dir)

    print("\n[所有任務已完成]")

if __name__ == "__main__":
    main()
