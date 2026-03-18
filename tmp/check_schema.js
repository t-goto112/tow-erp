const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log('--- Order Items Schema Diagnostic ---');
    
    // Test 1: Full select
    const { data, error } = await supabase.from('order_items').select('*').limit(1);
    if (error) {
        console.log('Error doing select *:', error.message);
    } else if (data && data.length > 0) {
        console.log('Success! Columns in order_items:', Object.keys(data[0]));
    } else {
        console.log('Table is empty. Testing specific columns...');
    }

    // Test 2: Check shipped_quantity specifically
    const { error: qtyErr } = await supabase.from('order_items').select('shipped_quantity').limit(0);
    if (qtyErr) console.log('shipped_quantity DOES NOT EXIST:', qtyErr.message);
    else console.log('shipped_quantity EXISTS');

    // Test 3: Check common alternatives
    const { error: sErr } = await supabase.from('order_items').select('shipped').limit(0);
    if (!sErr) console.log('Found legacy column: shipped');

    const { error: qErr } = await supabase.from('order_items').select('qty').limit(0);
    if (!qErr) console.log('Found legacy column: qty');
}

checkSchema().catch(console.error);
