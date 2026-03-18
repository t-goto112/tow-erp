const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
    console.log('Testing Order Insertion...');
    
    // 1. Create a dummy order
    const orderNumber = 'TEST-' + Date.now();
    const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert([{
            order_number: orderNumber,
            customer_name: 'Debug Test',
            channel: 'wholesale',
            status: 'pending'
        }])
        .select();

    if (orderErr) {
        console.error('Order Insert Error:', orderErr);
        return;
    }

    const orderId = orderData[0].id;
    console.log('Order created with ID:', orderId);

    // 2. Fetch a valid product ID
    const { data: products } = await supabase.from('products').select('id').limit(1);
    if (!products || products.length === 0) {
        console.error('No products found to test with');
        return;
    }
    const productId = products[0].id;

    // 3. Try to insert order item
    console.log('Testing Order Item Insertion (shipped_quantity)...');
    const { data: itemData, error: itemErr } = await supabase
        .from('order_items')
        .insert([{
            order_id: orderId,
            product_id: productId,
            quantity: 10,
            unit_price: 100,
            shipped_quantity: 0
        }]);

    if (itemErr) {
        console.log('ITEM INSERT FAILED:');
        console.log(JSON.stringify(itemErr, null, 2));
    } else {
        console.log('ITEM INSERT SUCCESSFUL!');
    }
    
    // Cleanup
    await supabase.from('orders').delete().eq('id', orderId);
}

testInsert().catch(console.error);
