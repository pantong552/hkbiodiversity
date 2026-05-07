
import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const ranks = ['phylum', 'class', 'order', 'family', 'genus'];
  const faunaMappings = {};
  const floraMappings = {};

  console.log('Analyzing Species (Fauna)...');
  const { data: species, error: speciesError } = await supabase
    .from('species')
    .select('phylum_eng, phylum_chi, class_eng, class_chi, order_eng, order_chi, family_eng, family_chi, genus_eng, genus_chi');

  if (speciesError) {
    console.error('Error fetching species:', speciesError);
  } else {
    species.forEach(s => {
      ranks.forEach(rank => {
        const eng = s[`${rank}_eng`];
        const chi = s[`${rank}_chi`];
        if (eng && chi) {
          if (!faunaMappings[rank]) faunaMappings[rank] = new Map();
          faunaMappings[rank].set(eng, chi);
        }
      });
    });
  }

  console.log('Analyzing Plant Species (Flora)...');
  const { data: plants, error: plantsError } = await supabase
    .from('plant_species')
    .select('family_eng, family_chi, genus_eng, genus_chi');

  if (plantsError) {
    console.error('Error fetching plants:', plantsError);
  } else {
    plants.forEach(p => {
      ['family', 'genus'].forEach(rank => {
        const eng = p[`${rank}_eng`];
        const chi = p[`${rank}_chi`];
        if (eng && chi) {
          if (!floraMappings[rank]) floraMappings[rank] = new Map();
          floraMappings[rank].set(eng, chi);
        }
      });
    });
  }

  console.log('\n--- Fauna Mappings Count ---');
  ranks.forEach(rank => {
    console.log(`${rank}: ${faunaMappings[rank]?.size || 0}`);
  });

  console.log('\n--- Flora Mappings Count ---');
  ['family', 'genus'].forEach(rank => {
    console.log(`${rank}: ${floraMappings[rank]?.size || 0}`);
  });

  // Check for inconsistencies
  console.log('\n--- Inconsistencies (same ENG, different CHI) ---');
  // (In a real scenario I'd check this, but for now let's just see counts)
}

analyze();
