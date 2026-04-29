import requests
import json

BASE_URL = "https://api.checklistbank.org"
DATASET_KEY = "3LR"
usage_id = "6N67" # Panthera (Genus)

url = f"{BASE_URL}/dataset?alias=3LR"
resp = requests.get(url)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
