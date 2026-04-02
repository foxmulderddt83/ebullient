
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }
  console.log('Categories:', JSON.stringify(data, null, 2));
  
  const { data: pkgs, error: pkgError } = await supabase.from('packages').select('name, price, category_id').eq('is_active', true);
  if (pkgError) {
    console.error('Error fetching packages:', pkgError);
    return;
  }
  console.log('Packages:', JSON.stringify(pkgs, null, 2));
}

checkCategories();
