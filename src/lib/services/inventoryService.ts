import { supabase } from "@/lib/supabase";

export async function adjustInventory(itemId: string, adjustment: number, reason: string, productId?: string) {
    // 1. 現在の在庫を取得
    const { data: current, error: getErr } = await supabase
        .from('inventory')
        .select('quantity, product_id')
        .eq('id', itemId)
        .single();
    
    if (getErr) throw getErr;

    const newQuantity = Number(current.quantity) + adjustment;

    // 2. 在庫を更新
    const { error: updErr } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', itemId);

    if (updErr) throw updErr;

    // 3. 売上連動 (理由が「販売・発送」かつ数量減少の場合)
    if (reason === "販売・発送" && adjustment < 0 && productId) {
        const qtyToReduce = Math.abs(adjustment);
        
        // 未完了の受注明細を取得 (最古のものから)
        const { data: items } = await supabase
            .from('order_items')
            .select('*, orders!inner(status, created_at)')
            .eq('product_id', productId)
            .neq('orders.status', 'completed')
            .neq('orders.status', 'cancelled')
            .order('orders(created_at)', { ascending: true });

        if (items && items.length > 0) {
            let remaining = qtyToReduce;
            for (const item of items) {
                if (remaining <= 0) break;
                const backlog = Math.max(0, item.quantity - (item.shipped_quantity || 0));
                const reduce = Math.min(backlog, remaining);
                
                if (reduce > 0) {
                    const newShipped = (item.shipped_quantity || 0) + reduce;
                    await supabase.from('order_items').update({ shipped_quantity: newShipped }).eq('id', item.id);
                    remaining -= reduce;

                    // 受注全体のステータスチェック
                    const { data: allItems } = await supabase.from('order_items').select('quantity, shipped_quantity').eq('order_id', item.order_id);
                    if (allItems && allItems.every(ai => (ai.shipped_quantity || 0) >= ai.quantity)) {
                        await supabase.from('orders').update({ status: 'completed' }).eq('id', item.order_id);
                    }
                }
            }
        }
    }

    // 4. 履歴に記録 (オプションだが、ユーザー要望にある「バックエンドにも反映」のニュアンス)
    // スケルトンがあればここに insert
    
    return true;
}

export async function updateWarehouse(itemId: string, newWarehouse: string) {
    const { error } = await supabase
        .from('inventory')
        .update({ location: newWarehouse || null })
        .eq('id', itemId);

    if (error) throw error;
    return true;
}
