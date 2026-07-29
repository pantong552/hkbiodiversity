import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

USERNAME = "pantong"
PASSWORD = "P@ss93681816"
LOGIN_URL = "https://secure.birds.cornell.edu/cassso/login?service=https%3A%2F%2Febird.org%2Flogin%2Fcas%3Fportal%3Debird&locale=zh_TW"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
})

print("[1/3] 正在獲取登入頁面並自動提取所有 hidden 欄位...")
resp_get = session.get(LOGIN_URL)
soup = BeautifulSoup(resp_get.text, 'html.parser')

# 1. 找到登入表單
form = soup.find('form')
if not form:
    print("❌ 找不到登入表單，請檢查 URL 或網路連線！")
    exit(1)

# 2. 自動提取所有隱藏欄位
payload = {}
for hidden_input in form.find_all('input', {'type': 'hidden'}):
    name = hidden_input.get('name')
    val = hidden_input.get('value', '')
    if name:
        payload[name] = val

print(f"✅ 成功擷取到 {len(payload)} 個 Hidden 隱藏欄位（包含 execution）")

# 3. 填入帳號密碼
payload['username'] = USERNAME
payload['password'] = PASSWORD

# 4. 處理 Target POST URL (使用 urljoin 拼接相對路徑)
action = form.get('action')
if action and action != '#':
    post_url = urljoin(LOGIN_URL, action)
else:
    post_url = LOGIN_URL

print(f"👉 POST 目標網址: {post_url}")

headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://secure.birds.cornell.edu",
    "Referer": LOGIN_URL,
}

print("[2/3] 發送 POST 登入請求...")
login_response = session.post(post_url, data=payload, headers=headers, allow_redirects=True)

print("[3/3] 檢查登入結果...")

# 5. 印出所有 Cookie (包含跨網域跨 Path)
print("\n---------------- 所有 Cookie 列表 ----------------")
ebird_session_id = None
for cookie in session.cookies:
    print(f"網域: {cookie.domain} | 名字: {cookie.name} = {cookie.value}")
    if cookie.name == "EBIRD_SESSIONID":
        ebird_session_id = cookie.value
print("--------------------------------------------------\n")

if ebird_session_id:
    print("🎉 登入成功！")
    print(f"EBIRD_SESSIONID = {ebird_session_id}")
else:
    print("❌ 登入失敗：未取得 EBIRD_SESSIONID。")
    with open("debug_response.html", "w", encoding="utf-8") as f:
        f.write(login_response.text)
    print("💡 已將 response 儲存至 debug_response.html，請查看詳細內容。")