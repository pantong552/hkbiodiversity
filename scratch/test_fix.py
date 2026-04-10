import os
import requests
import re
from sync_inaturalist_ids import get_inaturalist_id, clean_scientific_name

test_cases = [
    "Neopithecops zalmora",
    "Manis pentadactyla",
    "Psittacula eupatria"
]

print("--- 測試學名清理 ---")
for name in test_cases:
    print(f"原始: {name:25} -> 清理後: {clean_scientific_name(name)}")

print("\n--- 測試 iNaturalist ID 獲取 ---")
for name in test_cases:
    inat_id = get_inaturalist_id(name)
    print(f"學名: {name:25} -> 獲取 ID: {inat_id}")

# 額外測試帶有作者的格式
author_test = "Pieris canidia (Linnaeus, 1768)"
print(f"\n--- 作者格式測試 ---")
print(f"原始: {author_test} -> 清理後: {clean_scientific_name(author_test)}")
print(f"獲取 ID: {get_inaturalist_id(author_test)}")
