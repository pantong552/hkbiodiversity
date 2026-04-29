import requests
import json

BASE_URL = "https://api.checklistbank.org"
DATASET_KEY = "3LR"
USAGE_ID = "4J6LZ" # Pipistrellus tenuis

def test_endpoint(endpoint):
    url = f"{BASE_URL}/dataset/{DATASET_KEY}/{endpoint}"
    print(f"\n--- Testing Endpoint: {endpoint} ---")
    resp = requests.get(url)
    if resp.status_code == 200:
        print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    else:
        print(f"Error: {resp.status_code}")

# 測試異名
test_endpoint(f"taxon/{USAGE_ID}/synonyms")

# 測試亞種 (Children)
test_endpoint(f"tree/{USAGE_ID}/children")

# 測試以 TAXON_ID 搜尋異名
test_endpoint(f"nameusage/search?TAXON_ID={USAGE_ID}&STATUS=synonym")
