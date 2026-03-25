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

    // 3. 売上連動 (理由が「販売・発送」の場合)
    if (reason === "販売・発送" && productId) {
        if (adjustment < 0) {
            // 【出荷】在庫減少分を最古の受注から出荷済みに計上
            const qtyToReduce = Math.abs(adjustment);
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

                        // 受注全体のステータスチェック（全数出荷なら完了へ）
                        const { data: allItems } = await supabase.from('order_items').select('quantity, shipped_quantity').eq('order_id', item.order_id);
                        if (allItems && allItems.every(ai => (ai.shipped_quantity || 0) >= ai.quantity)) {
                            await supabase.from('orders').update({ status: 'completed' }).eq('id', item.order_id);
                        }
                    }
                }
            }
        } else if (adjustment > 0) {
            // 【返品】在庫増加分を最新の受注から出荷済みを減算して受注残へ復元 (LIFO)
            let remaining = adjustment;
            let totalAmountRestored = 0;
            const { data: items } = await supabase
                .from('order_items')
                .select('*, orders!inner(status, created_at)')
                .eq('product_id', productId)
                .gt('shipped_quantity', 0)
                .neq('orders.status', 'cancelled')
                .order('orders(created_at)', { ascending: false }); // 最新のものから戻す

            if (items && items.length > 0) {
                for (const item of items) {
                    if (remaining <= 0) break;
                    const restore = Math.min(item.shipped_quantity, remaining);
                    
                    if (restore > 0) {
                        const newShipped = item.shipped_quantity - restore;
                        await supabase.from('order_items').update({ shipped_quantity: newShipped }).eq('id', item.id);
                        remaining -= restore;
                        totalAmountRestored += (restore * (item.unit_price || 0));

                        // 完了していた受注を仕掛中に戻す
                        if (item.orders.status === 'completed') {
                            await supabase.from('orders').update({ status: 'in_progress' }).eq('id', item.order_id);
                        }

                        // 関連するロットも仕掛中に戻す
                        const { data: relatedLots } = await supabase
                            .from('lots')
                            .select('id, status')
                            .eq('order_id', item.order_id)
                            .eq('product_id', item.product_id)
                            .eq('status', 'completed');
                        
                        if (relatedLots && relatedLots.length > 0) {
                            for (const lot of relatedLots) {
                                await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lot.id);
                            }
                        }
                    }
                }
            }
            return { ok: true, amount: totalAmountRestored };
        }
    }

    return { ok: true };
}

export async function updateWarehouse(itemId: string, newWarehouse: string) {
    // 1. 現在のアイテム情報を取得
    const { data: current } = await supabase.from('inventory').select('*').eq('id', itemId).single();
    if (!current) throw new Error("アイテムが見つかりません");

    if (newWarehouse) {
        // 2. 移動先に同じ商品がないかチェック (マージ処理)
        const { data: existing } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', current.product_id)
            .eq('location', newWarehouse)
            .eq('item_type', current.item_type || 'finished')
            .neq('id', itemId) // 自分自身以外
            .maybeSingle();

        if (existing) {
            // 合算して今のレコードを削除
            await supabase.from('inventory').update({ quantity: existing.quantity + current.quantity }).eq('id', existing.id);
            await supabase.from('inventory').delete().eq('id', itemId);
            return true;
        }
    }

    // 3. マージ先がない場合は普通に更新
    const { error } = await supabase
        .from('inventory')
        .update({ location: newWarehouse || null })
        .eq('id', itemId);

    if (error) throw error;
    return true;
}
