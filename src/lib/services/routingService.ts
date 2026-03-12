import { supabase } from "@/lib/supabase";

export async function moveForward(
    lotId: string,
    currentProcessId: string,
    qty: number,
    completionDate: string,
    nextDeliveryDate: string,
    nextDueDate: string,
    nextProcessTemplateId?: string,
    nextSubcontractorId?: string,
    overridePrice?: number
) {
    // 1. Update current process
    // First fetch current process to get its completed_quantity
    const { data: currentProc, error: cpErr } = await supabase
        .from('lot_processes')
        .select('*')
        .eq('id', currentProcessId)
        .single();
    if (cpErr) throw cpErr;

    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    const { error: updErr } = await supabase
        .from('lot_processes')
        .update({
            completed_quantity: newCompleted,
            status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress',
            completed_at: completionDate // In a real app we might store arrays of completions
        })
        .eq('id', currentProcessId);
    if (updErr) throw updErr;

    // Create payment item
    await createPaymentItem(currentProc, qty, completionDate, currentProc.unit_price_override);

    // 2. Auto-close lot if there's no next process? No, that's done in components if needed

    // 3. Move to next process if specified
    if (nextProcessTemplateId) {
        // Find if an instance of nextProcessTemplateId with same subcontractor already exists
        const { data: existingNextProcs } = await supabase
            .from('lot_processes')
            .select('*')
            .eq('lot_id', lotId)
            .eq('process_id', nextProcessTemplateId);

        // Try to find exact match for subcontractor
        let nextProcId = null;

        let targetProc = existingNextProcs?.find((p: any) =>
            nextSubcontractorId ? p.subcontractor_id === nextSubcontractorId : !p.subcontractor_id
        );

        if (targetProc) {
            nextProcId = targetProc.id;
            const { error: neErr } = await supabase
                .from('lot_processes')
                .update({
                    input_quantity: (targetProc.input_quantity || 0) + qty,
                    status: targetProc.status === 'pending' ? 'in_progress' : targetProc.status
                })
                .eq('id', targetProc.id);
            if (neErr) throw neErr;
        } else {
            // Create new process instance
            const { data: newProcData, error: insErr } = await supabase
                .from('lot_processes')
                .insert([{
                    lot_id: lotId,
                    process_id: nextProcessTemplateId,
                    subcontractor_id: nextSubcontractorId || null,
                    input_quantity: qty,
                    status: 'in_progress',
                    unit_price_override: overridePrice
                }])
                .select()
                .single();
            if (insErr) throw insErr;
            nextProcId = newProcData.id;
        }

        // Add delivery record for the next process
        const { error: delErr } = await supabase
            .from('lot_process_deliveries')
            .insert([{
                lot_process_id: nextProcId,
                qty: qty,
                delivery_date: nextDeliveryDate,
                due_date: nextDueDate,
                status: 'pending' // V8 schema uses status or just missing completion_date
            }]);
        if (delErr) throw delErr;
    }

    // Refresh lot status
    await updateLotStatus(lotId);
    return { ok: true };
}

export async function registerWip(
    lotId: string,
    processId: string,
    qty: number,
    deliveryDate: string,
    dueDate: string,
    subcontractorId: string,
    overridePrice?: number
) {
    const { data: proc, error: pErr } = await supabase.from('lot_processes').select('*').eq('id', processId).single();
    if (pErr) throw pErr;

    const { error: uErr } = await supabase.from('lot_processes').update({
        input_quantity: (proc.input_quantity || 0) + qty,
        subcontractor_id: subcontractorId,
        unit_price_override: overridePrice,
        status: 'in_progress'
    }).eq('id', processId);
    if (uErr) throw uErr;

    const { error: iErr } = await supabase.from('lot_process_deliveries').insert([{
        lot_process_id: processId,
        qty: qty,
        delivery_date: deliveryDate,
        due_date: dueDate
    }]);
    if (iErr) throw iErr;

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);

    return { ok: true };
}

export async function moveBack(
    lotId: string,
    currentProcessId: string,
    qty: number,
    returnDate: string,
    prevDueDate: string,
    prevProcessTemplateId: string,
    prevSubcontractorId?: string
) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    // Deduct from current input
    const { error: cuErr } = await supabase.from('lot_processes').update({
        input_quantity: Math.max(0, (currentProc.input_quantity || 0) - qty)
    }).eq('id', currentProcessId);
    if (cuErr) throw cuErr;

    // Find the previous process to return to
    const { data: prevProcs } = await supabase
        .from('lot_processes')
        .select('*')
        .eq('lot_id', lotId)
        .eq('process_id', prevProcessTemplateId);

    let prevProc = prevProcs?.find((p: any) => prevSubcontractorId ? p.subcontractor_id === prevSubcontractorId : true) || prevProcs?.[0];

    if (prevProc) {
        // We reinstate the qty into the previous process by deducting completed_quantity
        const newCompleted = Math.max(0, (prevProc.completed_quantity || 0) - qty);
        await supabase.from('lot_processes').update({
            completed_quantity: newCompleted,
            status: 'in_progress'
        }).eq('id', prevProc.id);

        await supabase.from('lot_process_deliveries').insert([{
            lot_process_id: prevProc.id,
            qty: qty,
            delivery_date: returnDate,
            due_date: prevDueDate
        }]);
    } else {
        // Technically this shouldn't happen naturally unless skipping steps previously, but recreate
        const { data: newProcData, error: insErr } = await supabase.from('lot_processes').insert([{
            lot_id: lotId,
            process_id: prevProcessTemplateId,
            subcontractor_id: prevSubcontractorId || null,
            input_quantity: qty,
            status: 'in_progress'
        }]).select().single();
        if (insErr) throw insErr;

        await supabase.from('lot_process_deliveries').insert([{
            lot_process_id: newProcData.id,
            qty: qty,
            delivery_date: returnDate,
            due_date: prevDueDate
        }]);
    }

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
    return { ok: true };
}

export async function moveToInventory(
    lotId: string,
    currentProcessId: string,
    qty: number,
    warehouseName: string,
    completionDate: string,
    productId: string
) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    await createPaymentItem(currentProc, qty, completionDate, currentProc.unit_price_override);

    // Insert to inventory
    // 1. check if exact item_type and product exists in warehouse?
    const { data: invs } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('item_type', 'finished')
        .eq('location', warehouseName);

    if (invs && invs.length > 0) {
        await supabase.from('inventory').update({ quantity: invs[0].quantity + qty }).eq('id', invs[0].id);
    } else {
        await supabase.from('inventory').insert([{
            product_id: productId,
            quantity: qty,
            item_type: 'finished',
            location: warehouseName
        }]);
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

export async function shipAndInvoice(
    lotId: string,
    currentProcessId: string,
    qty: number,
    orderId: string | null
) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    // Update current completion
    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    const todayDate = new Date().toISOString().split("T")[0];
    await createPaymentItem(currentProc, qty, todayDate, currentProc.unit_price_override);

    // If there is an order, update shipped amount
    if (orderId) {
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        // Simplified: take the first item. Ideal would be matching productId
        if (items && items.length > 0) {
            await supabase.from('order_items').update({
                shipped_quantity: (items[0].shipped_quantity || 0) + qty
            }).eq('id', items[0].id);
            // Check if order fully shipped
        }
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

export async function confirmLoss(lotId: string, processId: string) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', processId).single();
    if (cpErr) throw cpErr;

    const remaining = (currentProc.input_quantity || 0) - (currentProc.completed_quantity || 0) - (currentProc.loss_qty || 0);

    await supabase.from('lot_processes').update({
        loss_qty: (currentProc.loss_qty || 0) + remaining,
        loss_confirmed: true,
        status: (currentProc.input_quantity || 0) <= (currentProc.completed_quantity || 0) + (currentProc.loss_qty || 0) + remaining ? 'completed' : 'in_progress'
    }).eq('id', processId);

    await updateLotStatus(lotId);
    return { ok: true, lossQty: remaining };
}

async function updateLotStatus(lotId: string) {
    const { data: procs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId);
    if (!procs) return;
    const allCompleted = procs.every((p: any) => p.status === 'completed');
    if (allCompleted) {
        await supabase.from('lots').update({ status: 'completed' }).eq('id', lotId);
    }
}

async function createPaymentItem(
    currentProc: any,
    qty: number,
    completionDate: string,
    overridePrice?: number | null
) {
    if (!currentProc.subcontractor_id) return; // No subcontractor, no payment

    const date = new Date(completionDate);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodStart = `${date.getFullYear()}-${month}-01`;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const periodEnd = `${date.getFullYear()}-${month}-${lastDay}`;

    // Get unit price
    let unitPrice = overridePrice;
    if (unitPrice === undefined || unitPrice === null) {
        const { data: rateData } = await supabase
            .from('process_subcontractor_rates')
            .select('unit_price')
            .eq('process_id', currentProc.process_id)
            .eq('subcontractor_id', currentProc.subcontractor_id)
            .maybeSingle();
        unitPrice = rateData ? rateData.unit_price : 0;
    }

    const amount = qty * Number(unitPrice);

    // Find existing open payment for this subcontractor/month
    const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, total_amount')
        .eq('subcontractor_id', currentProc.subcontractor_id)
        .eq('period_start', periodStart)
        .in('status', ['wip', 'pre_payment'])
        .maybeSingle();

    let paymentId;
    if (existingPayment) {
        paymentId = existingPayment.id;
        // Update total amount
        await supabase.from('payments').update({
            total_amount: Number(existingPayment.total_amount) + amount
        }).eq('id', paymentId);
    } else {
        const { data: newPayment, error } = await supabase.from('payments').insert([{
            subcontractor_id: currentProc.subcontractor_id,
            period_start: periodStart,
            period_end: periodEnd,
            total_amount: amount,
            status: 'pre_payment'
        }]).select().single();
        if (error) throw error;
        paymentId = newPayment.id;
    }

    // Insert payment item
    const { error: piErr } = await supabase.from('payment_items').insert([{
        payment_id: paymentId,
        lot_process_id: currentProc.id,
        good_quantity: qty,
        unit_price: Number(unitPrice),
        amount: amount
    }]);

    if (piErr) throw piErr;
}
