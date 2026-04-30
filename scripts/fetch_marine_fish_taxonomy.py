import requests
import csv
import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# API 基礎設定
BASE_URL = "https://api.checklistbank.org"
DATASET_KEY = "3LR"  # COL Latest Release

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
        print(f"Error getting taxon info for {usage_id}: {e}")
    return None

def get_classification_info(usage_id):
    """根據 usage_id 獲取分類階層"""
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}/classification"
    try:
        response = session.get(url, timeout=20)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Error getting classification for {usage_id}: {e}")
    return []

def process_species(row, original_fields):
    """處理單個物種資料列"""
    scientific_name_orig = row.get("scientific_name", "").strip()
    
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
        # 先嘗試精確搜尋
        params = {"q": scientific_name_orig, "type": "exact"}
        response = session.get(search_url, params=params, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        results = res_json.get("result", [])
        
        # 如果精確搜尋沒結果，嘗試模糊搜尋
        if not results:
            params = {"q": scientific_name_orig}
            response = session.get(search_url, params=params, timeout=20)
            results = response.json().get("result", [])

        # 只考慮種級結果
        species_results = [r for r in results if r.get("usage", {}).get("name", {}).get("rank", "").lower() in ["species", "subspecies"]]
        
        final_id = None
        
        # 優先級 1: 尋找狀態為 accepted 且名稱完全符合的結果
        for res in species_results:
            usage = res.get("usage", {})
            name_obj = usage.get("name", {})
            status = usage.get("status", "")
            sci_name = name_obj.get("scientificName", "")
            
            if status == "accepted" and sci_name.lower() == scientific_name_orig.lower():
                final_id = res.get("id")
                break
        
        # 優先級 2: 進行深度異名檢查
        if not final_id:
            input_parts = [p.lower() for p in scientific_name_orig.split()]
            input_species = input_parts[-1] if len(input_parts) >= 2 else ""
            
            for res in species_results[:5]:
                usage = res.get("usage", {})
                status = usage.get("status", "")
                current_id = res.get("id", "")
                
                # 獲取對應正名 ID
                accepted_id = current_id
                if status in ["synonym", "ambiguous synonym"]:
                    accepted = usage.get("accepted", {})
                    if accepted:
                        accepted_id = accepted.get("id", "")
                
                # 檢查異名清單
                synonyms = get_synonyms_list(accepted_id)
                for syn in synonyms:
                    syn_name = syn.get("name", {}).get("scientificName", "").lower()
                    if scientific_name_orig.lower() == syn_name or \
                       (input_species and input_species.replace('a', 'us') == syn_name.split()[-1].replace('a', 'us')):
                        final_id = accepted_id
                        accepted_info = get_taxon_info(accepted_id)
                        accepted_label = accepted_info.get("label", "") if accepted_info else ""
                        taxonomy_data["remark"] = f"Synonym of {accepted_label} (usage id: {accepted_id})"
                        break
                if final_id:
                    break

        # 優先級 3: 若以上皆無，返回 Not Found
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
        print(f"Error processing {scientific_name_orig}: {e}")
    
    output_row = {}
    for field in original_fields:
        output_row[field] = row[field]
    output_row.update(taxonomy_data)
    return output_row

def main():
    if len(sys.argv) > 1 and not sys.argv[1].isdigit():
        name = " ".join(sys.argv[1:])
        print(f"正在測試學名: {name}")
        row = {"scientific_name": name, "No.": "0", "inat_id": "0"}
        res = process_species(row, ["No.", "inat_id", "scientific_name"])
        print("\n結果:")
        print(f"Scientific Name (Accepted): {res['scientific_name_col']}")
        print(f"Usage ID: {res['usage_id']}")
        print(f"Remark: {res['remark']}")
        return

    input_file = r"database\Marine Fish\MarineFish_scientific_name.csv"
    output_file = r"database\Marine Fish\MarineFish_taxonomy_full.csv"
    
    if not os.path.exists(input_file):
        print(f"找不到輸入檔案: {input_file}")
        return

    with open(input_file, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        original_fields = reader.fieldnames
        rows = list(reader)

    new_columns = ["scientific_name_col", "usage_id", "Synonyms", "Author", "Phylum", "Class", "Order", "Family", "Genus", "remark"]
    all_headers = original_fields + new_columns

    total_rows = len(rows)
    print(f"開始並行處理全部 {total_rows} 筆資料 (10 Workers + Retry)...")
    
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_row = {executor.submit(process_species, row, original_fields): row for row in rows}
        count = 0
        for future in as_completed(future_to_row):
            count += 1
            try:
                results.append(future.result())
                if count % 20 == 0 or count == total_rows:
                    print(f"進度: {count}/{total_rows} ({(count/total_rows)*100:.1f}%)")
            except Exception as e:
                print(f"任務徹底失敗: {e}")

    results.sort(key=lambda x: int(x.get("No.", 0)))
    with open(output_file, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=all_headers, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(results)

    print(f"\n全部處理完成！輸出至: {output_file}")

if __name__ == "__main__":
    main()
