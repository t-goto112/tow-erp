import { supabase } from "@/lib/supabase";

/**
 * ロットプロセスに対する納入実績を更新する処理
 * (実際の運用ではバックエンドでトリガー等を用いて関連データを同期する方が安全ですが、
 * 今回はフロントエンドから関連テーブルを順番に更新します)
 */
export async function updateLotProcessDelivery(
    processId: string,
    deliveryId: string,
    qty: number,
    deliveryDate?: string,
    dueDate?: string
) {
    // 1. Delivery (納入実績) データの更新
    const updateData: any = { qty };
    if (deliveryDate) updateData.delivery_date = deliveryDate;
    if (dueDate) updateData.due_date = dueDate;

    // 納入日が入力され、数量が0より大きい場合は完了とみなす簡易的なロジック
    // （本来はより正確な状態管理が必要ですが、一旦既存UIの振る舞いに合わせます）
    if (deliveryDate && qty > 0) {
        updateData.completion_date = new Date().toISOString().split('T')[0];
    } else {
        updateData.completion_date = null;
    }

    const { error: delError } = await supabase
        .from('lot_process_deliveries')
        .update(updateData)
        .eq('id', deliveryId);

    if (delError) throw delError;

    // 2. プロセス自体の集計値更新（トリガーがない前提での手動更新）
    // まず対象プロセスの全実績を取得
    const { data: deliveries, error: listError } = await supabase
        .from('lot_process_deliveries')
        .select('*')
        .eq('lot_process_id', processId);

    if (listError) throw listError;

    let completedQty = 0;
    if (deliveries) {
        completedQty = deliveries
            .filter((d: any) => Boolean(d.completion_date))
            .reduce((sum: number, d: any) => sum + d.qty, 0);
    }

    // プロセスの状態を更新
    const { data: processData, error: pGetError } = await supabase
        .from('lot_processes')
        .select('input_quantity')
        .eq('id', processId)
        .single();

    if (pGetError) throw pGetError;

    const status = completedQty >= processData.input_quantity && processData.input_quantity > 0
        ? 'completed'
        : (completedQty > 0 ? 'in_progress' : 'pending');

    const { error: pUpdError } = await supabase
        .from('lot_processes')
        .update({
            completed_quantity: completedQty,
            status: status
        })
        .eq('id', processId);

    if (pUpdError) throw pUpdError;

    // 3. 次工程への引き継ぎ
    // このプロセスが完了扱いで次工程がある場合、次工程のinput_quantityを増やす
    if (status === 'completed') {
        const { data: currentP } = await supabase
            .from('lot_processes')
            .select('lot_id, step_order')
            .eq('id', processId)
            .single();

        if (currentP) {
            const { data: nextP } = await supabase
                .from('lot_processes')
                .select('id, input_quantity')
                .eq('lot_id', currentP.lot_id)
                .eq('step_order', currentP.step_order + 1)
                .single();

            if (nextP) {
                // 次工程へ引き継ぎ (ロスの考慮等は現時点では省略)
                await supabase
                    .from('lot_processes')
                    .update({
                        input_quantity: completedQty,
                        status: nextP.input_quantity === 0 ? 'in_progress' : undefined
                    })
                    .eq('id', nextP.id);
            } else {
                // 次工程がない = ロット自体の完了
                await supabase
                    .from('lots')
                    .update({ status: 'completed' })
                    .eq('id', currentP.lot_id);
            }
        }
    }

    return true;
}
