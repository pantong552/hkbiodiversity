-- 重新命名 comments 表中的 inat_id 欄位為 taxa_id，並更改類型為 text
ALTER TABLE public.comments RENAME COLUMN inat_id TO taxa_id;

-- 更改類型從 bigint/int 為 text 以支援 fauna_ / flora_ 前綴
ALTER TABLE public.comments ALTER COLUMN taxa_id TYPE text;

-- 增加註解以利讀取具體意義
COMMENT ON COLUMN public.comments.taxa_id IS '物種唯一識別碼 (例如: fauna_21, flora_105)';
