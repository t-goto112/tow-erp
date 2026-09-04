import { supabase } from "@/lib/supabase";

// ─── ヘルパー: パーツ在庫の消費 ───
async function consumePartsIfAssembly(processId: string, templateId: string, qty: number, lotId: string, errorPrefix: string) {
    const { data: tpl } = await supabase.from('processes').select('is_assembly_point, target_group_indexes').eq('id', templateId).single();
    if (tpl?.is_assembly_point) {
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        if (lot) {
            const targetGroups: number[] = (tpl.target_group_indexes && Array.isArray(tpl.target_group_indexes) && tpl.target_group_indexes.length > 0)
                ? tpl.target_group_indexes
                : null;

            // パーツ在庫を取得（ターゲットグループが指定されていれば対象グループのみフィルタ）
            let query = supabase
                .from('inventory')
                .select('*')
                .eq('product_id', lot.product_id)
                .eq('item_type', 'parts');

            const { data: partsInvs } = await query;

            // ターゲットグループ指定がある場合は、対象グループの在庫のみフィルタ
            const filteredInvs = targetGroups
                ? (partsInvs || []).filter((inv: any) => targetGroups.includes(inv.source_group_index))
                : (partsInvs || []);

            const totalAvailable = filteredInvs.reduce((sum: number, inv: any) => sum + Number(inv.quantity), 0);

            if (totalAvailable < qty) {
                const groupLabel = targetGroups
                    ? `グループ[${targetGroups.join(',')}]の`
                    : '';
                throw new Error(`${groupLabel}パーツ在庫が不足しています (在庫: ${totalAvailable}, 必要: ${qty})。不足しているため${errorPrefix}できません。`);
            }

            // 在庫を消費（数量の多いレコードから順に引く）
            let remainingToConsume = qty;
            const sortedInvs = [...filteredInvs].sort((a: any, b: any) => Number(b.quantity) - Number(a.quantity));

            for (const inv of sortedInvs) {
                if (remainingToConsume <= 0) break;
                const toSubtract = Math.min(remainingToConsume, Number(inv.quantity));
                const newQty = Number(inv.quantity) - toSubtract;
                remainingToConsume -= toSubtract;

                if (newQty <= 0) {
                    await supabase.from('inventory').delete().eq('id', inv.id);
                } else {
                    await supabase.from('inventory').update({ quantity: newQty }).eq('id', inv.id);
                }
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
        .eq('status', 'wip')
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
            const newAmount = Math.round(newItemQty * item.unit_price);
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

// ─── ロット・受注ステータス更新 ───
export async function syncLotAndOrderStatus(lotId: string) {
    const { data: procs } = await supabase.from('lot_processes').select('*').eq('lot_id', lotId);
    if (!procs) return;

    const { data: lot } = await supabase.from('lots').select('order_id, status').eq('id', lotId).single();
    if (!lot) return;

    const allCompleted = procs.length > 0 && procs.every((p: any) => p.status === 'completed');
    const anyInProgress = procs.some((p: any) => p.status === 'in_progress' || p.status === 'completed');

    if (allCompleted) {
        if (lot.status !== 'completed') {
            await supabase.from('lots').update({ status: 'completed' }).eq('id', lotId);
        }
        if (lot.order_id) {
            // 受注の自動完了（生産完了ベース）は廃止し、出荷完了（shipAndInvoice等）ベースに統一するため
            // ここでの受注ステータス更新は行わない。
            // これにより、出荷が完了するまで「受注残高」に金額が残り続ける。
        }
    } else if (anyInProgress) {
        if (lot.status === 'created' || lot.status === 'pending' || lot.status === 'completed') {
            await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
        }
        if (lot.order_id) {
            const { data: ord } = await supabase.from('orders').select('status').eq('id', lot.order_id).single();
            if (ord && (ord.status === 'pending' || ord.status === 'created' || ord.status === 'completed')) {
                await supabase.from('orders').update({ status: 'in_progress' }).eq('id', lot.order_id);
            }
        }
    }
}

// ─── 支払レコード作成 ───
async function createPaymentItem(
    currentProc: any,
    qty: number,
    completionDate: string,
    overridePrice?: number | null,
    paymentStatus: string = 'pre_payment',
    deliveryId?: string
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
    const amount = Math.round(qty * Number(unitPrice));

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
        lot_process_delivery_id: deliveryId || null,
        good_quantity: qty,
        unit_price: Number(unitPrice),
        amount: amount,
        status: paymentStatus,
        voucher_date: new Date(completionDate).toISOString().split('T')[0]
    }]);
    if (piErr) throw piErr;
}

// ─── グループ内レコードの取得ヘルパー ───
async function getGroupRecords(lotId: string, processTemplateId: string, subcontractorId: string | null) {
    const query = supabase
        .from('lot_processes')
        .select('*, processes(group_index)')
        .eq('lot_id', lotId)
        .eq('process_id', processTemplateId);
    
    if (subcontractorId) {
        query.eq('subcontractor_id', subcontractorId);
    } else {
        query.is('subcontractor_id', null);
    }
    
    const { data } = await query;
    return data || [];
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
    const { data: leadProc, error: cpErr } = await supabase.from('lot_processes').select('*, processes(group_index)').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    const groupRecords = await getGroupRecords(lotId, leadProc.process_id, leadProc.subcontractor_id);
    await consumePartsIfAssembly(currentProcessId, leadProc.process_id, qty, lotId, "完了報告");

    let remainingQty = qty;
    for (const proc of groupRecords) {
        if (remainingQty <= 0) break;
        const available = (proc.input_quantity || 0) - (proc.completed_quantity || 0) - (proc.loss_qty || 0);
        if (available <= 0) continue;

        const toMove = Math.min(remainingQty, available);
        remainingQty -= toMove;

        const { data: deliveries } = await supabase
            .from('lot_process_deliveries')
            .select('*')
            .eq('lot_process_id', proc.id)
            .is('completion_date', null)
            .order('delivery_date', { ascending: true });

        let lastDeliveryId = null;
        if (deliveries) {
            for (const d of deliveries) {
                // 簡易化のため、最初の未完了納入を完了とする
                await supabase.from('lot_process_deliveries').update({ completion_date: completionDate }).eq('id', d.id);
                lastDeliveryId = d.id;
                break; 
            }
        }

        const newCompleted = (proc.completed_quantity || 0) + toMove;
        await supabase.from('lot_processes').update({
            completed_quantity: newCompleted,
            status: (proc.input_quantity || 0) - (proc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
        }).eq('id', proc.id);

        await consumeWipPayments(proc.id, toMove);
        await createPaymentItem(proc, toMove, completionDate, overridePrice ?? null, 'pre_payment', lastDeliveryId);
    }

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

        const { data: newDel, error: delErr } = await supabase.from('lot_process_deliveries').insert([{
            lot_process_id: nextProcId,
            qty: qty,
            delivery_date: nextDeliveryDate,
            due_date: nextDueDate
        }]).select().single();
        if (delErr) throw delErr;

        const nextProcForPayment = { id: nextProcId, process_id: nextProcessTemplateId, subcontractor_id: nextSubcontractorId || targetProc?.subcontractor_id };
        await createPaymentItem(nextProcForPayment, qty, nextDeliveryDate, null, 'wip', newDel.id);
    } else {
        const groupIndex = (leadProc.processes as any)?.group_index;
        const { data: lot } = await supabase.from('lots').select('product_id').eq('id', lotId).single();
        if (lot) {
            const isFinished = groupIndex === null || groupIndex === undefined || groupIndex === 0;
            const targetLoc = isFinished ? '完成品倉庫' : '仕掛パーツ置場';
            const itemType = isFinished ? 'finished' : 'parts';
            
            // パーツの場合、part_label を取得
            let partLabel: string | null = null;
            if (!isFinished) {
                const { data: tplData } = await supabase.from('processes').select('part_label').eq('id', leadProc.process_id).single();
                partLabel = tplData?.part_label || null;
            }

            if (isFinished) {
                const { data: wh } = await supabase.from('warehouses').select('id').eq('name', targetLoc).maybeSingle();
                if (!wh) await supabase.from('warehouses').insert([{ name: targetLoc }]);
            }

            let invQuery = supabase.from('inventory').select('*').eq('product_id', lot.product_id).eq('location', targetLoc).eq('item_type', itemType);
            if (!isFinished) {
                invQuery = invQuery.eq('source_group_index', groupIndex);
            }
            const { data: existingInv } = await invQuery.maybeSingle();
            if (existingInv) {
                await supabase.from('inventory').update({ quantity: existingInv.quantity + qty }).eq('id', existingInv.id);
            } else {
                const insertData: any = { product_id: lot.product_id, quantity: qty, location: targetLoc, item_type: itemType };
                if (!isFinished) {
                    insertData.source_group_index = groupIndex;
                    insertData.part_label = partLabel;
                }
                await supabase.from('inventory').insert([insertData]);
            }
        }
    }

    await syncLotAndOrderStatus(lotId);
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
        unit_price_override: overridePrice,
        status: 'in_progress'
    }).eq('id', processId);

    await supabase.from('lots').update({ status: 'in_progress' }).eq('id', lotId);
    const { data: lotData } = await supabase.from('lots').select('order_id').eq('id', lotId).single();
    if (lotData?.order_id) {
        await supabase.from('orders').update({ status: 'in_progress' }).eq('id', lotData.order_id);
    }

    const { data: newDel, error: delErr } = await supabase.from('lot_process_deliveries').insert([{
        lot_process_id: processId,
        qty: qty,
        delivery_date: deliveryDate,
        due_date: dueDate
    }]).select().single();
    if (delErr) throw delErr;

    const updatedProc = { ...proc, subcontractor_id: subcontractorId, unit_price_override: overridePrice };
    await createPaymentItem(updatedProc, qty, deliveryDate, overridePrice, 'wip', newDel.id);

    await syncLotAndOrderStatus(lotId);
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
    const { data: leadProc, error: cpErr } = await supabase.from('lot_processes').select('*, processes(group_index)').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    const groupRecords = await getGroupRecords(lotId, leadProc.process_id, leadProc.subcontractor_id);
    
    let remainingQty = qty;
    for (const proc of [...groupRecords].reverse()) {
        if (remainingQty <= 0) break;
        const availableToRemove = (proc.input_quantity || 0) - (proc.completed_quantity || 0);
        if (availableToRemove <= 0) continue;

        const toRemove = Math.min(remainingQty, availableToRemove);
        remainingQty -= toRemove;

        await supabase.from('lot_processes').update({
            input_quantity: Math.max(0, (proc.input_quantity || 0) - toRemove)
        }).eq('id', proc.id);

        await consumeWipPayments(proc.id, toRemove);
    }

    const { data: prevProcs } = await supabase.from('lot_processes').select('*, processes(group_index)').eq('lot_id', lotId).eq('process_id', prevProcessTemplateId);
    let prevProc = prevProcs?.find((p: any) => {
        const isSameGroup = (p.processes as any)?.group_index === (leadProc.processes as any)?.group_index;
        return isSameGroup && (prevSubcontractorId ? p.subcontractor_id === prevSubcontractorId : true);
    });

    if (!prevProc) prevProc = prevProcs?.[0];

    let newDelId = null;
    if (prevProc) {
        const newCompleted = Math.max(0, (prevProc.completed_quantity || 0) - qty);
        await supabase.from('lot_processes').update({ completed_quantity: newCompleted, status: 'in_progress' }).eq('id', prevProc.id);
        const { data: d } = await supabase.from('lot_process_deliveries').insert([{ lot_process_id: prevProc.id, qty: qty, delivery_date: returnDate, due_date: prevDueDate }]).select().single();
        newDelId = d?.id;
        await createPaymentItem(prevProc, qty, returnDate, null, 'wip', newDelId);
    } else {
        const { data: newProcData, error: insErr } = await supabase.from('lot_processes').insert([{
            lot_id: lotId,
            process_id: prevProcessTemplateId,
            subcontractor_id: prevSubcontractorId || null,
            input_quantity: qty,
            status: 'in_progress'
        }]).select().single();
        if (insErr) throw insErr;
        const { data: d } = await supabase.from('lot_process_deliveries').insert([{ lot_process_id: newProcData.id, qty: qty, delivery_date: returnDate, due_date: prevDueDate }]).select().single();
        newDelId = d?.id;
        await createPaymentItem(newProcData, qty, returnDate, null, 'wip', newDelId);
    }

    await syncLotAndOrderStatus(lotId);
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
    const { data: leadProc, error: cpErr } = await supabase.from('lot_processes').select('*, processes(group_index)').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    const groupRecords = await getGroupRecords(lotId, leadProc.process_id, leadProc.subcontractor_id);
    await consumePartsIfAssembly(currentProcessId, leadProc.process_id, qty, lotId, "在庫移動");

    let remainingQty = qty;
    for (const proc of groupRecords) {
        if (remainingQty <= 0) break;
        const available = (proc.input_quantity || 0) - (proc.completed_quantity || 0) - (proc.loss_qty || 0);
        if (available <= 0) continue;
        const toMove = Math.min(remainingQty, available);
        remainingQty -= toMove;

        const { data: deliveries } = await supabase.from('lot_process_deliveries').select('*').eq('lot_process_id', proc.id).is('completion_date', null).order('delivery_date', { ascending: true });
        let lastDelId = null;
        if (deliveries) {
             for (const d of deliveries) {
                 await supabase.from('lot_process_deliveries').update({ completion_date: completionDate }).eq('id', d.id);
                 lastDelId = d.id;
             }
        }

        const newCompleted = (proc.completed_quantity || 0) + toMove;
        await supabase.from('lot_processes').update({
            completed_quantity: newCompleted,
            status: (proc.input_quantity || 0) - (proc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
        }).eq('id', proc.id);

        await consumeWipPayments(proc.id, toMove);
        await createPaymentItem(proc, toMove, completionDate, null, 'pre_payment', lastDelId);
    }

    const groupIndex = (leadProc.processes as any)?.group_index;
    const isPartsType = groupIndex > 0;
    const targetLocation = warehouseName || (isPartsType ? '仕掛パーツ置場' : '未設定の倉庫');

    // パーツの場合、part_label を取得
    let partLabel: string | null = null;
    if (isPartsType) {
        const { data: tplData } = await supabase.from('processes').select('part_label').eq('id', leadProc.process_id).single();
        partLabel = tplData?.part_label || null;
    }

    if (!isPartsType) {
        const { data: wh } = await supabase.from('warehouses').select('id').eq('name', targetLocation).maybeSingle();
        if (!wh) await supabase.from('warehouses').insert([{ name: targetLocation }]);
    }

    let invQuery = supabase.from('inventory').select('*').eq('product_id', productId).eq('location', targetLocation).eq('item_type', isPartsType ? 'parts' : 'finished');
    if (isPartsType) {
        invQuery = invQuery.eq('source_group_index', groupIndex);
    }
    const { data: existingInvs } = await invQuery;
    if (existingInvs && existingInvs.length > 0) {
        await supabase.from('inventory').update({ quantity: existingInvs[0].quantity + qty }).eq('id', existingInvs[0].id);
    } else {
        const insertData: any = { product_id: productId, quantity: qty, location: targetLocation, item_type: isPartsType ? 'parts' : 'finished' };
        if (isPartsType) {
            insertData.source_group_index = groupIndex;
            insertData.part_label = partLabel;
        }
        await supabase.from('inventory').insert([insertData]);
    }

    await syncLotAndOrderStatus(lotId);
    return { ok: true };
}

export async function shipAndInvoice(
    lotId: string,
    currentProcessId: string,
    qty: number,
    orderId: string | null
) {
    const { data: leadProc, error: cpErr } = await supabase.from('lot_processes').select('*, processes(group_index)').eq('id', currentProcessId).single();
    if (cpErr) throw cpErr;

    const groupRecords = await getGroupRecords(lotId, leadProc.process_id, leadProc.subcontractor_id);
    await consumePartsIfAssembly(currentProcessId, leadProc.process_id, qty, lotId, "出荷");

    let remainingQty = qty;
    const todayDate = new Date().toISOString().split("T")[0];

    for (const proc of groupRecords) {
        if (remainingQty <= 0) break;
        const available = (proc.input_quantity || 0) - (proc.completed_quantity || 0) - (proc.loss_qty || 0);
        if (available <= 0) continue;
        const toMove = Math.min(remainingQty, available);
        remainingQty -= toMove;

        const { data: deliveries } = await supabase.from('lot_process_deliveries').select('*').eq('lot_process_id', proc.id).is('completion_date', null).order('delivery_date', { ascending: true });
        let lastDelId = null;
        if (deliveries) {
             for (const d of deliveries) {
                 await supabase.from('lot_process_deliveries').update({ completion_date: todayDate }).eq('id', d.id);
                 lastDelId = d.id;
             }
        }

        const newCompleted = (proc.completed_quantity || 0) + toMove;
        await supabase.from('lot_processes').update({
            completed_quantity: newCompleted,
            status: (proc.input_quantity || 0) - (proc.loss_qty || 0) <= newCompleted ? 'completed' : 'in_progress'
        }).eq('id', proc.id);

        await consumeWipPayments(proc.id, toMove);
        await createPaymentItem(proc, toMove, todayDate, null, 'pre_payment', lastDelId);
    }

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

    await syncLotAndOrderStatus(lotId);
    return { ok: true };
}

export async function confirmLoss(lotId: string, processId: string) {
    const { data: leadProc, error: cpErr } = await supabase.from('lot_processes').select('*').eq('id', processId).single();
    if (cpErr) throw cpErr;

    const groupRecords = await getGroupRecords(lotId, leadProc.process_id, leadProc.subcontractor_id);
    let totalLoss = 0;

    for (const proc of groupRecords) {
        const remaining = (proc.input_quantity || 0) - (proc.completed_quantity || 0) - (proc.loss_qty || 0);
        if (remaining <= 0) continue;

        await consumeWipPayments(proc.id, remaining);
        await supabase.from('lot_processes').update({ 
            loss_qty: (proc.loss_qty || 0) + remaining, 
            loss_confirmed: true, 
            status: 'completed' 
        }).eq('id', proc.id);
        totalLoss += remaining;
    }

    await syncLotAndOrderStatus(lotId);
    return { ok: true, lossQty: totalLoss };
}
