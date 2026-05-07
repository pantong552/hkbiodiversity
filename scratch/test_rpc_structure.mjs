import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testStats() {
  console.log("Testing get_plant_stats RPC structure...");
  const { data, error } = await supabase.rpc('get_plant_stats', {});
  if (error) {
    console.error(error);
    return;
  }

  if (data.categories && data.categories.length > 0) {
    console.log("\nFirst category record:");
    console.log(data.categories[0]);
  } else {
    console.log("\nNo categories returned from RPC.");
  }
  
  console.log("\nTesting get_species_stats (informal_group) structure...");
  const { data: faunaData } = await supabase.rpc('get_species_stats', {});
  if (faunaData.informal_group_eng && faunaData.informal_group_eng.length > 0) {
    console.log("\nFirst informal_group record:");
    console.log(faunaData.informal_group_eng[0]);
  }
}

testStats();
