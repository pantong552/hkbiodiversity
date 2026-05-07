import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testRPC(name, params) {
  console.log(`Testing RPC: ${name}...`);
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    console.error(`Error in ${name}:`, error);
  } else {
    console.log(`Success in ${name}:`, Object.keys(data));
  }
}

async function main() {
  // Test get_species_stats
  await testRPC('get_species_stats', {});
  
  // Test get_plant_stats
  await testRPC('get_plant_stats', {});
  
  // Test get_fauna_table_metadata
  await testRPC('get_fauna_table_metadata', { p_search: '' });
  
  // Test get_flora_table_metadata
  await testRPC('get_flora_table_metadata', { p_search: '' });
}

main();
