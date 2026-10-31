import { supabase } from "@/lib/supabase";

export async function advancePayment(paymentItemId: string) {
    // Current status of the payment item
    const { data: item, error: fetchErr } = await supabase
        .from('payment_items')
        .select('status')
        .eq('id', paymentItemId)
        .single();

    if (fetchErr) throw fetchErr;

    let nextStatus = item.status;
    if (item.status === 'wip') nextStatus = 'pre_payment';
    else if (item.status === 'pre_payment') nextStatus = 'paid';
    else if (item.status === 'paid') nextStatus = 'confirmed';

    if (nextStatus !== item.status) {
        const { error: updErr } = await supabase
            .from('payment_items')
            .update({ status: nextStatus })
            .eq('id', paymentItemId);
        if (updErr) throw updErr;
    }
    return { ok: true };
}

export async function revertPayment(paymentItemId: string) {
    const { data: item, error: fetchErr } = await supabase
        .from('payment_items')
        .select('status')
        .eq('id', paymentItemId)
        .single();

    if (fetchErr) throw fetchErr;

    let prevStatus = item.status;
    if (item.status === 'confirmed') prevStatus = 'paid';
    else if (item.status === 'paid') prevStatus = 'pre_payment';
    else if (item.status === 'pre_payment') prevStatus = 'wip';

    if (prevStatus !== item.status) {
        const { error: updErr } = await supabase
            .from('payment_items')
            .update({ status: prevStatus })
            .eq('id', paymentItemId);
        if (updErr) throw updErr;
    }
    return { ok: true };
}

export async function updatePaymentItem(paymentItemId: string, paymentId: string, newQty: number, newPrice: number | null, voucherDate?: string | null) {
    const { data, error } = await supabase.rpc('update_payment_item_atomic', {
        p_item_id: paymentItemId, p_payment_id: paymentId,
        p_quantity: newQty, p_price: newPrice, p_voucher_date: voucherDate || null,
    });
    if (error) throw error;
    return data;
}
