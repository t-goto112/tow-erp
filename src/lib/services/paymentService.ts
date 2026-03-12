import { supabase } from "@/lib/supabase";

export async function advancePayment(paymentId: string) {
    // Current status of the payment
    const { data: payment, error: fetchErr } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentId)
        .single();

    if (fetchErr) throw fetchErr;

    let nextStatus = payment.status;
    if (payment.status === 'wip') nextStatus = 'pre_payment';
    else if (payment.status === 'pre_payment') nextStatus = 'paid';
    else if (payment.status === 'paid') nextStatus = 'confirmed';

    if (nextStatus !== payment.status) {
        const { error: updErr } = await supabase
            .from('payments')
            .update({ status: nextStatus })
            .eq('id', paymentId);
        if (updErr) throw updErr;
    }
    return { ok: true };
}

export async function revertPayment(paymentId: string) {
    const { data: payment, error: fetchErr } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentId)
        .single();

    if (fetchErr) throw fetchErr;

    let prevStatus = payment.status;
    if (payment.status === 'confirmed') prevStatus = 'paid';
    else if (payment.status === 'paid') prevStatus = 'pre_payment';
    else if (payment.status === 'pre_payment') prevStatus = 'wip';

    if (prevStatus !== payment.status) {
        const { error: updErr } = await supabase
            .from('payments')
            .update({ status: prevStatus })
            .eq('id', paymentId);
        if (updErr) throw updErr;
    }
    return { ok: true };
}

export async function updatePaymentItem(paymentItemId: string, paymentId: string, newQty: number, newPrice: number | null) {
    // Fetch current item to see the difference in amount
    const { data: currentItem, error: fetchErr } = await supabase
        .from('payment_items')
        .select('good_quantity, amount, lot_process_id')
        .eq('id', paymentItemId)
        .single();

    if (fetchErr) throw fetchErr;

    const newAmount = newQty * (newPrice || 0);
    const amountDiff = newAmount - currentItem.amount;

    // Update payment item
    const { error: updItemErr } = await supabase
        .from('payment_items')
        .update({
            good_quantity: newQty,
            unit_price: newPrice !== null ? newPrice : 0,
            amount: newAmount
        })
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
