import pandas as pd
import sys

# 強制 UTF-8 輸出
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

df = pd.read_csv('database/MarineFish_updated.csv', encoding='utf-8')
row = df.iloc[0]

cols = [
    'phylum_eng', 'phylum_chi', 
    'class_eng', 'class_chi', 
    'sub_class_eng', 'sub_class_chi', 
    'order_eng', 'order_chi', 
    'sub_order_eng', 'sub_order_chi', 
    'superfamily_eng', 'superfamily_chi', 
    'family_eng', 'family_chi', 
    'sub_family_eng', 'sub_family_chi', 
    'genus_eng', 'genus_chi', 
    'species_eng', 'sub_species_eng'
]

print("-" * 40)
print(f"Species: {row['scientific_name']}")
print("-" * 40)
for c in cols:
    val = row.get(c, "N/A")
    if pd.isna(val) or str(val).lower() == 'nan':
        val = ""
    print(f"{c:20}: {val}")
print("-" * 40)
