-- 1. 生態誌分類表 (eco_categories)
CREATE TABLE IF NOT EXISTS eco_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_chi TEXT NOT NULL,
  name_eng TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description_chi TEXT,
  description_eng TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 生態誌文章表 (eco_articles)
CREATE TABLE IF NOT EXISTS eco_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES eco_categories(id) ON DELETE RESTRICT,
  article_language TEXT DEFAULT 'bilingual' CHECK (article_language IN ('zh', 'en', 'bilingual')),
  title_chi TEXT NOT NULL DEFAULT '',
  title_eng TEXT NOT NULL DEFAULT '',
  summary_chi TEXT,
  summary_eng TEXT,
  content_chi TEXT NOT NULL DEFAULT '',
  content_eng TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'published', 'rejected', 'draft')),
  rejection_reason TEXT,
  rejection_history JSONB DEFAULT '[]'::jsonb,
  views INT DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 若資料表已存在，確保補上 article_language、rejection_reason 與 rejection_history 欄位
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='article_language') THEN
    ALTER TABLE eco_articles ADD COLUMN article_language TEXT DEFAULT 'bilingual' CHECK (article_language IN ('zh', 'en', 'bilingual'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='rejection_reason') THEN
    ALTER TABLE eco_articles ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='rejection_history') THEN
    ALTER TABLE eco_articles ADD COLUMN rejection_history JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='last_edited_by_name') THEN
    ALTER TABLE eco_articles ADD COLUMN last_edited_by_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='chapter_number') THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_number INT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='chapter_title_chi') THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_title_chi TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eco_articles' AND column_name='chapter_title_eng') THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_title_eng TEXT;
  END IF;
END $$;

-- 預設分類預填數據
INSERT INTO eco_categories (name_chi, name_eng, slug, sort_order) VALUES
('生境保育', 'Habitat Conservation', 'habitat-conservation', 1),
('物種保育', 'Species Conservation', 'species-conservation', 2),
('新物種發現', 'New Species Discovery', 'new-species-discovery', 3),
('生態文創', 'Eco-Creative', 'eco-creative', 4)
ON CONFLICT (slug) DO NOTHING;

-- 預填 3 篇 Demo 文章 (動態從 eco_categories 依 slug 獲取 category_id)
INSERT INTO eco_articles (
  id,
  category_id,
  article_language,
  title_chi,
  title_eng,
  summary_chi,
  summary_eng,
  content_chi,
  content_eng,
  cover_image,
  tags,
  status,
  views,
  published_at
) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  (SELECT id FROM eco_categories WHERE slug = 'habitat-conservation' LIMIT 1),
  'bilingual',
  '米埔及后海灣濕地候鳥遷徙與全球保育挑戰',
  'Migratory Waterbirds and Conservation Challenges at Mai Po Wetland',
  '每年數以萬計的遷徙水鳥停歇於香港米埔濕地。本文深度探討后海灣泥灘的生境維護與國際東亞-澳大利西亞遷飛區保育計畫。',
  'Every year tens of thousands of migratory waterbirds rest at Mai Po. This article delves into habitat management and East Asian-Australasian Flyway network initiatives.',
  '# 米埔及后海灣濕地候鳥遷徙與全球保育挑戰\n\n香港米埔及后海灣內灣濕地是**東亞—澳大利西亞遷飛區（EAAF）**上極其關鍵的中途站與越冬地。每年春秋兩季，超過 50,000 隻候鳥棲息於這片由紅樹林、基圍魚塘及潮間帶泥灘構成的珍貴生態系統。\n\n## 1. 生態價值與棲息地多樣性\n\n米埔擁有香港最大型的**紅樹林濕地**，並與傳統基圍養蝦塘相結合。這種人工與自然交融的生境，為各類水鳥提供了豐富的食糧來源，包括鉸絲蝦、底棲無脊椎動物及小魚。\n\n> "保護米埔不僅是維護香港的自然遺產，更是履行國際生物多樣性公約的重要責任。"\n\n### 主要保育觀察項目：\n- **黑臉琵鷺 (Black-faced Spoonbill)**: 每年約有全球數量 15%-20% 的黑臉琵鷺在此越冬。\n- **反嘴鷸 (Avocet) 與彎嘴濱鷸**: 泥灘退潮時的主要覓食者。\n\n## 2. 當前威脅與管理策略\n\n近年面對海平面上升、深圳河泥沙淤積以及周邊城市化發展，濕地保育面臨全新考驗。世界自然基金會香港分會（WWF-HK）與政府部門持續進行基圍水位調控及植被管理，確保水鳥能獲得充足的露天泥灘區覓食。\n\n---\n*歡迎關注香港生物多樣性匯誌，獲取更多第一手保育現場報導。*',
  '# Migratory Waterbirds and Conservation Challenges at Mai Po Wetland\n\nThe Mai Po and Inner Deep Bay wetlands in Hong Kong serve as a crucial staging site and wintering ground along the **East Asian-Australasian Flyway (EAAF)**.\n\n## 1. Ecological Importance\n\nMai Po features Hong Kong largest **mangrove ecosystem** integrated with traditional *Gei Wai* tidal shrimp ponds. This habitat provides rich feeding grounds for over 50,000 migratory waterbirds every year.\n\n> "Protecting Mai Po is essential for maintaining global biodiversity along international flyways."\n\n### Key Species Highlights:\n- **Black-faced Spoonbill**: Hosting up to 15-20% of the world population during winter.\n- **Pied Avocet & Curlew Sandpiper**: Feeding along exposed mudflats during low tides.\n\n## 2. Management Strategies\n\nConservation teams actively manage water levels in Gei Wai ponds and control vegetation succession to maintain optimal mudflat areas for migratory shorebirds.',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
  ARRAY['米埔', '水鳥保育', '濕地生態', 'Wetland', 'Migratory Birds'],
  'published',
  142,
  NOW() - INTERVAL '2 days'
),
(
  'a1000000-0000-0000-0000-000000000002',
  (SELECT id FROM eco_categories WHERE slug = 'species-conservation' LIMIT 1),
  'zh',
  '瀕危物種黑臉琵鷺的全港同步調查與族群動態分析',
  '',
  '最新全港黑臉琵鷺同步調查數據顯示，全球保護行動初見成效，但棲息地質量的維持仍是長遠課題。',
  '',
  '# 瀕危物種黑臉琵鷺的全港同步調查與族群動態分析\n\n黑臉琵鷺（*Platalea minor*）是全球極受關注的瀕危鳥類之一。每年冬季，香港觀鳥會（HKBWS）均會協調進行國際黑臉琵鷺同步調查。\n\n## 調查結果亮點\n1. **數量穩中有升**：全球總數已突破 6,000 隻大關。\n2. **香港越冬族群**：在后海灣紀錄到超過 300 隻穩定個體。\n3. **面臨挑戰**：周邊沿海濕地開發導致部分中途站生境面積縮減。\n\n> 透過跨國科學研究與衛星追蹤，保育團隊能夠更精確地定位黑臉琵鷺的繁殖地與遷徙路線。',
  '',
  'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80',
  ARRAY['黑臉琵鷺', '鳥類調查', '物種保育'],
  'published',
  89,
  NOW() - INTERVAL '5 days'
),
(
  'a1000000-0000-0000-0000-000000000003',
  (SELECT id FROM eco_categories WHERE slug = 'new-species-discovery' LIMIT 1),
  'en',
  '',
  'Discovery of New Endemic Firefly Species in Hong Kong Country Parks',
  '',
  'Entomologists in Hong Kong have documented a new nocturnal firefly species featuring unique bioluminescent flash patterns during field surveys in Tai Mo Shan.',
  '',
  '# Discovery of New Endemic Firefly Species in Hong Kong Country Parks\n\nRecent nocturnal field surveys in **Tai Mo Shan Country Park** led to the discovery of a new species of firefly unique to Hong Kong streamside habitats.\n\n## Key Characteristics\n- **Unique Flash Rhythm**: Distinct green bioluminescent pulses during mating display.\n- **Habitat Preference**: Clean, unpolluted mountain stream valleys with lush riparian vegetation.\n\n> "This discovery highlights the unrecorded biodiversity hiding within Hong Kong protected country parks."',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
  ARRAY['Firefly', 'New Species', 'Tai Mo Shan', 'Entomology'],
  'published',
  210,
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO UPDATE SET
  title_chi = EXCLUDED.title_chi,
  title_eng = EXCLUDED.title_eng,
  article_language = EXCLUDED.article_language,
  content_chi = EXCLUDED.content_chi,
  content_eng = EXCLUDED.content_eng;

-- RLS 權限啟用與 Policy 設定
ALTER TABLE eco_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco_articles ENABLE ROW LEVEL SECURITY;

-- 任何人可讀取分類
DROP POLICY IF EXISTS "Public categories are viewable by everyone" ON eco_categories;
CREATE POLICY "Public categories are viewable by everyone" ON eco_categories FOR SELECT USING (true);

-- Admin 可管理分類
DROP POLICY IF EXISTS "Admins can manage categories" ON eco_categories;
CREATE POLICY "Admins can manage categories" ON eco_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Public 可讀取已發布文章，作者可讀取自己文章，Admin 可讀取所有文章
DROP POLICY IF EXISTS "Published articles viewable by everyone" ON eco_articles;
CREATE POLICY "Published articles viewable by everyone" ON eco_articles FOR SELECT USING (
  status = 'published' OR 
  author_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 登入用戶可建立文章 (submitted 狀態)
DROP POLICY IF EXISTS "Authenticated users can insert articles" ON eco_articles;
CREATE POLICY "Authenticated users can insert articles" ON eco_articles FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND author_id = auth.uid()
);

-- 作者可編輯自己未發布/審核中的文章，Admin 可編輯所有文章
DROP POLICY IF EXISTS "Authors or admins can update articles" ON eco_articles;
CREATE POLICY "Authors or admins can update articles" ON eco_articles FOR UPDATE USING (
  (author_id = auth.uid() AND status != 'published') OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 作者可刪除自己的文章，Admin 可刪除任何文章
DROP POLICY IF EXISTS "Admins can delete articles" ON eco_articles;
DROP POLICY IF EXISTS "Authors or admins can delete articles" ON eco_articles;
CREATE POLICY "Authors or admins can delete articles" ON eco_articles FOR DELETE USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
