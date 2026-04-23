import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('id', 143203)
    .maybeSingle();
    
  console.log('Result for 143203:', !!data);
  if (data) {
    console.log('commonNameChi:', data.common_name_chi);
  }
}

test();
