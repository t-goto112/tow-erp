import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

function service(file, db) {
    const source = readFileSync(new URL(`../src/lib/services/${file}.ts`, import.meta.url), 'utf8');
    const js = stripTypeScriptTypes(source.replace(/import .*supabase.*;\r?\n/, '').replace(/export /g, ''));
    const context = vm.createContext({ supabase: db, console });
    vm.runInContext(js, context);
    return context;
}

function database(tables) {
    const writes = [];
    return { writes, rpc(name) { assert.ok(['routing_consume_wip', 'sync_routing_status', 'routing_create_payment'].includes(name)); return Promise.resolve({ data: null, error: null }); }, from(table) {
        let op = 'select', payload, single = false, window;
        const filters = [];
        const query = {
            select() { return this; },
            eq(key, value) { filters.push(row => row[key] === value); return this; },
            is(key, value) { return this.eq(key, value); },
            order() { return this; }, limit() { return this; },
            range(start, end) { window = [start, end]; return this; },
            single() { single = true; return this; }, maybeSingle() { single = true; return this; },
            update(value) { op = 'update'; payload = value; return this; },
            insert(value) { op = 'insert'; payload = value; return this; },
            delete() { op = 'delete'; return this; },
            then(resolve, reject) {
                let rows = (tables[table] || []).filter(row => filters.every(f => f(row)));
                if (window) rows = rows.slice(window[0], window[1] + 1);
                if (op !== 'select') writes.push({ table, op, payload, ids: rows.map(r => r.id) });
                if (op === 'update') rows.forEach(row => Object.assign(row, payload));
                if (op === 'delete') tables[table] = (tables[table] || []).filter(row => !rows.includes(row));
                if (op === 'insert') {
                    rows = (Array.isArray(payload) ? payload : [payload]).map((row, i) => ({
                        id: `new-${(tables[table] || []).length + i}`,
                        ...(table === 'processes' ? { is_active: true } : {}), ...row,
                    }));
                    (tables[table] ||= []).push(...rows);
                }
                return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
            },
        };
        return query;
    } };
}

function routingFixture() {
    return database({ lot_processes: [
        { id: 'current', lot_id: 'lot', process_id: 'step2', subcontractor_id: null, input_quantity: 100, completed_quantity: 20, loss_qty: 15, processes: { group_index: 0 } },
        { id: 'previous', lot_id: 'lot', process_id: 'step1', subcontractor_id: null, input_quantity: 100, completed_quantity: 100, loss_qty: 0, processes: { group_index: 0 } },
    ] });
}

for (const qty of [66, 100, 0, -1, NaN, Infinity]) {
    test(`差戻 ${qty}: 現在数65の範囲外は書き込み前に拒否`, async () => {
        const db = routingFixture();
        const api = service('routingService', db);
        await assert.rejects(api.moveBack('lot', 'current', qty, '2026-10-08', '2026-10-09', 'step1'), /差戻数量/);
        assert.equal(db.writes.length, 0);
    });
}

test('現在数65ちょうどの差戻: ロス15を保持し前工程へ65を戻す', async () => {
    const db = routingFixture();
    await service('routingService', db).moveBack('lot', 'current', 65, '2026-10-08', '2026-10-09', 'step1');
    const updates = db.writes.filter(w => w.table === 'lot_processes' && w.op === 'update');
    assert.equal(updates[0].payload.input_quantity, 35);
    assert.equal(updates[1].payload.completed_quantity, 35);
    assert.equal(db.writes.find(w => w.table === 'lot_process_deliveries').payload[0].qty, 65);
});

function masterFixture() {
    const tables = {
        products: [{ id: 'product', name: '旧商品', code: 'OLD' }],
        processes: [{ id: 'step', product_id: 'product', is_active: true, name: '旧工程', sort_order: 1, group_index: 0,
            process_subcontractor_rates: [{ subcontractor_id: 'sub' }] }],
        subcontractors: [{ id: 'sub', name: '旧外注先' }],
        process_subcontractor_rates: [{ id: 'rate', process_id: 'step', subcontractor_id: 'sub', unit_price: 100 }],
        lots: [{ id: 'lot', product_id: 'product' }],
        lot_processes: [{ id: 'record', lot_id: 'lot', process_id: 'step', subcontractor_id: 'sub', input_quantity: 100,
            completed_quantity: 40, loss_qty: 5, unit_price_override: 90 }],
        payment_items: [{ id: 'payment', lot_process_id: 'record', unit_price: 100, amount: 4000 }],
        lot_process_deliveries: [{ id: 'delivery', lot_process_id: 'record', qty: 100 }],
    };
    const groups = [{ id: 'group', label: '工程登録1', partLabel: '新部品', templates: [{
        id: 'step', name: '新工程', sortOrder: 2, isAssemblyPoint: true, targetGroupIndexes: [1],
        subcontractors: [{ id: 'sub', originalName: '旧外注先', name: '新外注先', unitPrice: 250 }],
    }] }];
    return { tables, groups, db: database(tables) };
}

test('マスタ編集は外注先IDを維持し既存受注の参照先、商品、工程、単価を更新する', async () => {
    const { tables, groups, db } = masterFixture();
    const history = JSON.stringify([tables.lot_processes, tables.lot_process_deliveries, tables.payment_items]);
    await service('masterService', db).updateProduct('product', '新商品', 'NEW', groups);
    assert.equal(tables.subcontractors.length, 1);
    assert.equal(tables.subcontractors.find(s => s.id === tables.lot_processes[0].subcontractor_id).name, '新外注先');
    assert.equal(tables.products[0].name, '新商品');
    assert.equal(tables.products[0].code, 'NEW');
    assert.equal(tables.processes[0].name, '新工程');
    assert.equal(tables.processes[0].sort_order, 2);
    assert.equal(tables.processes[0].part_label, '新部品');
    assert.equal(tables.processes[0].is_assembly_point, true);
    assert.deepEqual(Array.from(tables.processes[0].target_group_indexes), [1]);
    assert.equal(tables.process_subcontractor_rates[0].unit_price, 250);
    assert.equal(tables.process_subcontractor_rates[0].subcontractor_id, 'sub');
    assert.equal(JSON.stringify([tables.lot_processes, tables.lot_process_deliveries, tables.payment_items]), history);
});

test('同じ外注先が複数工程にある場合に未編集欄が改名を巻き戻さない', async () => {
    const { tables, groups, db } = masterFixture();
    tables.processes.push({ ...tables.processes[0], id: 'step2' });
    groups[0].templates.push({ ...groups[0].templates[0], id: 'step2', subcontractors: [
        { id: 'sub', originalName: '旧外注先', name: '旧外注先', unitPrice: 300 },
    ] });
    await service('masterService', db).updateProduct('product', '製品', 'P', groups);
    assert.equal(tables.subcontractors[0].name, '新外注先');
    assert.equal(tables.subcontractors.length, 1);
    assert.equal(tables.process_subcontractor_rates.every(r => r.subcontractor_id === 'sub'), true);
});

test('同じ外注先の競合する改名は書き込み前に拒否する', async () => {
    const { groups, db } = masterFixture();
    groups[0].templates.push({ ...groups[0].templates[0], id: 'step2', subcontractors: [
        { id: 'sub', originalName: '旧外注先', name: '別名', unitPrice: 300 },
    ] });
    await assert.rejects(service('masterService', db).updateProduct('product', '製品', 'P', groups), /異なる変更名/);
    assert.equal(db.writes.length, 0);
});

test('既存受注の不足工程を追加し再保存でも重複や実績リセットがない', async () => {
    const { tables, groups, db } = masterFixture();
    tables.processes.push({ ...tables.processes[0], id: 'missing' });
    groups[0].templates.push({ ...groups[0].templates[0], id: 'missing' });
    const api = service('masterService', db);
    await api.updateProduct('product', '製品', 'P', groups);
    await api.updateProduct('product', '製品', 'P', groups);
    assert.equal(tables.lot_processes.length, 2);
    assert.equal(tables.lot_processes[1].process_id, 'missing');
    assert.equal(tables.lot_processes[1].input_quantity, 0);
    assert.equal(tables.lot_processes[1].subcontractor_id, 'sub');
    assert.equal(tables.lot_processes[0].input_quantity, 100);
});

test('編集フォームへ外注先IDと元の名称を引き継ぐ', () => {
    const api = service('masterService', database({}));
    const groups = api.processesToFormGroups([{ id: 'step', name: '工程', sort_order: 1, group_index: 0,
        process_subcontractor_rates: [{ unit_price: 100, subcontractors: { id: 'sub', name: '旧外注先' } }] }]);
    assert.equal(groups[0].templates[0].subcontractors[0].id, 'sub');
    assert.equal(groups[0].templates[0].subcontractors[0].originalName, '旧外注先');
});

test('商品複製では元の外注先IDを改名しない', async () => {
    const { tables, groups, db } = masterFixture();
    await service('masterService', db).createProduct('複製商品', 'COPY', groups);
    assert.equal(tables.subcontractors.find(s => s.id === 'sub').name, '旧外注先');
    assert.equal(tables.subcontractors.some(s => s.name === '新外注先'), true);
});

test('工程追加と工程グループ変更を既存ロットに反映する', async () => {
    const { tables, groups, db } = masterFixture();
    groups.unshift({ id: 'empty', label: '工程登録1', templates: [] });
    groups[1].templates.push({ id: 'form-new', name: '追加工程', sortOrder: 3, subcontractors: [] });
    await service('masterService', db).updateProduct('product', '製品', 'P', groups);
    assert.equal(tables.processes.find(p => p.id === 'step').group_index, 1);
    const added = tables.processes.find(p => p.name === '追加工程');
    assert.ok(added);
    assert.equal(added.group_index, 1);
    assert.equal(tables.lot_processes.filter(p => p.process_id === added.id).length, 1);
});

test('外注先更新エラーを成功として扱わず後続の変更を止める', async () => {
    const { groups } = masterFixture();
    const calls = [];
    const db = { from(table) {
        calls.push(table);
        return { update() { return this; }, eq() { return Promise.resolve({ error: new Error('permission denied') }); } };
    } };
    await assert.rejects(service('masterService', db).updateProduct('product', '製品', 'P', groups), /permission denied/);
    assert.deepEqual(calls, ['subcontractors']);
});

test('取得上限を超える既存受注にも不足工程を反映する', async () => {
    const { tables, groups, db } = masterFixture();
    tables.lots = Array.from({ length: 1001 }, (_, i) => ({ id: `lot-${i}`, product_id: 'product' }));
    tables.lot_processes = [];
    await service('masterService', db).updateProduct('product', '製品', 'P', groups);
    assert.equal(tables.lot_processes.length, 1001);
    assert.equal(new Set(tables.lot_processes.map(p => p.lot_id)).size, 1001);
});

test('別ロットの工程への差戻は拒否', async () => {
    const db = routingFixture();
    await assert.rejects(service('routingService', db).moveBack('other', 'current', 1, '', '', 'step1'), /一致/);
    assert.equal(db.writes.length, 0);
});

test('工程削除は非表示化し、実績・納入・支払を削除しない', async () => {
    const db = database({ processes: [{ id: 'old', product_id: 'product', is_active: true }] });
    await service('masterService', db).updateProduct('product', '製品', 'P', []);
    const retired = db.writes.find(w => w.table === 'processes');
    assert.equal(retired.op, 'update');
    assert.equal(retired.payload.is_active, false);
    assert.equal(db.writes.some(w => ['lot_processes', 'lot_process_deliveries', 'payment_items'].includes(w.table)), false);
});

test('マスタ読み込みは削除工程を除外する', async () => {
    const db = database({ products: [{ id: 'product', processes: [{ id: 'active', is_active: true }, { id: 'retired', is_active: false }] }] });
    const products = await service('masterService', db).fetchMasterProducts();
    assert.equal(products[0].processes.length, 1);
    assert.equal(products[0].processes[0].id, 'active');
});

test('新規受注は現行工程だけを作成し、削除工程を含めない', async () => {
    const db = database({ products: [{ id: 'product', name: '製品' }], processes: [
        { id: 'active', product_id: 'product', is_active: true },
        { id: 'retired', product_id: 'product', is_active: false },
    ] });
    await service('orderService', db).createSupabaseOrder({ orderNumber: 'ORD-1', customerName: '顧客', channel: '', dueDate: '2026-10-09', status: 'pending', notes: '', items: [{ product: '製品', quantity: 10, unitPrice: 100 }] });
    const rows = db.writes.find(w => w.table === 'lot_processes').payload;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].process_id, 'active');
});
