import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log("1. Creating order...");
        const { data: orderData, error: orderErr } = await supabase
            .from('orders')
            .insert([{
                order_number: 'TEST-' + Date.now(),
                customer_name: 'Test',
                channel: 'wholesale',
                due_date: '2026-12-31',
                status: 'pending'
            }])
            .select().single();
        if (orderErr) throw orderErr;
        console.log("Order created:", orderData.id);

        console.log("2. Fetching product...");
        const { data: prodData, error: pErr } = await supabase
            .from('products')
            .select('id, name').limit(1).single();
        if (pErr) throw pErr;
        console.log("Product:", prodData.name);

        console.log("3. Creating order_item...");
        const { data: itemData, error: iErr } = await supabase
            .from('order_items')
            .insert([{
                order_id: orderData.id,
                product_id: prodData.id,
                quantity: 10,
                unit_price: 100,
                shipped_quantity: 0
            }])
            .select().single();
        if (iErr) throw iErr;
        console.log("Order item created:", itemData.id);

        console.log("4. Creating lot...");
        const { data: lotData, error: lotErr } = await supabase
            .from('lots')
            .insert([{
                lot_number: 'LOT-TEST-' + Date.now(),
                product_id: prodData.id,
                quantity: 10,
                order_item_id: itemData.id,
                status: 'created'
            }])
            .select().single();
        if (lotErr) throw lotErr;
        console.log("Lot created:", lotData.id);

        console.log("5. Fetching processes...");
        const { data: templates } = await supabase
            .from('processes').select('*').eq('product_id', prodData.id);
        
        if (templates && templates.length > 0) {
            console.log(`Found ${templates.length} templates. Inserting lot_processes...`);
            const processesToInsert = [];
            for (const t of templates) {
                processesToInsert.push({
                    lot_id: lotData.id,
                    process_id: t.id,
                    subcontractor_id: null,
                    status: 'pending',
                    input_quantity: 0
                });
            }
            const { error: lpErr } = await supabase
                .from('lot_processes')
                .insert(processesToInsert);
            if (lpErr) throw lpErr;
            console.log("Lot processes created successfully!");
        } else {
            console.log("No process templates found for product.");
        }

        // Cleanup
        console.log("Cleaning up test data...");
        await supabase.from('orders').delete().eq('id', orderData.id);
        console.log("Done.");

    } catch (e) {
        console.error("ERROR:", e);
    }
}
run();
