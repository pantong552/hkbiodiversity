import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnose() {
  console.log("Checking taxonomy_mappings for special ranks...");
  
  // 檢查植物類別
  const { data: floraCats } = await supabase
    .from('taxonomy_mappings')
    .select('*')
    .eq('taxa_type', 'flora')
    .eq('rank', 'class')
    .limit(5);
  
  console.log("\n[Flora Categories (Rank: class)]");
  console.table(floraCats);

  // 檢查動物分類群
  const { data: faunaGroups } = await supabase
    .from('taxonomy_mappings')
    .select('*')
    .eq('taxa_type', 'fauna')
    .eq('rank', 'informal_group')
    .limit(5);

  console.log("\n[Fauna Taxa Groups (Rank: informal_group)]");
  console.table(faunaGroups);
}

diagnose();
