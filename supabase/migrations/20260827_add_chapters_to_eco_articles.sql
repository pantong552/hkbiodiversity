-- ==============================================================================
-- Migration: Add Chapter Support for Eco-Creative Novel Category in Eco-Articles
-- ==============================================================================

-- 1. 為 eco_articles 表加入章節編號 (chapter_number) 與章節標題 (chapter_title_chi, chapter_title_eng)
DO $$ 
BEGIN 
  -- 章節編號 (例如：1、2、1.5 或特定序號)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='eco_articles' AND column_name='chapter_number'
  ) THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_number INT;
  END IF;

  -- 中文章節標題 (例如：第1章 仲夏之聲)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='eco_articles' AND column_name='chapter_title_chi'
  ) THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_title_chi TEXT;
  END IF;

  -- 英文章節標題 (例如：Chapter 1: Midsummer Voice)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='eco_articles' AND column_name='chapter_title_eng'
  ) THEN
    ALTER TABLE eco_articles ADD COLUMN chapter_title_eng TEXT;
  END IF;
END $$;

-- 2. 為小說章節排序建立複合索引，提升長篇小說目錄與章節查詢效能
CREATE INDEX IF NOT EXISTS idx_eco_articles_category_chapter 
ON eco_articles (category_id, chapter_number ASC NULLS LAST);
