
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase environment variables")
    exit(1)

def query_supabase(table, select="*"):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Range": "0-999" # Default to 1000 records
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error querying {table}: {response.status_code} {response.text}")
        return []

def analyze():
    ranks = ['phylum', 'class', 'order', 'family', 'genus']
    
    print("Analyzing Species (Fauna)...")
    species = query_supabase('species', 'phylum_eng,phylum_chi,class_eng,class_chi,order_eng,order_chi,family_eng,family_chi,genus_eng,genus_chi')
    
    fauna_mappings = {rank: {} for rank in ranks}
    for s in species:
        for rank in ranks:
            eng = s.get(f"{rank}_eng")
            chi = s.get(f"{rank}_chi")
            if eng and chi:
                if eng not in fauna_mappings[rank]:
                    fauna_mappings[rank][eng] = set()
                fauna_mappings[rank][eng].add(chi)

    print("\nAnalyzing Plant Species (Flora)...")
    plants = query_supabase('plant_species', 'family_eng,family_chi,genus_eng,genus_chi')
    
    flora_mappings = {rank: {} for rank in ['family', 'genus']}
    for p in plants:
        for rank in ['family', 'genus']:
            eng = p.get(f"{rank}_eng")
            chi = p.get(f"{rank}_chi")
            if eng and chi:
                if eng not in flora_mappings[rank]:
                    flora_mappings[rank][eng] = set()
                flora_mappings[rank][eng].add(chi)

    print("\n--- Summary ---")
    all_ranks = ['phylum', 'class', 'order', 'family', 'genus']
    for rank in all_ranks:
        f_count = len(fauna_mappings.get(rank, {}))
        pl_count = len(flora_mappings.get(rank, {}))
        print(f"{rank}: Fauna={f_count}, Flora={pl_count}")

    print("\n--- Inconsistencies ---")
    for rank in all_ranks:
        mappings = fauna_mappings.get(rank, {}).copy()
        for eng, chis in flora_mappings.get(rank, {}).items():
            if eng in mappings:
                mappings[eng].update(chis)
            else:
                mappings[eng] = chis
        
        for eng, chis in mappings.items():
            if len(chis) > 1:
                print(f"[{rank}] {eng} has multiple Chinese names: {chis}")

analyze()
