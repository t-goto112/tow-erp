import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('Checking order_items table structure...');
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching order_items:', error.message);
    if (error.message.includes('shipped_quantity')) {
      console.log('CONFIRMED: shipped_quantity column is missing in the database.');
    }
  } else if (data && data.length > 0) {
    console.log('Columns found in order_items:', Object.keys(data[0]));
  } else {
    console.log('Table is empty, trying to fetch schema info...');
    // Try to insert a dummy row or check metadata if possible
    const { data: cols, error: colErr } = await supabase
      .rpc('get_table_columns', { table_name_input: 'order_items' }); // This might not exist
    
    if (colErr) {
        // Fallback: try selecting a specific column to see if it exists
        const { error: qtyErr } = await supabase.from('order_items').select('shipped_quantity').limit(1);
        if (qtyErr) console.log('shipped_quantity DOES NOT exist:', qtyErr.message);
        else console.log('shipped_quantity EXISTS');

        const { error: shippedErr } = await supabase.from('order_items').select('shipped').limit(1);
        if (shippedErr) console.log('shipped DOES NOT exist');
        else console.log('shipped EXISTS');
    }
  }
}

checkSchema().catch(console.error);
