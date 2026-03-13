import { supabase } from "@/lib/supabase";
interface OrderItem {
    product: string;
    qty: number;
    unitPrice: number;
    shipped?: number;
}

export async function createSupabaseOrder(params: {
    orderNumber: string;
    customerName: string;
    channel: string;
    dueDate: string;
    status: string;
    notes: string;
    items: OrderItem[];
}) {
    // 1. Insert Order
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            order_number: params.orderNumber,
            customer_name: params.customerName,
            channel: params.channel,
            due_date: params.dueDate,
            status: params.status,
            notes: params.notes
        }])
        .select()
        .single();

    if (orderError) throw orderError;
    const orderId = orderData.id;

    try {
        // 2. Resolve Product IDs and Insert Order Items
        for (const item of params.items) {
            // Product name -> ID lookup
            const { data: prodData } = await supabase
                .from('products')
                .select('id')
                .eq('name', item.product)
                .single();

            if (!prodData) {
                throw new Error(`製品が見つかりません: ${item.product}`);
            }

            const productId = prodData.id;

            const { data: orderItemData, error: itemError } = await supabase
                .from('order_items')
                .insert([{
                    order_id: orderId,
                    product_id: productId,
                    quantity: item.qty,
                    unit_price: item.unitPrice,
                    shipped_quantity: item.shipped || 0
                }])
                .select()
                .single();

            if (itemError) throw itemError;

            // 3. Automatically create a Lot for this order item
            const lotNumber = `LOT-${params.orderNumber.replace('ORD-', '')}-${item.product}`;
            const { data: lotData, error: lotError } = await supabase
                .from('lots')
                .insert([{
                    lot_number: lotNumber,
                    product_id: productId,
                    total_quantity: item.qty,
                    status: 'created',
                    order_id: orderId
                }])
                .select()
                .single();

            if (lotError) throw lotError;

            // 4. Create initial lot processes based on Product Process definitions
            const { data: templates } = await supabase
                .from('processes')
                .select('*')
                .eq('product_id', productId)
                .order('group_index', { ascending: true })
                .order('sort_order', { ascending: true });

            if (templates && templates.length > 0) {
                const processesToInsert = templates.map((t, idx) => ({
                    lot_id: lotData.id,
                    process_id: t.id,
                    status: idx === 0 ? 'in_progress' : 'pending',
                    input_quantity: idx === 0 ? item.qty : 0,
                    completed_quantity: 0,
                    defect_quantity: 0,
                    loss_qty: 0,
                    loss_confirmed: false,
                    is_rework: false,
                    rework_charge: false
                }));

                const { error: procError } = await supabase
                    .from('lot_processes')
                    .insert(processesToInsert);

                if (procError) throw procError;
            }
        }
        return orderId;
    } catch (err) {
        console.error("Order creation failed, cleaning up header:", err);
        // Silent cleanup: delete the header if items/lots failed
        await supabase.from('orders').delete().eq('id', orderId);
        throw err;
    }
}

export async function deleteSupabaseOrder(orderId: string) {
    // Due to Supabase ON DELETE CASCADE, deleting the order should delete:
    // order_items (cascade)
    // lots (cascade) -> lot_processes (cascade) -> lot_process_deliveries (cascade), etc.
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

    if (error) throw error;
    return true;
}
