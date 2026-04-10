import hkbws_scraper
import json

urls = [
    'https://avifauna.hkbws.org.hk/species/0460/056600', # Yellow-throated Bunting (連字號 & 學名夾心)
    'https://avifauna.hkbws.org.hk/species/0050/006500', # Spotted Dove (具有 Breeding 章節)
    'https://avifauna.hkbws.org.hk/species/0010/000900'  # Ruddy Shelduck (標準案例)
]

results = []
for url in urls:
    res = hkbws_scraper.parse_species_page(url)
    results.append(res)

with open('test_result_final.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("Final test complete. Check test_result_final.json")
