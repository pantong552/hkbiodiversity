import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入 .env.local 檔案
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAfcd() {
  const { data, error } = await supabase
    .from('species')
    .select('id, scientific_name, common_name_chi, afcd')
    .not('afcd', 'is', null)
    .limit(10);
    
  if (error) {
    console.error('Error fauna:', error);
    return;
  }
  
  console.log('Fauna species with afcd values:');
  console.log(JSON.stringify(data, null, 2));

  const { data: plantData, error: plantError } = await supabase
    .from('plant_species')
    .select('id, scientific_name, common_name_chi, afcd')
    .not('afcd', 'is', null)
    .limit(10);

  if (plantError) {
    console.error('Plant Error:', plantError);
    return;
  }

  console.log('\nPlant species with afcd values:');
  console.log(JSON.stringify(plantData, null, 2));
}

checkAfcd();
