
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 手動解析 .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEncoding() {
  console.log('正在檢查數據庫 RPC 回傳數據...');
  
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_species_stats', {
    p_phylum_eng: [],
    p_class_eng: [],
    p_order_eng: [],
    p_family_eng: [],
    p_genus_eng: [],
    p_iucn: [],
    p_search: ''
  });

  if (rpcError) {
    console.error('RPC 出錯:', rpcError);
  } else {
    // 找出所有 phylum_eng 為 Arthropoda 的項目
    const arthropodaItems = rpcData?.phylum_eng?.filter((item) => item.name === 'Arthropoda');
    console.log('--- Arthropoda 原始結果 ---');
    console.log(JSON.stringify(arthropodaItems, null, 2));

    // 找出包含亂碼的任何項目
    const encodingIssues = rpcData?.phylum_eng?.filter((item) => item.chi && item.chi.includes('\ufffd'));
    console.log('--- 檢測到編碼異常的項目 ---');
    console.log(JSON.stringify(encodingIssues, null, 2));
    
    // 檢查是否還有空值的項目
    const emptyIssues = rpcData?.phylum_eng?.filter((item) => !item.chi || item.chi.trim() === '');
    console.log('--- 檢測到中文字段為空的項目 ---');
    console.log(JSON.stringify(emptyIssues, null, 2));
  }
}

checkEncoding();
