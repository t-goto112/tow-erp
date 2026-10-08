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
    return { writes, from(table) {
        let op = 'select', payload, single = false;
        const filters = [];
        const query = {
            select() { return this; },
            eq(key, value) { filters.push(row => row[key] === value); return this; },
            is(key, value) { return this.eq(key, value); },
            order() { return this; }, limit() { return this; },
            single() { single = true; return this; }, maybeSingle() { single = true; return this; },
            update(value) { op = 'update'; payload = value; return this; },
            insert(value) { op = 'insert'; payload = value; return this; },
            delete() { op = 'delete'; return this; },
            then(resolve, reject) {
                let rows = (tables[table] || []).filter(row => filters.every(f => f(row)));
                if (op !== 'select') writes.push({ table, op, payload, ids: rows.map(r => r.id) });
                if (op === 'update') rows.forEach(row => Object.assign(row, payload));
                if (op === 'insert') {
                    rows = (Array.isArray(payload) ? payload : [payload]).map((row, i) => ({ id: `new-${i}`, ...row }));
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
