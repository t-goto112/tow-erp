import { createSupabaseOrder } from './src/lib/services/orderService.js';
import { supabase } from './src/lib/supabase.js';

// Polyfill fetch for node
import fetch from 'node-fetch';
global.fetch = fetch;

async function test() {
    try {
        console.log("Starting test order creation...");
        const result = await createSupabaseOrder({
            orderNumber: 'TEST-999',
            customerName: 'Test Customer',
            channel: 'wholesale',
            dueDate: '2026-12-31',
            status: 'pending',
            notes: 'Test notes',
            items: [
                { product: 'メインパーツA', quantity: 10, unitPrice: 100 }
            ]
        });
        console.log("Success! Order ID:", result);
        
        // Cleanup
        await supabase.from('orders').delete().eq('id', result);
        console.log("Cleaned up test order.");
    } catch (err) {
        console.error("Error creating order:", err);
    }
}

test();
