import { supabase } from "@/lib/supabase";

// ─── ヘルパー: パーツ在庫の消費 ───
async function consumePartsIfAssembly(processId: string, templateId: string, qty: number, lotId: string, errorPrefix: string) {
    const { data: tpl } = await supabase.from('processes').select('is_assembly_point').eq('id', templateId).single();
    if (tpl?.is_assembly_point) {
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        if (lot) {
            const { data: partsInv } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', lot.product_id)
                .eq('location', '仕掛パーツ置場')
                .maybeSingle();

            if (!partsInv || partsInv.quantity < qty) {
                throw new Error(`パーツ在庫が不足しています (在庫: ${partsInv?.quantity || 0}, 必要: ${qty})。不足しているため${errorPrefix}できません。`);
            }

            const newPartsQty = partsInv.quantity - qty;
            if (newPartsQty <= 0) {
                await supabase.from('inventory').delete().eq('id', partsInv.id);
            } else {
                await supabase.from('inventory').update({ quantity: newPartsQty }).eq('id', partsInv.id);
            }
        }
    }
}

// ─── WIP支払の消費 ───
async function consumeWipPayments(lotProcessId: string, qty: number) {
    const { data: wipItems } = await supabase
        .from('payment_items')
        .select('id, good_quantity, unit_price, amount, payment_id')
        .eq('lot_process_id', lotProcessId)
        .order('created_at', { ascending: true });

    if (!wipItems) return;

    let remaining = qty;
    for (const item of wipItems) {
        if (remaining <= 0) break;
        const { data: payment } = await supabase
            .from('payments')
            .select('id, status, total_amount')
            .eq('id', item.payment_id)
            .eq('status', 'wip')
            .maybeSingle();
        if (!payment) continue;

        if (item.good_quantity <= remaining) {
            remaining -= item.good_quantity;
            await supabase.from('payment_items').delete().eq('id', item.id);
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
            const diff = oldAmount - newAmount;
            await supabase.from('payments').update({
                total_amount: Math.max(0, Number(payment.total_amount) - diff)
            }).eq('id', payment.id);
        }
    }
}

// ─── ロットステータス更新 ───
async function updateLotStatus(lotId: string) {
    const { data: procs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId);
    if (!procs) return;

    const { data: lot } = await supabase.from('lots').select('order_id, status').eq('id', lotId).single();
    if (!lot) return;

    const allCompleted = procs.every((p: any) => p.status === 'completed');
    const anyInProgress = procs.some((p: any) => p.status === 'in_progress' || p.status === 'completed');

    if (allCompleted && procs.length > 0) {
        if (lot.status !== 'completed') {
            await supabase.from('lots').update({ status: 'completed' }).eq('id', lotId);
        }
        if (lot.order_id) {
            const { data: siblingLots } = await supabase.from('lots').select('status').eq('order_id', lot.order_id);
            if (siblingLots && siblingLots.every(l => l.status === 'completed')) {
                await supabase.from('orders').update({ status: 'completed' }).eq('id', lot.order_id);
            }
        }
    } else if (anyInProgress) {
        if (lot.status === 'created' || lot.status === 'pending') {
            await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
        }
        if (lot.order_id) {
            await supabase.from('orders').update({ status: 'in_progress' }).eq('id', lot.order_id);
        }
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

// ─── 公開API ───

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
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    // 1. 実績報告タイミングでのパーツ消費 (assembly_pointの場合)
    await consumePartsIfAssembly(currentProcessId, currentProc.process_id, qty, lotId, "完了報告");

    // 2. 納入レコードの更新
    const { data: deliveries } = await supabase
        .from('lot_process_deliveries')
        .select('*')
        .eq('lot_process_id', currentProcessId)
        .is('completion_date', null)
        .order('delivery_date', { ascending: true })
        .limit(1);

    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({ completion_date: completionDate }).eq('id', deliveries[0].id);
    }

    // 3. プロセス数量の更新
    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    // 4. WIP支払の消費 & 実績支払の作成
    await consumeWipPayments(currentProcessId, qty);
    await createPaymentItem(currentProc, qty, completionDate, overridePrice ?? currentProc.unit_price_override, 'pre_payment');

    // 5. 次工程へ
    if (nextProcessTemplateId) {
        const { data: existingNextProcs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId).eq('process_id', nextProcessTemplateId);
        let nextProcId = null;
        let targetProc = existingNextProcs?.find((p: any) => nextSubcontractorId ? p.subcontractor_id === nextSubcontractorId : !p.subcontractor_id);

        if (targetProc) {
            nextProcId = targetProc.id;
            await supabase.from('lot_processes').update({
                input_quantity: (targetProc.input_quantity || 0) + qty,
                status: targetProc.status === 'pending' ? 'in_progress' : targetProc.status
            }).eq('id', targetProc.id);
        } else {
            const { data: newProcData, error: insErr } = await supabase.from('lot_processes').insert([{
                lot_id: lotId,
                process_id: nextProcessTemplateId,
                subcontractor_id: nextSubcontractorId || null,
                input_quantity: qty,
                status: 'in_progress'
            }]).select().single();
            if (insErr) throw insErr;
            nextProcId = newProcData.id;
            targetProc = newProcData;
        }

        await supabase.from('lot_process_deliveries').insert([{
            lot_process_id: nextProcId,
            qty: qty,
            delivery_date: nextDeliveryDate,
            due_date: nextDueDate
        }]);

        const nextProcForPayment = { id: nextProcId, process_id: nextProcessTemplateId, subcontractor_id: nextSubcontractorId || targetProc?.subcontractor_id };
        await createPaymentItem(nextProcForPayment, qty, nextDeliveryDate, null, 'wip');
    } else {
        // グループ内最終工程の場合、パーツなら自動的に仕掛在庫へ
        const { data: procTemplate } = await supabase.from('processes').select('group_index').eq('id', currentProc.process_id).single();
        if (procTemplate && procTemplate.group_index > 0) {
            const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
            if (lot) {
                const { data: existingInv } = await supabase.from('inventory').select('*').eq('product_id', lot.product_id).eq('location', '仕掛パーツ置場').maybeSingle();
                if (existingInv) {
                    await supabase.from('inventory').update({ quantity: existingInv.quantity + qty }).eq('id', existingInv.id);
                } else {
                    await supabase.from('inventory').insert([{ product_id: lot.product_id, quantity: qty, location: '仕掛パーツ置場' }]);
                }
            }
        }
    }

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

    await supabase.from('lot_processes').update({
        input_quantity: (proc.input_quantity || 0) + qty,
        subcontractor_id: subcontractorId,
        status: 'in_progress'
    }).eq('id', processId);

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
    const { data: lotData } = await supabase.from('lots').select('order_id').eq('id', lotId).single();
    if (lotData?.order_id) {
        await supabase.from('orders').update({ status: 'in_progress' }).eq('id', lotData.order_id);
    }

    await supabase.from('lot_process_deliveries').insert([{
        lot_process_id: processId,
        qty: qty,
        delivery_date: deliveryDate,
        due_date: dueDate
    }]);

    const updatedProc = { ...proc, subcontractor_id: subcontractorId, unit_price_override: overridePrice };
    await createPaymentItem(updatedProc, qty, deliveryDate, overridePrice, 'wip');

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

    await supabase.from('lot_processes').update({
        input_quantity: Math.max(0, (currentProc.input_quantity || 0) - qty)
    }).eq('id', currentProcessId);

    await consumeWipPayments(currentProcessId, qty);

    const { data: prevProcs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId).eq('process_id', prevProcessTemplateId);
    let prevProc = prevProcs?.find((p: any) => prevSubcontractorId ? p.subcontractor_id === prevSubcontractorId : true) || prevProcs?.[0];

    if (prevProc) {
        const newCompleted = Math.max(0, (prevProc.completed_quantity || 0) - qty);
        await supabase.from('lot_processes').update({ completed_quantity: newCompleted, status: 'in_progress' }).eq('id', prevProc.id);
        await supabase.from('lot_process_deliveries').insert([{ lot_process_id: prevProc.id, qty: qty, delivery_date: returnDate, due_date: prevDueDate }]);
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
        await supabase.from('lot_process_deliveries').insert([{ lot_process_id: newProcData.id, qty: qty, delivery_date: returnDate, due_date: prevDueDate }]);
        await createPaymentItem(newProcData, qty, returnDate, null, 'wip');
    }

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
    const { data: lotData } = await supabase.from('lots').select('order_id').eq('id', lotId).single();
    if (lotData?.order_id) {
        await supabase.from('orders').update({ status: 'in_progress' }).eq('id', lotData.order_id);
    }
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

    await consumePartsIfAssembly(currentProcessId, currentProc.process_id, qty, lotId, "在庫移動");

    const { data: deliveries } = await supabase.from('lot_process_deliveries').select('*').eq('lot_process_id', currentProcessId).is('completion_date', null).order('delivery_date', { ascending: true }).limit(1);
    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({ completion_date: completionDate }).eq('id', deliveries[0].id);
    }

    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    await consumeWipPayments(currentProcessId, qty);
    await createPaymentItem(currentProc, qty, completionDate, currentProc.unit_price_override, 'pre_payment');

    const { data: procTpl } = await supabase.from('processes').select('group_index').eq('id', currentProc.process_id).single();
    const isPartsType = procTpl && procTpl.group_index > 0;
    const targetLocation = isPartsType ? '仕掛パーツ置場' : warehouseName;

    const { data: invs } = await supabase.from('inventory').select('*').eq('product_id', productId).eq('location', targetLocation);
    if (invs && invs.length > 0) {
        await supabase.from('inventory').update({ quantity: invs[0].quantity + qty }).eq('id', invs[0].id);
    } else {
        await supabase.from('inventory').insert([{ product_id: productId, quantity: qty, location: targetLocation }]);
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

    await consumePartsIfAssembly(currentProcessId, currentProc.process_id, qty, lotId, "出荷");

    const { data: deliveries } = await supabase.from('lot_process_deliveries').select('*').eq('lot_process_id', currentProcessId).is('completion_date', null).order('delivery_date', { ascending: true }).limit(1);
    if (deliveries && deliveries.length > 0) {
        await supabase.from('lot_process_deliveries').update({ completion_date: new Date().toISOString().split("T")[0] }).eq('id', deliveries[0].id);
    }

    await consumeWipPayments(currentProcessId, qty);
    const newCompleted = (currentProc.completed_quantity || 0) + qty;
    await supabase.from('lot_processes').update({
        completed_quantity: newCompleted,
        status: (currentProc.input_quantity || 0) - (currentProc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
    }).eq('id', currentProcessId);

    const todayDate = new Date().toISOString().split("T")[0];
    await createPaymentItem(currentProc, qty, todayDate, currentProc.unit_price_override, 'pre_payment');

    if (orderId) {
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
        if (items && items.length > 0 && lot) {
            const matchingItem = items.find((i: any) => i.product_id === lot.product_id) || items[0];
            const newShipped = (matchingItem.shipped_quantity || 0) + qty;
            await supabase.from('order_items').update({ shipped_quantity: newShipped }).eq('id', matchingItem.id);
            const { data: allItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
            if (allItems && allItems.every((i: any) => (i.shipped_quantity || 0) >= i.quantity)) {
                await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
            }
        }
    }

    await updateLotStatus(lotId);
    return { ok: true };
}

export async function confirmLoss(lotId: string, processId: string) {
    const { data: currentProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', processId).single();
    if (cpErr) throw cpErr;
    const remaining = (currentProc.input_quantity || 0) - (currentProc.completed_quantity || 0) - (currentProc.loss_qty || 0);
    await consumeWipPayments(processId, remaining);
    await supabase.from('lot_processes').update({ loss_qty: (currentProc.loss_qty || 0) + remaining, loss_confirmed: true, status: 'completed' }).eq('id', processId);
    await updateLotStatus(lotId);
    return { ok: true, lossQty: remaining };
}
