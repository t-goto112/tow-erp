/* ─── MockStore V3 ─── */

export interface ProcessEntry {
    id: string;
    name: string;
    subcontractor: string;
    currentQty: number;
    completedQty: number;
    lossQty: number;
    lossConfirmed: boolean;
    unitPrice: number;
    unitPriceOverride: number | null;
    status: "pending" | "in_progress" | "completed";
    deliveries: Delivery[];
    groupIndex: number; // 工程グループ (0=メイン, 1=工程登録2, ...)
}

export interface Delivery {
    id: string;
    qty: number;
    deliveryDate: string;
    completionDate: string;
    dueDate: string;
}

export interface MockLot {
    id: string;
    lotNumber: string;
    product: string;
    productId: string;
    totalQty: number;
    status: "created" | "in_progress" | "completed";
    orderDate: string;
    processes: ProcessEntry[];
}

export interface MockOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    channel: "ec" | "wholesale" | "direct";
    dueDate: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    notes: string;
    items: OrderItem[];
    createdAt: string;
}

export interface OrderItem {
    product: string;
    qty: number;
    unitPrice: number;
    shipped: number;
}

export interface MockProduct {
    id: string;
    name: string;
    code: string;
    processGroups: ProcessGroup[];
}

export interface ProcessGroup {
    id: string;
    label: string; // "工程登録1", "工程登録2"...
    templates: ProcessTemplate[];
}

export interface ProcessTemplate {
    id: string;
    name: string;
    subcontractors: { name: string; unitPrice: number }[];
    sortOrder: number;
    isAssemblyPoint?: boolean; // 新規: 他のパーツグループをここで組み付けるか
}

export interface PaymentLine {
    id: string;
    lotNumber: string;
    processName: string;
    subcontractor: string;
    qty: number;
    unitPrice: number;
    unitPriceOverride: number | null;
    amount: number;
    completionDate: string;
    status: "wip" | "pre_payment" | "paid" | "confirmed";
}

export interface MockInventory {
    id: string;
    product: string;
    code: string;
    quantity: number;
    type: "product" | "material" | "parts"; // パーツを追加
    warehouse: string;
}

export interface UserPermission {
    userId: string;
    email: string;
    name: string;
    role: "admin" | "user";
    permissions: Record<string, { view: boolean; edit: boolean }>;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    action: string;
    detail: string;
    lotNumber?: string;
}

const today = "2026-03-04";
let _uid = Date.now();
function uid() { return `${++_uid}`; }

function createInitialLots(): MockLot[] {
    return [
        {
            id: "lot1", lotNumber: "A23-045", product: "牛刀 210mm", productId: "prod1", totalQty: 500, status: "in_progress", orderDate: "2026-01-15",
            processes: [
                {
                    id: "lp1", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 490, lossQty: 10, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", groupIndex: 0,
                    deliveries: [
                        { id: "d1", qty: 300, deliveryDate: "2026-01-20", completionDate: "2026-02-01", dueDate: "2026-02-05" },
                        { id: "d2", qty: 200, deliveryDate: "2026-02-01", completionDate: "2026-02-10", dueDate: "2026-02-10" },
                    ]
                },
                {
                    id: "lp2", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 190, completedQty: 300, lossQty: 0, lossConfirmed: false, unitPrice: 200, unitPriceOverride: null, status: "in_progress", groupIndex: 0,
                    deliveries: [
                        { id: "d3", qty: 300, deliveryDate: "2026-02-05", completionDate: "2026-02-18", dueDate: "2026-02-20" },
                        { id: "d4", qty: 190, deliveryDate: "2026-02-12", completionDate: "", dueDate: "2026-03-05" },
                    ]
                },
                {
                    id: "lp3", name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 300, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", groupIndex: 0,
                    deliveries: [
                        { id: "d5", qty: 100, deliveryDate: "2026-02-20", completionDate: "", dueDate: "2026-03-05" },
                        { id: "d6", qty: 200, deliveryDate: "2026-02-25", completionDate: "", dueDate: "2026-03-08" },
                    ]
                },
                { id: "lp4", name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", groupIndex: 0, deliveries: [] },
                { id: "lp5", name: "柄付け", subcontractor: "自社", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 0, unitPriceOverride: null, status: "pending", groupIndex: 0, deliveries: [] },
            ],
        },
        {
            id: "lot2", lotNumber: "B12-098", product: "三徳 165mm", productId: "prod2", totalQty: 300, status: "in_progress", orderDate: "2026-02-01",
            processes: [
                {
                    id: "lp6", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 295, lossQty: 5, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", groupIndex: 0,
                    deliveries: [{ id: "d7", qty: 300, deliveryDate: "2026-02-05", completionDate: "2026-02-12", dueDate: "2026-02-12" }]
                },
                {
                    id: "lp7", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 290, lossQty: 5, lossConfirmed: true, unitPrice: 200, unitPriceOverride: null, status: "completed", groupIndex: 0,
                    deliveries: [{ id: "d8", qty: 295, deliveryDate: "2026-02-13", completionDate: "2026-02-20", dueDate: "2026-02-22" }]
                },
                {
                    id: "lp8", name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 90, completedQty: 200, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", groupIndex: 0,
                    deliveries: [
                        { id: "d9", qty: 200, deliveryDate: "2026-02-22", completionDate: "2026-03-01", dueDate: "2026-03-01" },
                        { id: "d10", qty: 90, deliveryDate: "2026-02-28", completionDate: "", dueDate: "2026-03-06" },
                    ]
                },
                {
                    id: "lp9", name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 200, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "in_progress", groupIndex: 0,
                    deliveries: [{ id: "d11", qty: 200, deliveryDate: "2026-03-02", completionDate: "", dueDate: "2026-03-10" }]
                },
            ],
        },
        {
            id: "lot3", lotNumber: "C88-121", product: "ペティ 120mm", productId: "prod3", totalQty: 1000, status: "created", orderDate: "2026-02-10",
            processes: [
                {
                    id: "lp10", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 1000, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", groupIndex: 0,
                    deliveries: [{ id: "d12", qty: 1000, deliveryDate: "2026-03-01", completionDate: "", dueDate: "2026-03-15" }]
                },
                { id: "lp11", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 180, unitPriceOverride: null, status: "pending", groupIndex: 0, deliveries: [] },
            ],
        },
    ];
}

function createInitialOrders(): MockOrder[] {
    return [
        { id: "ord1", orderNumber: "202601-1", customerName: "東京刃物店", channel: "wholesale", dueDate: "2026-03-15", status: "in_progress", notes: "", items: [{ product: "牛刀 210mm", qty: 100, unitPrice: 12000, shipped: 0 }], createdAt: "2026-01-15" },
        { id: "ord2", orderNumber: "202602-1", customerName: "Amazon Japan", channel: "ec", dueDate: "2026-03-20", status: "pending", notes: "急ぎ", items: [{ product: "三徳 165mm", qty: 50, unitPrice: 0, shipped: 0 }, { product: "ペティ 120mm", qty: 30, unitPrice: 0, shipped: 0 }], createdAt: "2026-02-01" },
        { id: "ord3", orderNumber: "202602-2", customerName: "関市ナイフショップ", channel: "direct", dueDate: "2026-04-01", status: "pending", notes: "", items: [{ product: "牛刀 210mm", qty: 200, unitPrice: 0, shipped: 0 }], createdAt: "2026-02-10" },
    ];
}

function createInitialProducts(): MockProduct[] {
    return [
        {
            id: "prod1", name: "牛刀 210mm", code: "GYU-210", processGroups: [
                {
                    id: "pg1", label: "工程登録1", templates: [
                        { id: "pt1", name: "鍛造", subcontractors: [{ name: "鍛造所 田中", unitPrice: 300 }], sortOrder: 1 },
                        { id: "pt2", name: "荒研ぎ", subcontractors: [{ name: "研ぎ工房 山本", unitPrice: 200 }, { name: "研ぎ工房 佐藤", unitPrice: 220 }], sortOrder: 2 },
                        { id: "pt3", name: "熱処理", subcontractors: [{ name: "熱処理 鈴木", unitPrice: 300 }], sortOrder: 3 },
                        { id: "pt4", name: "仕上げ研ぎ", subcontractors: [{ name: "研ぎ工房 佐藤", unitPrice: 250 }], sortOrder: 4 },
                        { id: "pt5", name: "柄付け", subcontractors: [{ name: "自社", unitPrice: 0 }], sortOrder: 5, isAssemblyPoint: true },
                    ]
                },
            ]
        },
        {
            id: "prod2", name: "三徳 165mm", code: "SAN-165", processGroups: [
                {
                    id: "pg2", label: "工程登録1", templates: [
                        { id: "pt6", name: "鍛造", subcontractors: [{ name: "鍛造所 田中", unitPrice: 300 }], sortOrder: 1 },
                        { id: "pt7", name: "荒研ぎ", subcontractors: [{ name: "研ぎ工房 山本", unitPrice: 200 }], sortOrder: 2 },
                        { id: "pt8", name: "熱処理", subcontractors: [{ name: "熱処理 鈴木", unitPrice: 300 }], sortOrder: 3 },
                        { id: "pt9", name: "仕上げ研ぎ", subcontractors: [{ name: "研ぎ工房 佐藤", unitPrice: 250 }], sortOrder: 4 },
                    ]
                },
            ]
        },
        {
            id: "prod3", name: "ペティ 120mm", code: "PET-120", processGroups: [
                {
                    id: "pg3", label: "工程登録1", templates: [
                        { id: "pt10", name: "鍛造", subcontractors: [{ name: "鍛造所 田中", unitPrice: 250 }], sortOrder: 1 },
                        { id: "pt11", name: "荒研ぎ", subcontractors: [{ name: "研ぎ工房 山本", unitPrice: 180 }], sortOrder: 2 },
                    ]
                },
            ]
        },
    ];
}

function createInitialPaymentLines(): PaymentLine[] {
    return [
        { id: "pl1", lotNumber: "A23-045", processName: "鍛造", subcontractor: "鍛造所 田中", qty: 490, unitPrice: 300, unitPriceOverride: null, amount: 147000, completionDate: "2026-02-10", status: "paid" },
        { id: "pl2", lotNumber: "A23-045", processName: "荒研ぎ", subcontractor: "研ぎ工房 山本", qty: 300, unitPrice: 200, unitPriceOverride: null, amount: 60000, completionDate: "2026-02-18", status: "pre_payment" },
        { id: "pl3", lotNumber: "B12-098", processName: "鍛造", subcontractor: "鍛造所 田中", qty: 295, unitPrice: 300, unitPriceOverride: null, amount: 88500, completionDate: "2026-02-12", status: "paid" },
        { id: "pl4", lotNumber: "B12-098", processName: "荒研ぎ", subcontractor: "研ぎ工房 山本", qty: 290, unitPrice: 200, unitPriceOverride: null, amount: 58000, completionDate: "2026-02-20", status: "pre_payment" },
        { id: "pl5", lotNumber: "B12-098", processName: "熱処理", subcontractor: "熱処理 鈴木", qty: 200, unitPrice: 300, unitPriceOverride: null, amount: 60000, completionDate: "2026-03-01", status: "wip" },
    ];
}

function createInitialInventory(): MockInventory[] {
    return [
        { id: "inv1", product: "牛刀 210mm", code: "GYU-210", quantity: 45, type: "product", warehouse: "本社倉庫" },
        { id: "inv2", product: "三徳 165mm", code: "SAN-165", quantity: 120, type: "product", warehouse: "本社倉庫" },
        { id: "inv3", product: "VG10鋼材", code: "MAT-VG10", quantity: 500, type: "material", warehouse: "資材倉庫" },
    ];
}

function createInitialUsers(): UserPermission[] {
    return [
        { userId: "u1", email: "admin@towmei.co.jp", name: "管理者", role: "admin", permissions: { dashboard: { view: true, edit: true }, orders: { view: true, edit: true }, inventory: { view: true, edit: true }, payments: { view: true, edit: true }, routing: { view: true, edit: true }, master: { view: true, edit: true }, lots: { view: true, edit: true }, admin: { view: true, edit: true } } },
        { userId: "u2", email: "user@towmei.co.jp", name: "佐々木", role: "user", permissions: { dashboard: { view: true, edit: false }, orders: { view: true, edit: true }, inventory: { view: true, edit: false }, payments: { view: true, edit: false }, routing: { view: true, edit: true }, master: { view: true, edit: false }, lots: { view: true, edit: false }, admin: { view: false, edit: false } } },
    ];
}

class MockStore {
    lots: MockLot[];
    orders: MockOrder[];
    products: MockProduct[];
    paymentLines: PaymentLine[];
    inventory: MockInventory[];
    users: UserPermission[];
    history: HistoryEntry[];
    private listeners: (() => void)[] = [];

    constructor() {
        this.lots = createInitialLots();
        this.orders = createInitialOrders();
        this.products = createInitialProducts();
        this.paymentLines = createInitialPaymentLines();
        this.inventory = createInitialInventory();
        this.users = createInitialUsers();
        this.history = [];
    }

    subscribe(fn: () => void) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
    private notify() { this.listeners.forEach(fn => fn()); }
    private addHistory(action: string, detail: string, lotNumber?: string) {
        this.history.unshift({ id: `h${uid()}`, timestamp: new Date().toISOString(), action, detail, lotNumber });
    }

    // ─── 次工程へ (外注先選択対応) ───
    moveForward(lotId: string, processIndex: number, qty: number, completionDate: string, nextDeliveryDate: string, nextDueDate: string, opts?: { overridePrice?: number; nextSubcontractor?: string }): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `移動数が現在数(${proc.currentQty})を超えています` };
        if (qty <= 0) return { ok: false, error: "1以上の数量を入力してください" };
        if (!completionDate || !nextDeliveryDate || !nextDueDate) return { ok: false, error: "日付は必須です" };

        if (opts?.overridePrice && opts.overridePrice > 0) proc.unitPriceOverride = opts.overridePrice;

        const existingDel = proc.deliveries.find(d => !d.completionDate);
        if (existingDel) existingDel.completionDate = completionDate;

        proc.currentQty -= qty;
        proc.completedQty += qty;
        if (proc.currentQty === 0 && proc.lossConfirmed) proc.status = "completed";

        const effectivePrice = proc.unitPriceOverride || proc.unitPrice;
        this.paymentLines.push({
            id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: proc.name, subcontractor: proc.subcontractor,
            qty, unitPrice: proc.unitPrice, unitPriceOverride: proc.unitPriceOverride, amount: qty * effectivePrice,
            completionDate, status: "pre_payment",
        });

        const next = lot.processes[processIndex + 1];
        if (next) {
            if (opts?.nextSubcontractor) next.subcontractor = opts.nextSubcontractor;
            next.currentQty += qty;
            if (next.status === "pending") next.status = "in_progress";
            next.deliveries.push({ id: `d${uid()}`, qty, deliveryDate: nextDeliveryDate, completionDate: "", dueDate: nextDueDate });

            // 組み付けポイントの場合、ここでパーツ在庫を消費する（シミュレーション）
            const nextTpl = this.products.find(p => p.id === lot.productId)?.processGroups[next.groupIndex]?.templates.find(t => t.name === next.name);
            if (nextTpl && nextTpl.isAssemblyPoint) {
                // 同じ工程内の他パーツを消費する（簡易実装として、在庫から減らすか、マイナス在庫として記録）
                const partsInv = this.inventory.find(i => i.product === `${lot.product} (パーツ)` && i.type === "parts");
                if (partsInv) {
                    partsInv.quantity = Math.max(0, partsInv.quantity - qty);
                } else {
                    // なければマイナス在庫として記録（後からパーツ実績が上がる場合）
                    this.inventory.push({ id: `inv${uid()}`, product: `${lot.product} (パーツ)`, code: "", quantity: -qty, type: "parts", warehouse: "未定義" });
                }
            }

        } else {
            // 最終工程の場合
            if (proc.groupIndex > 0) {
                // 別グループ（別パーツ）の場合は「仕掛パーツ在庫」として登録
                const existingPart = this.inventory.find(i => i.product === `${lot.product} (パーツ)` && i.type === "parts");
                if (existingPart) existingPart.quantity += qty;
                else this.inventory.push({ id: `inv${uid()}`, product: `${lot.product} (パーツ)`, code: "", quantity: qty, type: "parts", warehouse: "仕掛パーツ置場" });
            }
            // ※メイングループの最終工程の場合は、明示的に「在庫へ移動」か「出荷設定」で処理するためここでは何もしない（未分類バッファとして保持するか、何もしない）
            // 旧来の在庫自動追加ロジックは削除し、UI側で Move To Inventory / Ship ボタンで制御する
        }

        if (lot.status === "created") lot.status = "in_progress";
        if (lot.processes.every(p => p.status === "completed")) lot.status = "completed";

        this.addHistory("工程完了", `${lot.lotNumber} [${proc.name}] → ${qty}個`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }

    // ─── 差戻し (外注先選択対応) ───
    moveBack(lotId: string, processIndex: number, qty: number, returnDate: string, prevDueDate: string, prevSubcontractor?: string): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        if (processIndex <= 0) return { ok: false, error: "最初の工程から差戻しはできません" };
        const proc = lot.processes[processIndex];
        if (!proc || qty > proc.currentQty) return { ok: false, error: "差戻し数が現在数を超えています" };
        if (!returnDate || !prevDueDate) return { ok: false, error: "日付は必須です" };

        proc.currentQty -= qty;
        const prev = lot.processes[processIndex - 1];
        if (prevSubcontractor) prev.subcontractor = prevSubcontractor;
        prev.currentQty += qty;
        if (prev.status === "completed") prev.status = "in_progress";
        prev.deliveries.push({ id: `d${uid()}`, qty, deliveryDate: returnDate, completionDate: "", dueDate: prevDueDate });

        this.addHistory("差戻し", `${lot.lotNumber} [${proc.name}] → ${qty}個を[${prev.name}]へ`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }

    // ─── ロス確定 ───
    confirmLoss(lotId: string, processIndex: number): { ok: boolean; lossQty: number; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, lossQty: 0, error: "ロットが見つかりません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, lossQty: 0, error: "工程が見つかりません" };
        const loss = proc.currentQty;
        proc.lossQty += loss;
        proc.currentQty = 0;
        proc.lossConfirmed = true;
        proc.status = "completed";

        if (lot.processes.every(p => p.status === "completed")) {
            lot.status = "completed";
            this.orders.forEach(o => {
                if (o.items.some(i => i.product === lot.product) && o.status !== "cancelled") o.status = "completed";
            });
        }

        this.addHistory("ロス確定", `${lot.lotNumber} [${proc.name}] → ${loss}個廃棄`, lot.lotNumber);
        this.notify();
        return { ok: true, lossQty: loss };
    }

    // ─── カード編集: 納入実績の数量変更 → 前工程連動 ───
    updateDelivery(lotId: string, processIndex: number, deliveryId: string, newQty: number, newDeliveryDate?: string, newDueDate?: string) {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return;
        const proc = lot.processes[processIndex];
        if (!proc) return;
        const del = proc.deliveries.find(d => d.id === deliveryId);
        if (!del) return;

        const diff = newQty - del.qty;
        del.qty = newQty;
        if (newDeliveryDate) del.deliveryDate = newDeliveryDate;
        if (newDueDate) del.dueDate = newDueDate;

        // 数量が変わった場合、現工程のcurrentQtyを調整し、前工程に差分を反映
        if (diff !== 0) {
            proc.currentQty += diff;
            if (processIndex > 0) {
                const prev = lot.processes[processIndex - 1];
                prev.currentQty -= diff; // 減った分は前工程に戻す、増えた分は前工程から引く
                if (prev.currentQty < 0) { prev.completedQty += prev.currentQty; prev.currentQty = 0; }
            }
        }

        this.addHistory("納入編集", `${lot.lotNumber} [${proc.name}] 数量→${newQty}`, lot.lotNumber);
        this.notify();
    }

    // ─── 受注 ───
    createOrder(order: Omit<MockOrder, "id" | "createdAt">): MockOrder {
        const o: MockOrder = { ...order, id: `ord${uid()}`, createdAt: new Date().toISOString().split("T")[0] };
        this.orders.unshift(o);
        this.addHistory("受注作成", `${o.orderNumber} - ${o.customerName}`);
        this.notify();
        return o;
    }

    deleteOrder(orderId: string) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        // 関連ロットも削除
        order.items.forEach(item => {
            this.lots = this.lots.filter(l => !(l.product === item.product && l.status !== "completed"));
        });
        // 関連支払行も削除
        const relatedLots = this.lots.filter(l => order.items.some(i => i.product === l.product));
        // 受注自体を削除
        this.orders = this.orders.filter(o => o.id !== orderId);
        this.addHistory("受注削除", `${order.orderNumber} - ${order.customerName}`);
        this.notify();
    }

    // ─── 商品(マスタ) ───
    createProduct(data: Omit<MockProduct, "id">): MockProduct {
        const p: MockProduct = { id: `prod${uid()}`, ...data };
        this.products.push(p);
        this.addHistory("商品登録", `${p.code} - ${p.name}`);
        this.notify();
        return p;
    }

    updateProduct(id: string, data: Partial<MockProduct>) {
        const p = this.products.find(pr => pr.id === id);
        if (p) { Object.assign(p, data); this.addHistory("商品更新", p.name); this.notify(); }
    }

    deleteProduct(id: string) {
        this.products = this.products.filter(p => p.id !== id);
        this.addHistory("商品削除", `ID: ${id}`);
        this.notify();
    }

    // ─── 支払フロー ───
    advancePayment(id: string) {
        const pl = this.paymentLines.find(p => p.id === id);
        if (!pl) return;
        if (pl.status === "pre_payment") pl.status = "paid";
        else if (pl.status === "paid") pl.status = "confirmed";
        this.addHistory("支払進行", `${pl.lotNumber} ${pl.processName} → ${pl.status}`);
        this.notify();
    }

    revertPayment(id: string) {
        const pl = this.paymentLines.find(p => p.id === id);
        if (!pl) return;
        if (pl.status === "confirmed") pl.status = "paid";
        else if (pl.status === "paid") pl.status = "pre_payment";
        this.addHistory("支払取消", `${pl.lotNumber} ${pl.processName} → ${pl.status}`);
        this.notify();
    }

    updatePaymentLine(id: string, qty: number, overridePrice: number | null) {
        const pl = this.paymentLines.find(p => p.id === id);
        if (!pl) return;
        pl.qty = qty; pl.unitPriceOverride = overridePrice;
        pl.amount = qty * (overridePrice || pl.unitPrice);
        this.notify();
    }

    // ─── 在庫・出荷処理 (V4追加) ───
    adjustInventory(id: string, newQty: number, reason: string) {
        const item = this.inventory.find(i => i.id === id);
        if (item) { const old = item.quantity; item.quantity = newQty; this.addHistory("在庫修正", `${item.product}: ${old} → ${newQty} (${reason})`); this.notify(); }
    }

    updateWarehouse(id: string, warehouse: string) {
        const item = this.inventory.find(i => i.id === id);
        if (item) { item.warehouse = warehouse; this.addHistory("倉庫変更", `${item.product} → ${warehouse}`); this.notify(); }
    }

    moveToInventory(lotId: string, processIndex: number, qty: number, warehouse: string): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `移動数が現在数(${proc.currentQty})を超えています` };

        proc.currentQty -= qty;
        proc.completedQty += qty;
        if (proc.currentQty === 0 && proc.lossConfirmed) proc.status = "completed";
        if (lot.processes.every(p => p.status === "completed")) lot.status = "completed";

        const existing = this.inventory.find(i => i.product === lot.product && i.type === "product" && i.warehouse === warehouse);
        if (existing) existing.quantity += qty;
        else this.inventory.push({ id: `inv${uid()}`, product: lot.product, code: "", quantity: qty, type: "product", warehouse });

        this.addHistory("在庫移動", `${lot.lotNumber} → ${warehouse}へ${qty}個`);
        this.notify();
        return { ok: true };
    }

    shipAndInvoice(lotId: string, processIndex: number, qty: number): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `出荷数が現在数(${proc.currentQty})を超えています` };

        // 該当商品の未完了受注を探し、出荷数を割り当てる
        let remainingQty = qty;
        this.orders.filter(o => o.status !== "completed" && o.status !== "cancelled").forEach(order => {
            const item = order.items.find(i => i.product === lot.product);
            if (item && remainingQty > 0) {
                const diff = Math.min(remainingQty, item.qty - item.shipped);
                item.shipped += diff;
                remainingQty -= diff;
                if (order.items.every(xi => xi.shipped >= xi.qty)) order.status = "completed";
            }
        });

        proc.currentQty -= qty;
        proc.completedQty += qty;
        if (proc.currentQty === 0 && proc.lossConfirmed) proc.status = "completed";
        if (lot.processes.every(p => p.status === "completed")) lot.status = "completed";

        this.addHistory("発送・納品", `${lot.lotNumber} → ${qty}個出荷、売上計上`);
        this.notify();
        return { ok: true };
    }

    // ─── 権限 ───
    updatePermission(userId: string, page: string, type: "view" | "edit", value: boolean) {
        const u = this.users.find(usr => usr.userId === userId);
        if (u) { if (!u.permissions[page]) u.permissions[page] = { view: true, edit: false }; u.permissions[page][type] = value; this.notify(); }
    }

    // ─── 外注先一覧 (工程名から取得) ───
    getSubcontractorsForProcess(productId: string, processName: string): { name: string; unitPrice: number }[] {
        const product = this.products.find(p => p.id === productId);
        if (!product) return [];
        for (const group of product.processGroups) {
            const tpl = group.templates.find(t => t.name === processName);
            if (tpl) return tpl.subcontractors;
        }
        return [];
    }

    // ─── 集計 ───
    get totalOrderBacklog(): number {
        return this.orders.filter(o => o.status !== "completed" && o.status !== "cancelled")
            .reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty * i.unitPrice, 0), 0);
    }

    get nextOrderNumber(): string {
        const now = new Date();
        const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const existing = this.orders.filter(o => o.orderNumber.startsWith(prefix));
        return `${prefix}-${existing.length + 1}`;
    }

    get deadlineAlerts() {
        const alerts: { lot: string; product: string; process: string; qty: number; dueDate: string; isOverdue: boolean }[] = [];
        this.lots.forEach(lot => {
            if (lot.status === "completed") return;
            lot.processes.forEach(p => {
                p.deliveries.forEach(d => {
                    if (d.completionDate) return;
                    alerts.push({ lot: lot.lotNumber, product: lot.product, process: p.name, qty: d.qty, dueDate: d.dueDate, isOverdue: d.dueDate < today });
                });
            });
        });
        return alerts.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
}

export const store = new MockStore();
