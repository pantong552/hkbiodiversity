import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import re
import csv
import os

# 設定請求頭
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

BASE_URL = "https://avifauna.hkbws.org.hk"

def get_soup(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_species_page(url):
    print(f"Parsing: {url}")
    soup = get_soup(url)
    if not soup:
        return None

    data = {
        "中文名": "",
        "英文名": "",
        "拉丁學名": "",
        "HKBWS Category": "",
        "Morphological feature": "",
        "Breeding": "",
        "Distribution & habitat preference": "",
        "Occurrence": "",
        "Range & Systematics": "",
        "Behaviour, Foraging & Diet": "",
        "Conservation Status": "",
        "References": "",
        "Recommended Citation": "",
        "Website URL": url
    }

    # 1. 核心名稱解析 (具備「同片段分割」能力的加固版)
    sci_node = soup.find(['i', 'em'])
    if sci_node:
        data["拉丁學名"] = sci_node.get_text(strip=True)
        # 獲取包含學名的父容器 (通常是標題)
        parent = sci_node.parent
        # 使用 strings 獲取所有片段 (不使用 stripped 以保留某些空格邏輯，稍後再 strip)
        all_bits = [str(s) for s in parent.strings if s.strip()]
        
        # 遍歷所有片段，尋找包含「拉丁學名」的片段
        for idx, bit in enumerate(all_bits):
            if data["拉丁學名"] in bit:
                # 英文名：學名片段之前的所有內容
                if not data["英文名"]:
                    data["英文名"] = " ".join(all_bits[:idx]).strip()
                
                # 中文名：學名片段中剩餘的部分 + 學名片段之後的所有內容
                remaining_in_bit = bit.replace(data["拉丁學名"], "").strip()
                following_bits = "".join(all_bits[idx+1:])
                data["中文名"] = (remaining_in_bit + following_bits).strip()
                break
    
    # 策略 B: 如果還是空的，優先從網頁 <title> 標籤中提取 (這是最穩健的補充來源)
    if not data["中文名"]:
        page_title = soup.title.get_text() if soup.title else ""
        # 尋找 title 中的中文部分 (通常格式為 "English Name 中文名")
        zh_title_match = re.search(r'[\u4e00-\u9fa5]{2,}', page_title)
        if zh_title_match:
            data["中文名"] = zh_title_match.group(0)
            # 如果英文名也沒抓到，順便從 title 拿
            if not data["英文名"]:
                data["英文名"] = page_title[:zh_title_match.start()].strip()

    # 策略 C: 透過標題正則 (針對標題 tag 的 fallback)
    
    # 策略 C: 終極保險 - 從 Recommended Citation 擷取
    if not data["英文名"] or len(data["英文名"]) < 3:
        # 從 Citations 解析。格式: English Name Scientific Name, version
        cite_text = data["Recommended Citation"] or soup.get_text()
        cite_match = re.search(r'\(\d{4}\)\.\s+(.*?)[A-Z][a-z]+ [a-z]+', cite_text)
        if cite_match:
            data["英文名"] = cite_match.group(1).strip()

    # 2. 抓取 HKBWS Category (類別狀態)
    cat_regex = re.compile(r'^Category\s+[I|V|X]+', re.IGNORECASE)
    cat_tag = soup.find(lambda tag: tag.name == 'p' and cat_regex.search(tag.get_text()))
    if cat_tag:
        data["HKBWS Category"] = cat_tag.get_text(strip=True)

    # 內容抓取輔助函數
    def get_section_text(headers):
        if isinstance(headers, str): headers = [headers]
        target_header = None
        for h_text in headers:
            regex = re.compile(rf"^\s*{re.escape(h_text)}\s*$", re.IGNORECASE)
            target_header = soup.find(lambda tag: tag.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'strong'] and regex.search(tag.get_text()))
            if not target_header:
                target_header = soup.find(lambda tag: tag.name == 'p' and regex.search(tag.get_text()))
            if target_header: break
        
        if not target_header: return ""
        
        paragraphs = []
        curr = target_header.find_next()
        while curr:
            if curr.name in ['h1', 'h2', 'h3', 'h4', 'h5']: break
            txt = curr.get_text(strip=True)
            if (curr.name == 'p' or curr.name == 'strong') and txt.isupper() and len(txt) > 3:
                keywords = ["DISTRIBUTION", "OCCURRENCE", "RANGE", "BEHAVIOUR", "CONSERVATION", "IDENTIFICATION", "REFERENCES", "VOCALISATIONS", "DIET", "BREEDING"]
                if any(k in txt for k in keywords): break
            if curr.name == 'p' and txt:
                paragraphs.append(txt)
            curr = curr.find_next()
        return "\n".join(paragraphs)

    # 3. 抓取各章節
    data["Morphological feature"] = get_section_text(["IDENTIFICATION", "MORPHOLOGY"])
    data["Breeding"] = get_section_text(["BREEDING"])
    data["Distribution & habitat preference"] = get_section_text(["DISTRIBUTION & HABITAT PREFERENCE", "DISTRIBUTION"])
    data["Occurrence"] = get_section_text(["OCCURRENCE"])
    data["Range & Systematics"] = get_section_text(["RANGE & SYSTEMATICS", "SYSTEMATICS", "RANGE"])
    data["Behaviour, Foraging & Diet"] = get_section_text(["BEHAVIOUR, FORAGING & DIET", "BEHAVIOUR"])
    data["Conservation Status"] = get_section_text(["CONSERVATION STATUS", "STATUS", "CONSERVATION"])

    # 4. References & Citation
    panels = soup.select('.sppb-panel')
    for panel in panels:
        heading = panel.select_one('.sppb-panel-heading')
        if heading:
            h_txt = heading.get_text(strip=True).upper()
            body = panel.select_one('.sppb-panel-body')
            if body:
                if "REFERENCES" in h_txt:
                    data["References"] = body.get_text("\n", strip=True)
                elif "RECOMMENDED CITATION" in h_txt:
                    data["Recommended Citation"] = body.get_text(strip=True)
    
    if not data["Recommended Citation"]:
        cite_tag = soup.find(string=re.compile(r"Carey, G\. J\. \(\d{4}\)\.", re.IGNORECASE))
        if cite_tag: data["Recommended Citation"] = cite_tag.parent.get_text(strip=True)

    return data

def get_all_species_urls():
    species_index_url = f"{BASE_URL}/species"
    soup = get_soup(species_index_url)
    if not soup: return []
    category_links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if re.search(r'/species/\d{4}$', href):
            full_url = BASE_URL + href if href.startswith('/') else href
            if full_url not in category_links: category_links.append(full_url)
    all_species_urls = []
    for cat_url in category_links:
        print(f"Exploring category: {cat_url}")
        cat_soup = get_soup(cat_url)
        if not cat_soup: continue
        for a in cat_soup.find_all('a', href=True):
            href = a['href']
            if re.search(r'/species/\d{4}/\d{6}$', href):
                full_url = BASE_URL + href if href.startswith('/') else href
                if full_url not in all_species_urls: all_species_urls.append(full_url)
        time.sleep(0.5)
    print(f"Found total {len(all_species_urls)} species.")
    return all_species_urls

def main():
    urls = get_all_species_urls()
    if not urls: return
    # 清理舊資料
    for f in ["hkbws_species.csv", "hkbws_species_partial.csv"]:
        if os.path.exists(f): os.remove(f)
    results = []
    for i, url in enumerate(urls):
        try:
            item = parse_species_page(url)
            if item: results.append(item)
            if (i + 1) % 20 == 0:
                pd.DataFrame(results).to_csv("hkbws_species_partial.csv", index=False, encoding='utf-8-sig')
                print(f"Progress saved: {i+1}/{len(urls)}")
            time.sleep(1.2)
        except Exception as e:
            print(f"Error processing {url}: {e}")
    pd.DataFrame(results).to_csv("hkbws_species.csv", index=False, encoding='utf-8-sig')
    print("Export Complete: hkbws_species.csv")

if __name__ == "__main__":
    main()
