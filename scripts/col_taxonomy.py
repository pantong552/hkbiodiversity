import requests
import csv
import sys
import os

# API 基礎設定
BASE_URL = "https://api.checklistbank.org"
DATASET_KEY = "3LR"  # COL Latest Release

# 標準分類階層順序
RANK_ORDER = [
    "domain", "superkingdom", "kingdom", "subkingdom", "infrakingdom",
    "phylum", "subphylum", "infylum", "parvphylum",
    "superclass", "class", "subclass", "infraclass", "subterclass",
    "megaclass", "superorder", "order", "suborder", "infraorder", "parvorder",
    "section", "subsection", "superfamily", "family", "subfamily", "supertribe",
    "tribe", "subtribe", "genus", "subgenus", "section", "species"
]

def search_species(scientific_name):
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/nameusage/search"
    params = {"q": scientific_name}
    
    print(f"正在搜尋學名: {scientific_name}...")
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    results = data.get("result", [])
    
    if not results:
        print(f"找不到學名: {scientific_name}")
        return None
    
    # 取得第一個結果
    usage_id = results[0].get("usage", {}).get("id")
    return usage_id

def get_classification(usage_id):
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}/classification"
    print(f"正在獲取完整分類階層...")
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def get_synonyms(usage_id):
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}/synonyms"
    print(f"正在獲取所有同物異名...")
    response = requests.get(url)
    all_synonyms = []
    
    if response.status_code == 200:
        data = response.json()
        for category in ["heterotypic", "homotypic", "misapplied"]:
            items = data.get(category, [])
            for item in items:
                label = item.get("label")
                if label:
                    all_synonyms.append(label)
                else:
                    name_obj = item.get("name", {})
                    if isinstance(name_obj, dict):
                        name_str = name_obj.get("scientificName", "")
                        authorship = name_obj.get("authorship", "")
                        if name_str:
                            all_synonyms.append(f"{name_str} {authorship}".strip())
    
    # 如果列表為空，嘗試通過搜尋獲取
    if not all_synonyms:
        print("從 /synonyms 未獲取到資料，嘗試搜尋...")
        search_url = f"{BASE_URL}/dataset/{DATASET_KEY}/nameusage/search"
        params = {"TAXON_ID": usage_id, "STATUS": "synonym"}
        resp = requests.get(search_url, params=params)
        if resp.status_code == 200:
            results = resp.json().get("result", [])
            for res in results:
                label = res.get("usage", {}).get("label") or res.get("label")
                if label:
                    all_synonyms.append(label)
                        
    return "; ".join(list(dict.fromkeys(all_synonyms)))

def get_subspecies(usage_id):
    """
    獲取亞種 (Subspecies) 並包含作者
    """
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/tree/{usage_id}/children"
    print(f"正在搜尋亞種...")
    response = requests.get(url)
    subspecies_list = []
    
    if response.status_code == 200:
        data = response.json()
        items = data.get("result", []) if isinstance(data, dict) else data
        
        if isinstance(items, list):
            for item in items:
                if item.get("rank") == "subspecies":
                    # 直接獲取作者並拼接
                    name = item.get("name", "")
                    authorship = item.get("authorship", "")
                    
                    if isinstance(name, dict):
                        sName = name.get("scientificName", "")
                        auth = authorship or name.get("authorship", "")
                        subspecies_list.append(f"{sName} {auth}".strip())
                    elif isinstance(name, str):
                        subspecies_list.append(f"{name} {authorship}".strip())
                    elif item.get("label"):
                        subspecies_list.append(item.get("label"))
                            
    return "; ".join(subspecies_list)

def save_to_csv(classification, species_info, scientific_name):
    filename = f"{scientific_name.replace(' ', '_')}_taxonomy.csv"
    
    found_ranks = {}
    for item in classification:
        r_name = item.get("rank", "").lower()
        if r_name:
            found_ranks[r_name] = item.get("name")
            
    sorted_ranks = [r for r in RANK_ORDER if r in found_ranks]
    other_ranks = [r for r in found_ranks.keys() if r not in RANK_ORDER]
    all_active_ranks = sorted_ranks + other_ranks
    
    header = ["Usage ID", "Scientific Name", "Author"] + \
             [r.capitalize() for r in all_active_ranks] + \
             ["Subspecies", "Synonyms"]
    
    row = {
        "Usage ID": species_info.get("id"),
        "Scientific Name": species_info.get("scientificName"),
        "Author": species_info.get("authorship"),
        "Subspecies": species_info.get("subspecies"),
        "Synonyms": species_info.get("synonyms")
    }
    
    for r in all_active_ranks:
        row[r.capitalize()] = found_ranks.get(r, "")
        
    with open(filename, mode='w', newline='', encoding='utf-8-sig') as file:
        writer = csv.DictWriter(file, fieldnames=header)
        writer.writeheader()
        writer.writerow(row)
            
    print(f"成功將分類資訊輸出至: {filename}")
    return filename

def main():
    if len(sys.argv) < 2:
        name = "Pipistrellus abramus"
    else:
        name = " ".join(sys.argv[1:])
    
    try:
        usage_id = search_species(name)
        if usage_id:
            classification = get_classification(usage_id)
            
            # 獲取物種本身詳細資訊
            url = f"{BASE_URL}/dataset/{DATASET_KEY}/taxon/{usage_id}"
            resp = requests.get(url)
            resp.raise_for_status()
            taxon_data = resp.json()
            
            name_obj = taxon_data.get("name", {})
            
            # 獲取同物異名與亞種
            synonyms = get_synonyms(usage_id)
            subspecies = get_subspecies(usage_id)
            
            species_info = {
                "id": usage_id,
                "scientificName": name_obj.get("scientificName") if isinstance(name_obj, dict) else "",
                "authorship": name_obj.get("authorship") if isinstance(name_obj, dict) else "",
                "synonyms": synonyms,
                "subspecies": subspecies
            }
            
            save_to_csv(classification, species_info, name)
        else:
            print("找不到該物種。")
    except Exception as e:
        print(f"執行出錯: {e}")

if __name__ == "__main__":
    main()
