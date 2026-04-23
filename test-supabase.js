import { supabase } from './src/lib/supabase.js';

async function test() {
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('id', 143203)
    .maybeSingle();
    
  console.log('Result:', data);
  console.log('Error:', error);
}

test();
