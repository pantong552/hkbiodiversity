import os
import time
import requests
from supabase import create_client, Client
from tqdm import tqdm
from dotenv import load_dotenv

# 加載環境變數
load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")  # 注意：如果是純後端更新，建議使用 Service Role Key，但這裡先用 Anon Key 試試

if not SUPABASE_URL or not SUPABASE_KEY:
    print("錯誤：找不到 Supabase 設定，請檢查 .env.local")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_inaturalist_id(scientific_name):
    """
    透過 iNaturalist API 搜尋學名並獲取 Taxon ID
    """
    url = "https://api.inaturalist.org/v1/taxa/autocomplete"
    params = {
        "q": scientific_name,
        "is_active": "true"
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data["total_results"] > 0:
                # 尋找精確匹配 (不分大小寫)
                for result in data["results"]:
                    if result["name"].lower() == scientific_name.lower():
                        return result["id"]
        return None
    except Exception as e:
        print(f"\n搜尋 {scientific_name} 時出錯: {e}")
        return None

from concurrent.futures import ThreadPoolExecutor, as_completed

def process_species(sp):
    """
    Process a single species: fetch ID and update Supabase.
    """
    sp_id = sp["id"]
    scientific_name = sp["scientific_name"]
    
    if not scientific_name:
        return "skipped"

    inat_id = get_inaturalist_id(scientific_name)
    update_val = str(inat_id) if inat_id else None
    
    try:
        supabase.table("species").update({"species_id": update_val}).eq("id", sp_id).execute()
        return "success" if inat_id else "not_found"
    except Exception as e:
        return f"error: {e}"

def main():
    # 1. Fetch all species from Supabase using pagination
    print("Fetching species list from Supabase...")
    all_species_list = []
    page_size = 1000
    offset = 0
    
    while True:
        response = supabase.table("species").select("id, scientific_name").range(offset, offset + page_size - 1).execute()
        data = response.data
        if not data:
            break
        all_species_list.extend(data)
        if len(data) < page_size:
            break
        offset += page_size

    if not all_species_list:
        print("No species data found.")
        return

    total = len(all_species_list)
    print(f"Found {total} species. Starting parallel iNaturalist matching (Max workers: 10)...")

    success_count = 0
    not_found_count = 0
    fail_count = 0

    # 2. Parallel processing using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_species, sp): sp for sp in all_species_list}
        
        for future in tqdm(as_completed(futures), total=total, desc="Parallel Matching Progress"):
            result = future.result()
            if result == "success":
                success_count += 1
            elif result == "not_found":
                not_found_count += 1
            elif result.startswith("error"):
                print(f"\n{result}")
                fail_count += 1

    print(f"\nTask Finished!")
    print(f"Direct Matches Found & Updated: {success_count}")
    print(f"No Match (Set to NULL): {not_found_count}")
    print(f"Update Errors: {fail_count}")

if __name__ == "__main__":
    main()
