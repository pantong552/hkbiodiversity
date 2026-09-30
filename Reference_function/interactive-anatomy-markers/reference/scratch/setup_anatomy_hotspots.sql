-- Supabase 獨立 Table 建立與資料寫入 SQL (自動產生)
-- 包含 25 個物種的 互動式外形特徵 (Anatomy Hotspots) 定位與中英文內容

BEGIN;

-- 1. 建立外形特徵熱點主表
CREATE TABLE IF NOT EXISTS public.species_anatomy_hotspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id UUID REFERENCES public.species(id) ON DELETE CASCADE NOT NULL,
    hotspot_key VARCHAR(50) NOT NULL,
    x_percent NUMERIC(5,2) NOT NULL,
    y_percent NUMERIC(5,2) NOT NULL,
    placement VARCHAR(30) DEFAULT 'top' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(species_id, hotspot_key)
);

-- 2. 建立外形特徵熱點翻譯表
CREATE TABLE IF NOT EXISTS public.species_anatomy_hotspot_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotspot_id UUID REFERENCES public.species_anatomy_hotspots(id) ON DELETE CASCADE NOT NULL,
    lang VARCHAR(5) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(hotspot_id, lang)
);

-- 3. 啟用安全存取控制 (Row Level Security - RLS)
ALTER TABLE public.species_anatomy_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_anatomy_hotspot_translations ENABLE ROW LEVEL SECURITY;

-- 4. 允許公開讀取政策 (Select Policies for all roles, including anon & authenticated)
DROP POLICY IF EXISTS "Allow public read species_anatomy_hotspots" ON public.species_anatomy_hotspots;
CREATE POLICY "Allow public read species_anatomy_hotspots" ON public.species_anatomy_hotspots FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public read species_anatomy_hotspot_translations" ON public.species_anatomy_hotspot_translations;
CREATE POLICY "Allow public read species_anatomy_hotspot_translations" ON public.species_anatomy_hotspot_translations FOR SELECT TO public USING (true);

-- 5. 允許所有操作 (All operations for all roles to support saving in admin panel)
DROP POLICY IF EXISTS "Allow all operations for public species_anatomy_hotspots" ON public.species_anatomy_hotspots;
CREATE POLICY "Allow all operations for public species_anatomy_hotspots" ON public.species_anatomy_hotspots FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for public species_anatomy_hotspot_translations" ON public.species_anatomy_hotspot_translations;
CREATE POLICY "Allow all operations for public species_anatomy_hotspot_translations" ON public.species_anatomy_hotspot_translations FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. 批次寫入資料 (使用 DO 區塊動態尋找 species_id 並插入)

-- 物種 cnephaeus_pachyomus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'cnephaeus_pachyomus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 55, 10, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈灰棕至深棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur varies from<br />gray-brown to dark brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 34, 54, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛呈淺黃褐色至灰白/黃白色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral fur varies from light yellow-brown<br />to gray-white/yellow-white</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 24, 46, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏呈姆指狀<br />頂端圓鈍</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Thumb-shpaed tragus with<br />rounded and blunt tip</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 7, 33, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻及臉部呈深褐色<br />兩側脹大有腺體</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dark brown muzzle with<br />prominent lateral sweeling</p>');

    END IF;
END $$;

-- 物種 cynopterus_sphinx 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'cynopterus_sphinx';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 76, 57, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>暗粉紅色指骨</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 40, 65, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部較短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short snout</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 65, 87, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>白色耳緣</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>White ear edge</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 59, 27, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>尾巴極短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Extreme short tail</p>');

    END IF;
END $$;

-- 物種 hipposideros_armiger 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'hipposideros_armiger';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 37, 60, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛呈棕色或灰棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Pelage is brown or gray-brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 19, 75, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '耳殼闊大，內側具多條橫坑紋<br>耳端略尖');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Broad ear pinna with pointed tip and<br />multiple transverse ridges</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 49, 80, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>較複雜的鼻葉</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Complex noseleaf</p>');

    END IF;
END $$;

-- 物種 hipposideros_gentilis 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'hipposideros_gentilis';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 47, 54, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛呈棕色或灰棕色，腹毛較淺色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal pelage ranges from<br />brown to gray-brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 53, 77, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>前葉呈馬蹄狀，闊度大於長度</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Anterior leaf is wider than long<br />(Horseshow shape)</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 24, 78, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼闊大，內側具多條橫坑紋</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Broad and pointed ear pinna<br />with multiple transverse ridges</p>');

    END IF;
END $$;

-- 物種 hypsugo_pulveratus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'hypsugo_pulveratus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 61, 31, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛較長，呈灰黑色，毛尖略呈金黃褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal pelage is relatively long and gray-black with  light golden-brown tips</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 20, 24, 'top-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>鼻吻部呈灰黑色，眼睛相對圓大</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Muzzle: dark gray to black<br>
Eyes: relatively larger');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 42, 40, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼修長，耳緣稍微泛白，耳屏短寬</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Ear pinna: slender with slight white edge<br>
Tragus: wide and short');

    END IF;
END $$;

-- 物種 miniopterus_fuliginosus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'miniopterus_fuliginosus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 57, 17, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈均勻的深灰或深褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is uniform dark gray or dark brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 24, 8, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頭顱很高</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Skull is highly elevated</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 34, 25, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼圓短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ear pinna is short and round</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 25, 46, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部寬短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle is wide and short</p>');

    END IF;
END $$;

-- 物種 miniopterus_magnater 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'miniopterus_magnater';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 54, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈均勻的深灰或深褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is uniform dark gray or dark brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 15, 12, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頭顱很高</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Skull is highly elevated</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 32, 15, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼圓短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ear pinna is short and round</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 17, 46, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部寬短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle is wide and short</p>');

    END IF;
END $$;

-- 物種 miniopterus_pusillus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'miniopterus_pusillus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 44, 11, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈均勻的深灰或深褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is uniform dark gray or dark brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 13, 28, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頭顱很高</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Skull is highly elevated</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 25, 39, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼圓短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ear pinna is short and round</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 17, 65, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部寬短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle is wide and short</p>');

    END IF;
END $$;

-- 物種 mops_plicatus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'mops_plicatus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 45, 19, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈均勻的暗褐色或灰黑色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Dorsal fur is uniform<br>dark brown or grayish-black');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 22, 15, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼寬厚，向前突出<br />雙耳前基部在額部以狹皮層相連</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Broad and thick pinnae, projecting forward;<br />connected with a skin fold across the forehead</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 17, 40, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '鼻部突出<br>上唇肥厚且具縱行皺褶');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Nostrils are slightly protruded;<br> Upper lip is well developed and wrinkled');

        -- 點位 e6efd31
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'e6efd31', 65, 51, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '尾長約體長的一半，粗壯無毛<br>一半以上從股間膜穿出');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Tail is ~1/2 the body length, thick and hairless,<br>with >1/2 protruding from the uropatagium');

    END IF;
END $$;

-- 物種 myotis_chinensis 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'myotis_chinensis';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 54, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛為深灰棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dark brownish-gray dorsal fur</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 14, 24, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部及臉部呈深褐色<br />且具深灰色短毛</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle and face are dark brown<br />with short dark gray fur</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 30, 33, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏細長呈錐形</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Elongated and conical tragus</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 80, 72, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>後足大<br />爪有色素</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Large hind feet<br />with pigmented claws</p>');

        -- 點位 26f763a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '26f763a', 33, 56, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛呈淺灰至灰白色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral fur varies from<br />pale gray to grayish-white</p>');

    END IF;
END $$;

-- 物種 myotis_horsfieldii 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'myotis_horsfieldii';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 56, 25, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈斑駁的深灰棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is mottled dark gray-brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 40, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼前緣呈曲線圓弧狀，<br />前後緣上段輕微收窄</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Anterior edge of the ear pinna forms<br />a curved arc, slightly narrowing towards the tip.</p>');

        -- 點位 3817ac7
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '3817ac7', 30, 39, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏細長尖狹</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Slender, elongated and narrow tragus</p>');

        -- 點位 f5f113e
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f5f113e', 79, 75, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>後足頗大，趾具稀疏長毛，<br />翼膜連接至足趾基部</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Large hind feet with haired toes.<br />Wing membranes attach to the base of toes.</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 60, 65, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛呈灰白色至深灰色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral fur ranges from gray-white to dark gray</p>');

    END IF;
END $$;

-- 物種 myotis_muricola 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'myotis_muricola';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 53, 25, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈均勻的深棕或黑棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal pelage is uniform dark brown or blackish-brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 32, 17, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼修長，上段明顯收窄，後緣缺刻明顯</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>The ear pinnae are elongated, with the upper portion noticeably narrowing and a distinct notch at posterior edge.</p>');

        -- 點位 3817ac7
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '3817ac7', 33, 39, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏細長呈錐形，基部較闊</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Tragus are slender and conical, broader at the base</p>');

        -- 點位 f5f113e
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f5f113e', 80, 66, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>翼膜連接至足趾基部1mm以上位置</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Wing membranes connect to the base of the toes by at least 1mm</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 27, 53, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛顏色較淺，呈灰白色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral pelage is gray-white</p>');

    END IF;
END $$;

-- 物種 myotis_pilosus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'myotis_pilosus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 55, 22, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈淺灰棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Light gray-brown dorsal fur</p>');

        -- 點位 26f763a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '26f763a', 27, 52, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛呈灰白色至白色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Grayish-white to white ventral fur</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 14, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>臉頰呈粉紅色，<br />長有鬍鬚</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle and face appear pink<br />with whiskers</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 25, 36, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏細長尖狹</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Slender and pointed tragus</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 74, 66, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>後足特大，<br />爪尖銳彎曲，呈白色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Exceptionally large hind feet<br />with white claws</p>');

    END IF;
END $$;

-- 物種 nyctalus_plancyi 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'nyctalus_plancyi';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 54, 17, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛長而貼伏，具光釋<br />呈暗褐或褐棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Pelage is long and glossy<br />(Dark brown or reddish-brown)</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 20, 54, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部兩側明顯脹大有腺體</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short snout with<br />prominent lateral swellings</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 30, 13, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼短寬，耳端圓潤<br />後緣闊大且延伸至口角</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short and wide ear pinna with rounded tip<br />Posterior edge extends to the mouth corner</p>');

        -- 點位 398a597
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '398a597', 32, 38, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏短闊，<br />似橫置的腎型</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short and broad tragus<br />(horizontally kidney-shaped)</p>');

        -- 點位 44a483f
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '44a483f', 79, 60, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>翼膜連接至足踝</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Wing membrane attached to ankles</p>');

    END IF;
END $$;

-- 物種 pipistrellus_abramus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'pipistrellus_abramus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 54, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈灰褐/灰橄欖色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur appears as gray-brown/gray-olive</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 11, 30, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部呈棕色，<br />兩側略顯膨大有腺體</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Brown muzzle with slight lateral swelling</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 29, 39, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏短窄，呈拇指型</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short and narrow tragus<br />(thumb-shape)</p>');

        -- 點位 26f763a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '26f763a', 81, 61, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>翼膜連接至趾基</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Wing membrane connecting to<br />the base of toes</p>');

    END IF;
END $$;

-- 物種 pipistrellus_ceylonicus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'pipistrellus_ceylonicus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 55, 11, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈灰棕至深棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is grayish-brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 51, 63, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛呈淺灰棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral fur is light grayish-brown</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 30, 33, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏呈短闊姆指狀<br />頂端明顯向前突出</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Tragus short and broad<br>The tip projecting prominently forward');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 13, 27, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻及臉部呈暗褐色<br />兩側脹大有腺體</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dark brown muzzle<br />with prominently lateral swelling</p>');

    END IF;
END $$;

-- 物種 pipistrellus_tenuis 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'pipistrellus_tenuis';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 51, 8, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛呈均勻的啡褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Uniform reddish-brown pelage</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 34, 22, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼及耳屏深棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dark brown pinna and tragus</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 13, 28, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部兩側腺體腫脹</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle with prominent lateral swellings</p>');

    END IF;
END $$;

-- 物種 rhinolophus_affinis 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'rhinolophus_affinis';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 42, 49, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈褐黃至深棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal pelage varies from brownish-yellow to dark brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 15, 70, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頂葉呈尖長三角形，兩側凹陷，頂端尖銳向前微曲</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Long triangular lancet with a pointed and slightly bending forward tip and concave edges</p>');

    END IF;
END $$;

-- 物種 rhinolophus_pusillus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'rhinolophus_pusillus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 913fd10
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '913fd10', 23, 73, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頂葉：戟狀，兩側凹陷，頂端圓鈍<br />聯接葉：側面呈尖長三角形</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Lancet is either equilateral or elongated with concave sides and a rounded apex; the connective process forms a pointed elongated triangle</p>');

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 45, 54, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈褐黃至深褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur ranges from brownish-yellow to deep brown</p>');

    END IF;
END $$;

-- 物種 rhinolophus_sinicus 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'rhinolophus_sinicus';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 15, 67, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頂葉呈相對矮小的三角形，兩側外緣凹陷</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Short triangular lancet with a pointed tip and concave outer edges</p>');

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 38, 49, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈橙色、銹黃至褐黃色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal pelage varies from orange or russet brown to buffy brown</p>');

    END IF;
END $$;

-- 物種 rousettus_leschenaultii 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'rousettus_leschenaultii';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 33, 55, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛呈灰棕或茶黃色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Uniform gray-brown to tea-yellow pelage</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 18, 74, 'top-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻部狹長</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Long and narrow snout</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 51, 82, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼及耳緣均呈深棕色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dark brown ear pinna and edge</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 59, 27, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>尾巴極短</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Extreme short tail</p>');

    END IF;
END $$;

-- 物種 scotophilus_kuhlii 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'scotophilus_kuhlii';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 21, 14, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>後頭部隆起</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Posterior region of skull swollen</p>');

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 56, 8, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛長而貼伏，<br />絲滑且帶光澤</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Pelage is long and adpressed,<br />silky and lustrous</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 35, 22, 'right')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏修長，呈月牙狀，<br />末端圓鈍且超出耳殼前緣</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Tragus is elongated and sickle-shaped,<br />curving forward and extending beyond the anterior margin of the pinna</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 26, 42, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>吻鼻部寬大，幾乎無毛，<br />兩側腺體腫脹</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Muzzle is broad and nearly hairless,<br />laterally protruding glandular swellings</p>');

    END IF;
END $$;

-- 物種 taphozous_melanopogon 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'taphozous_melanopogon';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 32, 45, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>背毛呈灰棕至棕褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Dorsal fur is grayish-brown to brown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 45, 73, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>腹毛較淡呈淺灰褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Ventral fur is light grayish-brown </p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 23, 63, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳殼略呈三角形多皺褶<br />耳屏呈斧狀</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Pinna is triangular with numerous wrinkles<br />Tragus is short and axe-shaped</p>');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 38, 23, 'bottom')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>尾於股間膜背穿出</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Tail protruded from the uropatagium</p>');

    END IF;
END $$;

-- 物種 tylonycteris_fulvida 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'tylonycteris_fulvida';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 48, 19, 'top-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '體毛短帶光澤，呈金黃色至棕黃色');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Pelage is short and glossy,<br>ranging from golden yellow to brownish-yellow.');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 22, 26, 'top-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頭顱細小扁平，鬍鬚呈金黃色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Small and flat head with<br>golden yellow whiskers');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 36, 37, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏短鈍，呈菱形</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Short and blunt tragus<br>(diamond shape)');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 11, 52, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>姆指基部有淺棕色的圓形肉墊</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Base of the thumbs has a<br>brownish pink circular pad');

        -- 點位 badfee1
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'badfee1', 80, 56, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>足部有淺棕色的梯形肉墊</p>');

    END IF;
END $$;

-- 物種 tylonycteris_tonkinensis 的互動特徵點位
DO $$
DECLARE
    v_species_id UUID;
    v_hotspot_id UUID;
BEGIN
    SELECT id INTO v_species_id FROM public.species WHERE species_code = 'tylonycteris_tonkinensis';
    IF v_species_id IS NOT NULL THEN
        -- 清除舊資料以防重複執行衝突
        DELETE FROM public.species_anatomy_hotspots WHERE species_id = v_species_id;

        -- 點位 f63711a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'f63711a', 54, 19, 'top')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>體毛短，呈褐色至深褐色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Pelage varies from brown to dark frown</p>');

        -- 點位 b023946
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'b023946', 24, 20, 'top-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>頭顱細小扁平，鬍鬚呈黑色</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Small and flat head with black whiskers</p>');

        -- 點位 296ec7b
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '296ec7b', 37, 37, 'bottom-start')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>耳屏短鈍，呈菱形</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', 'Short and blunt tragus<br>(diamond shape)');

        -- 點位 fb78ca6
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, 'fb78ca6', 29, 77, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>姆指基部有深棕色的圓形肉墊</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Base of the thumbs has a dark brown circular pad</p>');

        -- 點位 26f763a
        INSERT INTO public.species_anatomy_hotspots (species_id, hotspot_key, x_percent, y_percent, placement)
        VALUES (v_species_id, '26f763a', 77, 53, 'bottom-end')
        RETURNING id INTO v_hotspot_id;

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'zh', '<p>足掌有深棕色的梯形肉墊</p>');

        INSERT INTO public.species_anatomy_hotspot_translations (hotspot_id, lang, content)
        VALUES (v_hotspot_id, 'en', '<p>Sole of foot has a dark brown trapezoidal pad</p>');

    END IF;
END $$;

COMMIT;
