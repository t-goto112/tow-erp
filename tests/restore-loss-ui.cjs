// Run from staged app: node tests/restore-loss-ui.cjs
// Isolated React hook/element harness; no database or network calls.
const path = require('path');
const fs = require('fs');
const ts = require(path.join(process.cwd(), 'node_modules/typescript'));
const vm = require('vm');
const assert = require('assert');
let slots = [], cursor = 0, effects = [], calls = [], refreshes = 0, resolveRPC, fail = false;
const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useState: init => { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
  useRef: init => { const i = cursor++; return slots[i] ?? (slots[i] = { current: init }); },
  useMemo: fn => fn(), useCallback: fn => fn,
  useEffect: (fn, deps) => { const i = cursor++; if (!slots[i] || deps.some((d, j) => !Object.is(d, slots[i][j]))) { slots[i] = deps; effects.push(fn); } }
};
const proc = (id, loss, sub = 's', active = true) => ({ id, process_id: 'p', subcontractor_id: sub, input_quantity: loss + 2, completed_quantity: 2, loss_qty: loss, status: 'completed', processes: { name: '工程', is_active: active, sort_order: 1, group_index: 0 }, subcontractors: { name: '外注先' } });
let data = { lots: [{ id: 'l', status: 'completed', total_quantity: 20, lot_number: 'L1', products: { name: '品' }, lot_processes: [proc('a', 3), proc('b', 4)] }], processes: [], productGroups: [], inventory: [], subcontractors: [], warehouses: [], processRates: [], loading: false, profile: { role: 'admin' }, refresh: async () => { refreshes++; } };
const services = { restoreLoss: async (...args) => { calls.push(args); if (fail) throw new Error('通信失敗'); await new Promise(r => resolveRPC = r); } };
const router = { replace() {} };
const mocks = { react, 'next/navigation': { useRouter: () => router }, 'lucide-react': {}, '@/components/Toast': { showToast() {} }, '@/components/ConfirmDialog': { default: 'ConfirmDialog', __esModule: true }, '@/lib/useSupabaseData': { useSupabaseData: () => data }, '@/lib/services/routingService': services };
const moduleObj = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/routing/page.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, { module: moduleObj, exports: moduleObj.exports, require: n => mocks[n], crypto: require('crypto'), console });
function render() { let tree; for (let i = 0; i < 6; i++) { cursor = 0; tree = moduleObj.exports.default(); const run = effects; effects = []; if (!run.length) return tree; run.forEach(f => f()); } throw new Error('Effect render loop'); }
function nodes(t) { return t && typeof t === 'object' ? [t, ...(t.children || []).flatMap(nodes)] : []; }
function text(t) { return typeof t === 'string' || typeof t === 'number' ? String(t) : (t?.children || []).map(text).join(''); }
function find(t, type, content) { return nodes(t).find(n => n.type === type && (!content || text(n).includes(content))); }
function selectGroup() { let tree = render(); find(tree, 'select').props.onChange({ target: { value: 'l' } }); tree = render(); nodes(tree).filter(n => n.type === 'select')[1].props.onChange({ target: { value: 'a' } }); return render(); }
(async () => {
  let tree = selectGroup();
  assert(text(tree).includes('ロスから戻す'));
  for (const label of ['次工程へ送る', '仕掛登録', '差戻す']) assert(!text(tree).includes(label));
  assert.equal(find(tree, 'input').props.value, '7'); assert.equal(find(tree, 'input').props.max, 7);
  for (const value of ['0', '-1', '1.5', '8', '']) { find(tree, 'input').props.onChange({ target: { value } }); tree = render(); assert(find(tree, 'button', 'ロスから戻す').props.disabled); }
  find(tree, 'input').props.onChange({ target: { value: '3' } }); tree = render(); find(tree, 'button', 'ロスから戻す').props.onClick(); tree = render();
  let dialog = nodes(tree).find(n => n.type === 'ConfirmDialog' && n.props.open); assert(dialog.props.message.includes('復元後の現在数は 3個'));
  fail = true; await dialog.props.onConfirm(); tree = render(); await dialog.props.onConfirm(); assert.equal(calls[0][3], calls[1][3]);
  find(tree, 'input').props.onChange({ target: { value: '2' } }); tree = render(); dialog = nodes(tree).find(n => n.type === 'ConfirmDialog' && n.props.title === 'ロスから戻しますか？');
  fail = false; const pending = dialog.props.onConfirm(); dialog.props.onConfirm(); assert.equal(calls.length, 3); assert.notEqual(calls[2][3], calls[1][3]); resolveRPC(); await pending; tree = render(); assert.equal(refreshes, 1); assert(!find(tree, 'button', 'ロスから戻す'));
  slots = []; data.lots.push({ ...data.lots[0], id: 'cancel', status: 'cancelled' }, { ...data.lots[0], id: 'inactive', lot_processes: [proc('i', 2, 's', false)] }, { ...data.lots[0], id: 'orderCancel', orders: { status: 'cancelled' } }); tree = render();
  const values = nodes(tree).filter(n => n.type === 'option').map(n => n.props.value); for (const id of ['cancel', 'inactive', 'orderCancel']) assert(!values.includes(id));
  slots = []; data.lots[0] = { ...data.lots[0], status: 'in_progress' }; tree = selectGroup();
  let qty = nodes(tree).find(n => n.type === 'input' && n.props.placeholder === '最大 0'); qty.props.onChange({ target: { value: '123' } }); tree = render();
  data = { ...data, lots: JSON.parse(JSON.stringify(data.lots)), processRates: [...data.processRates] }; tree = render(); qty = nodes(tree).find(n => n.type === 'input' && n.props.placeholder === '最大 0'); assert.equal(qty.props.value, '123', 'background refresh must preserve draft input');
  data.profile = { role: 'staff', permissions: { routing: { view: true, edit: false } } }; tree = render(); assert(!find(tree, 'button', 'ロスから戻す'));
  slots = []; data.profile = { role: 'admin' }; data.lots[0].lot_processes = [proc('a', 3, null)]; tree = selectGroup(); assert(find(tree, 'button', 'ロスから戻す').props.disabled); assert(text(tree).includes('外注先が未設定'));
  console.log('PASS: group sum, all-loss default, quantity validation, restore-only completed lot, confirmation, retry UUID, changed args UUID, double-submit guard, refresh/deselect, canceled lot/order, inactive process, draft preservation on refresh, read-only permission, missing subcontractor');
})().catch(e => { console.error(e); process.exitCode = 1; });
