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
    // Fetch current item to see the difference in amount
    const { data: currentItem, error: fetchErr } = await supabase
        .from('payment_items')
        .select('good_quantity, amount, lot_process_id')
        .eq('id', paymentItemId)
        .single();

    if (fetchErr) throw fetchErr;

    const newAmount = Math.round(newQty * (newPrice || 0));
    const amountDiff = newAmount - currentItem.amount;

    // Update payment item (including voucher_date if provided)
    const updateData: any = {
        good_quantity: newQty,
        unit_price: newPrice !== null ? newPrice : 0,
        amount: newAmount
    };
    if (voucherDate !== undefined && voucherDate !== null) {
        updateData.voucher_date = voucherDate;
    }

    const { error: updItemErr } = await supabase
        .from('payment_items')
        .update(updateData)
        .eq('id', paymentItemId);

    if (updItemErr) throw updItemErr;

    // Update lot process override price if applicable
    if (newPrice !== null) {
        await supabase.from('lot_processes')
            .update({ unit_price_override: newPrice })
            .eq('id', currentItem.lot_process_id);
    }

    // Update parent payment total amount
    const { data: paymentInfo } = await supabase.from('payments').select('total_amount').eq('id', paymentId).single();
    if (paymentInfo) {
        await supabase.from('payments')
            .update({ total_amount: Number(paymentInfo.total_amount) + amountDiff })
            .eq('id', paymentId);
    }

    return { ok: true };
}
