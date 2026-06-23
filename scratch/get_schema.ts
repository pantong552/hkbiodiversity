import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入 .env.local 檔案
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getSchema() {
  // 先嘗試拿取一筆資料以得到所有的 keys (因為有些 RLS 限制可能不允許讀 information_schema)
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Columns from one record:', Object.keys(data[0] || {}));
  }

  // 嘗試查詢 information_schema 看看是否被允許
  const { data: schemaData, error: schemaError } = await supabase
    .rpc('get_schema_info'); // 如果有此 rpc，或是直接 SQL

  if (schemaError) {
    console.log('Could not use RPC get_schema_info, trying raw sql command if possible via PostgREST is generally blocked. Let\'s print first record values to see types.');
    if (data && data[0]) {
      console.log('Record details:', data[0]);
    }
  } else {
    console.log('Schema info:', schemaData);
  }
}

getSchema();
