import { supabase } from "@/lib/supabase";

// ─── WIP支払の消費 (プロト: consumePaymentWip 相当) ───
async function consumeWipPayments(lotProcessId: string, qty: number) {
    // Find WIP payment_items for this lot_process
    const { data: wipItems } = await supabase
        .from('payment_items')
        .select('id, good_quantity, unit_price, amount, payment_id')
        .eq('lot_process_id', lotProcessId)
        .order('created_at', { ascending: true });

    if (!wipItems) return;

    // Filter to only WIP status items via payment join
    let remaining = qty;
    for (const item of wipItems) {
        if (remaining <= 0) break;
        // Check if parent payment is WIP
        const { data: payment } = await supabase
            .from('payments')
            .select('id, status, total_amount')
            .eq('id', item.payment_id)
            .eq('status', 'wip')
            .maybeSingle();
        if (!payment) continue;

        if (item.good_quantity <= remaining) {
            remaining -= item.good_quantity;
            // Remove the WIP item
            await supabase.from('payment_items').delete().eq('id', item.id);
            // Decrease payment total
            const newTotal = Math.max(0, Number(payment.total_amount) - item.amount);
            if (newTotal <= 0) {
                await supabase.from('payments').delete().eq('id', payment.id);
            } else {
                await supabase.from('payments').update({ total_amount: newTotal }).eq('id', payment.id);
            }
        } else {
            const oldAmount = item.amount;
            const newItemQty = item.good_quantity - remaining;
            const newAmount = newItemQty * item.unit_price;
            remaining = 0;
            await supabase.from('payment_items').update({
                good_quantity: newItemQty,
                amount: newAmount
            }).eq('id', item.id);
            // Decrease payment total
            const diff = oldAmount - newAmount;
            await supabase.from('payments').update({
                total_amount: Math.max(0, Number(payment.total_amount) - diff)
            }).eq('id', payment.id);
        }
    }
}

// ─── 次工程へ送る (プロト: moveForward 完全再現) ───
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
    // 1. Fetch current process & lot
    const { data: currentProc, error: cpErr } = await supabase
        .from('lot_processes')
        .select('*')
        .eq('id', currentProcessId)
        .single();
    if (cpErr) throw cpErr;

    const { data: lot } = await supabase.from('lots').select('*').eq('id', lotId).single();

    // 2. If next process has is_assembly_point, check parts inventory BEFORE making changes
    if (nextProcessTemplateId) {
        const { data: nextTpl } = await supabase
            .from('processes')
            .select('is_assembly_point, group_index')
            .eq('id', nextProcessTemplateId)
            .single();

        if (nextTpl?.is_assembly_point && lot) {
            // Find parts inventory for this product
            const { data: partsInv } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', lot.product_id)
                .eq('location', '仕掛パーツ置場')
                .maybeSingle();

            if (!partsInv || partsInv.total_quantity < qty) {
                throw new Error(`パーツ在庫が不足しています (在庫: ${partsInv?.total_quantity || 0}, 必要: ${qty})`);
            }

            // Consume parts inventory
            const newPartsQty = partsInv.total_quantity - qty;
            if (newPartsQty <= 0) {
                await supabase.from('inventory').delete().eq('id', partsInv.id);
            } else {
                await supabase.from('inventory').update({ total_quantity: newPartsQty }).eq('id', partsInv.id);
            }
        }
    }

    // 3. Mark completion_date on earliest unfinished delivery
    const { data: deliveries } = await supabase
        .from('lot_process_deliveries')
        .select('*')
        .eq('lot_process_id', currentProcessId)
        .is('completion_date', null)
        .order('delivery_date', { ascending: true })
        .limit(1);

    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({
            completion_date: completionDate
        }).eq('id', deliveries[0].id);
    }

    // 4. Update current process completed_quantity
    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    const { error: updErr } = await supabase
        .from('lot_processes')
        .update({
            completed_quantity: newCompleted,
            status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
        })
        .eq('id', currentProcessId);
    if (updErr) throw updErr;

    // 5. Consume current process WIP payments
    await consumeWipPayments(currentProcessId, qty);

    // 6. Create pre_payment for completed work
    await createPaymentItem(currentProc, qty, completionDate, overridePrice ?? currentProc.unit_price_override, 'pre_payment');

    // 7. Move to next process if specified
    if (nextProcessTemplateId) {
        const { data: existingNextProcs } = await supabase
            .from('lot_processes')
            .select('*')
            .eq('lot_id', lotId)
            .eq('process_id', nextProcessTemplateId);

        let nextProcId = null;
        let targetProc = existingNextProcs?.find((p: any) =>
            nextSubcontractorId ? p.subcontractor_id === nextSubcontractorId : !p.subcontractor_id
        );

        if (targetProc) {
            nextProcId = targetProc.id;
            await supabase
                .from('lot_processes')
                .update({
                    input_quantity: (targetProc.input_quantity || 0) + qty,
                    status: targetProc.status === 'pending' ? 'in_progress' : targetProc.status
                })
                .eq('id', targetProc.id);
        } else {
            const { data: newProcData, error: insErr } = await supabase
                .from('lot_processes')
                .insert([{
                    lot_id: lotId,
                    process_id: nextProcessTemplateId,
                    subcontractor_id: nextSubcontractorId || null,
                    input_quantity: qty,
                    status: 'in_progress'
                }])
                .select()
                .single();
            if (insErr) throw insErr;
            nextProcId = newProcData.id;
            targetProc = newProcData;
        }

        // Add delivery record for the next process
        await supabase.from('lot_process_deliveries').insert([{
            lot_process_id: nextProcId,
            qty: qty,
            delivery_date: nextDeliveryDate,
            due_date: nextDueDate
        }]);

        // Create WIP payment for next process
        const nextProcForPayment = { id: nextProcId, process_id: nextProcessTemplateId, subcontractor_id: nextSubcontractorId || targetProc?.subcontractor_id };
        await createPaymentItem(nextProcForPayment, qty, nextDeliveryDate, null, 'wip');

    } else {
        // Last process in group — check if parts (group_index > 0) → auto add to parts inventory
        const { data: procTemplate } = await supabase
            .from('processes')
            .select('group_index')
            .eq('id', currentProc.process_id)
            .single();

        if (procTemplate && procTemplate.group_index > 0 && lot) {
            // Add to parts inventory
            const { data: existingInv } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', lot.product_id)
                .eq('location', '仕掛パーツ置場')
                .maybeSingle();

            if (existingInv) {
                await supabase.from('inventory').update({
                    total_quantity: existingInv.total_quantity + qty
                }).eq('id', existingInv.id);
            } else {
                await supabase.from('inventory').insert([{
                    product_id: lot.product_id,
                    total_quantity: qty,
                    location: '仕掛パーツ置場'
                }]);
            }
        }
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

// ─── 仕掛登録 (プロト: registerWip 完全再現) ───
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

    // Check if this is an assembly point — consume parts inventory
    const { data: procTpl } = await supabase
        .from('processes')
        .select('is_assembly_point')
        .eq('id', proc.process_id)
        .single();

    if (procTpl?.is_assembly_point) {
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        if (lot) {
            const { data: partsInv } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', lot.product_id)
                .eq('location', '仕掛パーツ置場')
                .maybeSingle();

            if (!partsInv || partsInv.total_quantity < qty) {
                throw new Error(`パーツ在庫が不足しています (在庫: ${partsInv?.total_quantity || 0}, 必要: ${qty})`);
            }

            const newQty = partsInv.total_quantity - qty;
            if (newQty <= 0) {
                await supabase.from('inventory').delete().eq('id', partsInv.id);
            } else {
                await supabase.from('inventory').update({ total_quantity: newQty }).eq('id', partsInv.id);
            }
        }
    }

    await supabase.from('lot_processes').update({
        input_quantity: (proc.input_quantity || 0) + qty,
        subcontractor_id: subcontractorId,
        status: 'in_progress'
    }).eq('id', processId);

    await supabase.from('lot_process_deliveries').insert([{
        lot_process_id: processId,
        qty: qty,
        delivery_date: deliveryDate,
        due_date: dueDate
    }]);

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);

    // Create WIP payment item
    const updatedProc = { ...proc, subcontractor_id: subcontractorId, unit_price_override: overridePrice };
    await createPaymentItem(updatedProc, qty, deliveryDate, overridePrice, 'wip');

    return { ok: true };
}

// ─── 差戻し (プロト: moveBack 再現) ───
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
    await supabase.from('lot_processes').update({
        input_quantity: Math.max(0, (currentProc.input_quantity || 0) - qty)
    }).eq('id', currentProcessId);

    // Consume WIP on current process
    await consumeWipPayments(currentProcessId, qty);

    // Find the previous process
    const { data: prevProcs } = await supabase
        .from('lot_processes')
        .select('*')
        .eq('lot_id', lotId)
        .eq('process_id', prevProcessTemplateId);

    let prevProc = prevProcs?.find((p: any) => prevSubcontractorId ? p.subcontractor_id === prevSubcontractorId : true) || prevProcs?.[0];

    if (prevProc) {
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

        // Create WIP payment for the re-opened previous process
        await createPaymentItem(prevProc, qty, returnDate, null, 'wip');
    } else {
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

        await createPaymentItem(newProcData, qty, returnDate, null, 'wip');
    }

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
    return { ok: true };
}

// ─── 在庫へ移動 (プロト: moveToInventory 完全再現) ───
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

    // Mark delivery completion
    const { data: deliveries } = await supabase
        .from('lot_process_deliveries')
        .select('*')
        .eq('lot_process_id', currentProcessId)
        .is('completion_date', null)
        .order('delivery_date', { ascending: true })
        .limit(1);

    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({
            completion_date: completionDate
        }).eq('id', deliveries[0].id);
    }

    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    // Consume WIP payments
    await consumeWipPayments(currentProcessId, qty);

    // Create pre_payment for this completion
    await createPaymentItem(currentProc, qty, completionDate, currentProc.unit_price_override, 'pre_payment');

    // Determine inventory type: parts (group_index > 0) or product (group_index = 0)
    const { data: procTpl } = await supabase
        .from('processes')
        .select('group_index')
        .eq('id', currentProc.process_id)
        .single();

    const isPartsType = procTpl && procTpl.group_index > 0;
    const targetLocation = isPartsType ? '仕掛パーツ置場' : warehouseName;

    const { data: invs } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('location', targetLocation);

    if (invs && invs.length > 0) {
        await supabase.from('inventory').update({ total_quantity: invs[0].total_quantity + qty }).eq('id', invs[0].id);
    } else {
        await supabase.from('inventory').insert([{
            product_id: productId,
            total_quantity: qty,
            location: targetLocation
        }]);
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

// ─── 発送・納品 (プロト: shipAndInvoice 完全再現) ───
export async function shipAndInvoice(
    lotId: string,
    currentProcessId: string,
    qty: number,
    orderId: string | null
) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    // Mark delivery completion
    const { data: deliveries } = await supabase
        .from('lot_process_deliveries')
        .select('*')
        .eq('lot_process_id', currentProcessId)
        .is('completion_date', null)
        .order('delivery_date', { ascending: true })
        .limit(1);

    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({
            completion_date: new Date().toISOString().split("T")[0]
        }).eq('id', deliveries[0].id);
    }

    // Consume WIP
    await consumeWipPayments(currentProcessId, qty);

    // Update current completion
    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    const todayDate = new Date().toISOString().split("T")[0];
    await createPaymentItem(currentProc, qty, todayDate, currentProc.unit_price_override, 'pre_payment');

    // If there is an order, update shipped amount
    if (orderId) {
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        if (items && items.length > 0 && lot) {
            // Match by product_id
            const matchingItem = items.find((i: any) => i.product_id === lot.product_id) || items[0];
            const newShipped = (matchingItem.shipped_quantity || 0) + qty;
            await supabase.from('order_items').update({
                shipped_quantity: newShipped
            }).eq('id', matchingItem.id);

            // Check if all items fully shipped → complete order
            const { data: allItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
            if (allItems && allItems.every((i: any) => (i.shipped_quantity || 0) >= i.quantity)) {
                await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
            }
        }
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

// ─── ロス確定 (プロト: confirmLoss 完全再現) ───
export async function confirmLoss(lotId: string, processId: string) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', processId).single();
    if (cpErr) throw cpErr;

    const remaining = (currentProc.input_quantity || 0) - (currentProc.completed_quantity || 0) - (currentProc.loss_qty || 0);

    // Consume WIP for the lost quantity
    await consumeWipPayments(processId, remaining);

    await supabase.from('lot_processes').update({
        loss_qty: (currentProc.loss_qty || 0) + remaining,
        loss_confirmed: true,
        status: 'completed'
    }).eq('id', processId);

    await updateLotStatus(lotId);
    return { ok: true, lossQty: remaining };
}

// ─── ロットステータス更新 ───
async function updateLotStatus(lotId: string) {
    const { data: procs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId);
    if (!procs) return;
    const allCompleted = procs.every((p: any) => p.status === 'completed');
    if (allCompleted && procs.length > 0) {
        await supabase.from('lots').update({ status: 'completed' }).eq('id', lotId);
    }
}

// ─── 支払レコード作成 ───
async function createPaymentItem(
    currentProc: any,
    qty: number,
    completionDate: string,
    overridePrice?: number | null,
    paymentStatus: string = 'pre_payment'
) {
    if (!currentProc.subcontractor_id) return;

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

    // Find existing open payment for this subcontractor/month/status
    const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, total_amount')
        .eq('subcontractor_id', currentProc.subcontractor_id)
        .eq('period_start', periodStart)
        .eq('status', paymentStatus)
        .maybeSingle();

    let paymentId;
    if (existingPayment) {
        paymentId = existingPayment.id;
        await supabase.from('payments').update({
            total_amount: Number(existingPayment.total_amount) + amount
        }).eq('id', paymentId);
    } else {
        const { data: newPayment, error } = await supabase.from('payments').insert([{
            subcontractor_id: currentProc.subcontractor_id,
            period_start: periodStart,
            period_end: periodEnd,
            total_amount: amount,
            status: paymentStatus
        }]).select().single();
        if (error) throw error;
        paymentId = newPayment.id;
    }

    const { error: piErr } = await supabase.from('payment_items').insert([{
        payment_id: paymentId,
        lot_process_id: currentProc.id,
        good_quantity: qty,
        unit_price: Number(unitPrice),
        amount: amount
    }]);

    if (piErr) throw piErr;
}
