/* ─── Mock Store: ブラウザメモリ上で全機能をテスト可能にするインメモリDB ─── */

export interface MockLot {
    id: string;
    lotNumber: string;
    product: string;
    productId: string;
    totalQty: number;
    status: "created" | "in_progress" | "completed";
    processes: MockProcess[];
}

export interface MockProcess {
    id: string;
    name: string;
    subcontractor: string;
    currentQty: number;      // この工程に現在ある数量
    completedQty: number;    // この工程を完了して次へ送った数量
    lossQty: number;         // 確定ロス
    lossConfirmed: boolean;  // ロス確定済みか
    unitPrice: number;       // 外注単価
    unitPriceOverride: number | null; // 特値
    status: "pending" | "in_progress" | "completed";
    dueDate: string;
}

export interface MockOrder {
    id: string;
    orderNumber: string;
    customerName: string;
    channel: "ec" | "wholesale" | "direct";
    dueDate: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    notes: string;
    items: { product: string; qty: number; unitPrice: number; shipped: number }[];
    createdAt: string;
}

export interface MockProduct {
    id: string;
    name: string;
    code: string;
    materialCost: number;
    processCount: number;
}

export interface MockSubcontractor {
    id: string;
    name: string;
    contactInfo: string;
    rateCount: number;
}

export interface MockProcessMaster {
    id: string;
    name: string;
    isParallel: boolean;
    category: string;
}

export interface MockPayment {
    id: string;
    subcontractor: string;
    periodStart: string;
    periodEnd: string;
    status: "draft" | "pending_approval" | "approved" | "paid";
    totalAmount: number;
    items: { lot: string; process: string; good: number; unitPrice: number; amount: number; override: boolean }[];
}

export interface MockInventory {
    id: string;
    product: string;
    code: string;
    lot: string;
    quantity: number;
    type: "product" | "material";
    warehouse: string;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    action: string;
    detail: string;
    lotNumber?: string;
}

// ─── 初期データ ───
function createInitialLots(): MockLot[] {
    return [
        {
            id: "lot1", lotNumber: "A23-045", product: "牛刀 210mm", productId: "prod1", totalQty: 500, status: "in_progress",
            processes: [
                { id: "lp1", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 490, lossQty: 10, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", dueDate: "2026-02-10" },
                { id: "lp2", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 190, completedQty: 300, lossQty: 0, lossConfirmed: false, unitPrice: 200, unitPriceOverride: null, status: "in_progress", dueDate: "2026-02-20" },
                { id: "lp3", name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 300, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", dueDate: "2026-02-28" },
                { id: "lp4", name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", dueDate: "2026-03-05" },
                { id: "lp5", name: "柄付け", subcontractor: "自社", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 0, unitPriceOverride: null, status: "pending", dueDate: "2026-03-10" },
            ],
        },
        {
            id: "lot2", lotNumber: "B12-098", product: "三徳 165mm", productId: "prod2", totalQty: 300, status: "in_progress",
            processes: [
                { id: "lp6", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 295, lossQty: 5, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", dueDate: "2026-02-05" },
                { id: "lp7", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 290, lossQty: 5, lossConfirmed: true, unitPrice: 200, unitPriceOverride: null, status: "completed", dueDate: "2026-02-12" },
                { id: "lp8", name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 90, completedQty: 200, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", dueDate: "2026-02-25" },
                { id: "lp9", name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 200, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "in_progress", dueDate: "2026-03-01" },
            ],
        },
        {
            id: "lot3", lotNumber: "C88-121", product: "ペティ 120mm", productId: "prod3", totalQty: 1000, status: "created",
            processes: [
                { id: "lp10", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 1000, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", dueDate: "2026-03-10" },
                { id: "lp11", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 180, unitPriceOverride: null, status: "pending", dueDate: "2026-03-20" },
            ],
        },
    ];
}

function createInitialOrders(): MockOrder[] {
    return [
        { id: "ord1", orderNumber: "ORD-2026-001", customerName: "東京刃物店", channel: "wholesale", dueDate: "2026-03-15", status: "in_progress", notes: "", items: [{ product: "牛刀 210mm", qty: 100, unitPrice: 12000, shipped: 0 }], createdAt: "2026-01-15" },
        { id: "ord2", orderNumber: "ORD-2026-002", customerName: "Amazon Japan", channel: "ec", dueDate: "2026-03-20", status: "pending", notes: "急ぎ", items: [{ product: "三徳 165mm", qty: 50, unitPrice: 8000, shipped: 0 }, { product: "ペティ 120mm", qty: 30, unitPrice: 5000, shipped: 0 }], createdAt: "2026-02-01" },
        { id: "ord3", orderNumber: "ORD-2026-003", customerName: "関市ナイフショップ", channel: "direct", dueDate: "2026-04-01", status: "pending", notes: "", items: [{ product: "牛刀 210mm", qty: 200, unitPrice: 11500, shipped: 0 }], createdAt: "2026-02-10" },
    ];
}

function createInitialProducts(): MockProduct[] {
    return [
        { id: "prod1", name: "牛刀 210mm", code: "GYU-210", materialCost: 800, processCount: 5 },
        { id: "prod2", name: "三徳 165mm", code: "SAN-165", materialCost: 600, processCount: 4 },
        { id: "prod3", name: "ペティ 120mm", code: "PET-120", materialCost: 400, processCount: 3 },
        { id: "prod4", name: "出刃 180mm", code: "DEB-180", materialCost: 900, processCount: 5 },
    ];
}

function createInitialSubcontractors(): MockSubcontractor[] {
    return [
        { id: "sub1", name: "鍛造所 田中", contactInfo: "0575-22-XXXX", rateCount: 3 },
        { id: "sub2", name: "研ぎ工房 山本", contactInfo: "0575-33-XXXX", rateCount: 4 },
        { id: "sub3", name: "熱処理 鈴木", contactInfo: "0575-44-XXXX", rateCount: 2 },
        { id: "sub4", name: "研ぎ工房 佐藤", contactInfo: "0575-55-XXXX", rateCount: 2 },
    ];
}

function createInitialProcessMasters(): MockProcessMaster[] {
    return [
        { id: "pm1", name: "鍛造", isParallel: false, category: "自社" },
        { id: "pm2", name: "荒研ぎ", isParallel: true, category: "外注" },
        { id: "pm3", name: "熱処理", isParallel: false, category: "外注" },
        { id: "pm4", name: "仕上げ研ぎ", isParallel: true, category: "外注" },
        { id: "pm5", name: "柄付け", isParallel: false, category: "自社" },
    ];
}

function createInitialPayments(): MockPayment[] {
    return [
        {
            id: "pay1", subcontractor: "鍛造所 田中", periodStart: "2026-02-01", periodEnd: "2026-02-28",
            status: "pending_approval", totalAmount: 245000,
            items: [
                { lot: "A23-045", process: "鍛造", good: 490, unitPrice: 300, amount: 147000, override: false },
                { lot: "B12-098", process: "鍛造", good: 295, unitPrice: 300, amount: 88500, override: false },
            ],
        },
        {
            id: "pay2", subcontractor: "研ぎ工房 山本", periodStart: "2026-02-01", periodEnd: "2026-02-28",
            status: "draft", totalAmount: 118000,
            items: [
                { lot: "A23-045", process: "荒研ぎ", good: 300, unitPrice: 200, amount: 60000, override: false },
                { lot: "B12-098", process: "荒研ぎ", good: 290, unitPrice: 200, amount: 58000, override: false },
            ],
        },
    ];
}

function createInitialInventory(): MockInventory[] {
    return [
        { id: "inv1", product: "牛刀 210mm", code: "GYU-210", lot: "Z99-001", quantity: 45, type: "product", warehouse: "本社倉庫" },
        { id: "inv2", product: "三徳 165mm", code: "SAN-165", lot: "Z99-002", quantity: 120, type: "product", warehouse: "本社倉庫" },
        { id: "inv3", product: "VG10鋼材", code: "MAT-VG10", lot: "-", quantity: 500, type: "material", warehouse: "資材倉庫" },
    ];
}

// ─── Store Class ───
class MockStore {
    lots: MockLot[];
    orders: MockOrder[];
    products: MockProduct[];
    subcontractors: MockSubcontractor[];
    processMasters: MockProcessMaster[];
    payments: MockPayment[];
    inventory: MockInventory[];
    history: HistoryEntry[];
    private listeners: (() => void)[] = [];

    constructor() {
        this.lots = createInitialLots();
        this.orders = createInitialOrders();
        this.products = createInitialProducts();
        this.subcontractors = createInitialSubcontractors();
        this.processMasters = createInitialProcessMasters();
        this.payments = createInitialPayments();
        this.inventory = createInitialInventory();
        this.history = [];
    }

    subscribe(fn: () => void) {
        this.listeners.push(fn);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        this.listeners.forEach(fn => fn());
    }

    private addHistory(action: string, detail: string, lotNumber?: string) {
        this.history.unshift({
            id: `h${Date.now()}`,
            timestamp: new Date().toISOString(),
            action,
            detail,
            lotNumber,
        });
    }

    // ─── バケツリレー: 次工程へ移動 ───
    moveForward(lotId: string, processIndex: number, qty: number): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `移動数が現在数(${proc.currentQty})を超えています` };
        if (qty <= 0) return { ok: false, error: "1以上の数量を入力してください" };

        proc.currentQty -= qty;
        proc.completedQty += qty;
        if (proc.currentQty === 0 && proc.lossConfirmed) proc.status = "completed";

        // 次工程があれば加算
        const next = lot.processes[processIndex + 1];
        if (next) {
            next.currentQty += qty;
            if (next.status === "pending") next.status = "in_progress";
        } else {
            // 最終工程 → 在庫計上
            const existing = this.inventory.find(i => i.product === lot.product && i.lot === lot.lotNumber);
            if (existing) {
                existing.quantity += qty;
            } else {
                this.inventory.push({ id: `inv${Date.now()}`, product: lot.product, code: "", lot: lot.lotNumber, quantity: qty, type: "product", warehouse: "本社倉庫" });
            }
        }

        if (lot.status === "created") lot.status = "in_progress";
        this.addHistory("工程完了", `${lot.lotNumber} [${proc.name}] → ${qty}個を次工程へ`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }

    // ─── バケツリレー: 差戻し ───
    moveBack(lotId: string, processIndex: number, qty: number): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        if (processIndex <= 0) return { ok: false, error: "最初の工程から差戻しはできません" };
        const proc = lot.processes[processIndex];
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `差戻し数が現在数(${proc.currentQty})を超えています` };
        if (qty <= 0) return { ok: false, error: "1以上の数量を入力してください" };

        proc.currentQty -= qty;
        const prev = lot.processes[processIndex - 1];
        prev.currentQty += qty;
        if (prev.status === "completed") prev.status = "in_progress";

        this.addHistory("差戻し", `${lot.lotNumber} [${proc.name}] → ${qty}個を[${prev.name}]へ戻す`, lot.lotNumber);
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

        this.addHistory("ロス確定", `${lot.lotNumber} [${proc.name}] → ${loss}個を廃棄確定`, lot.lotNumber);
        this.notify();
        return { ok: true, lossQty: loss };
    }

    // ─── 受注CRUD ───
    createOrder(order: Omit<MockOrder, "id" | "createdAt">): MockOrder {
        const newOrder: MockOrder = { ...order, id: `ord${Date.now()}`, createdAt: new Date().toISOString().split("T")[0] };
        this.orders.unshift(newOrder);
        this.addHistory("受注作成", `${newOrder.orderNumber} - ${newOrder.customerName}`);
        this.notify();
        return newOrder;
    }

    // ─── マスタCRUD ───
    createProduct(data: { name: string; code: string; materialCost: number }): MockProduct {
        const p: MockProduct = { id: `prod${Date.now()}`, processCount: 0, ...data };
        this.products.push(p);
        this.addHistory("商品登録", `${p.code} - ${p.name}`);
        this.notify();
        return p;
    }

    createProcessMaster(data: { name: string; isParallel: boolean; category: string }): MockProcessMaster {
        const p: MockProcessMaster = { id: `pm${Date.now()}`, ...data };
        this.processMasters.push(p);
        this.addHistory("工程登録", p.name);
        this.notify();
        return p;
    }

    createSubcontractor(data: { name: string; contactInfo: string }): MockSubcontractor {
        const s: MockSubcontractor = { id: `sub${Date.now()}`, rateCount: 0, ...data };
        this.subcontractors.push(s);
        this.addHistory("外注先登録", s.name);
        this.notify();
        return s;
    }

    deleteItem(type: "products" | "processMasters" | "subcontractors", id: string) {
        if (type === "products") this.products = this.products.filter(p => p.id !== id);
        else if (type === "processMasters") this.processMasters = this.processMasters.filter(p => p.id !== id);
        else if (type === "subcontractors") this.subcontractors = this.subcontractors.filter(s => s.id !== id);
        this.addHistory("削除", `${type} ID: ${id}`);
        this.notify();
    }

    // ─── 支払 ───
    approvePayment(id: string) {
        const p = this.payments.find(pay => pay.id === id);
        if (p) { p.status = "approved"; this.addHistory("支払承認", p.subcontractor); this.notify(); }
    }

    // ─── 在庫修正 ───
    adjustInventory(id: string, newQty: number, reason: string) {
        const item = this.inventory.find(i => i.id === id);
        if (item) {
            const old = item.quantity;
            item.quantity = newQty;
            this.addHistory("在庫修正", `${item.product}: ${old} → ${newQty} (${reason})`);
            this.notify();
        }
    }

    // ─── 集計 ───
    get totalOrderBacklog(): number {
        return this.orders.filter(o => o.status !== "completed" && o.status !== "cancelled")
            .reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty * i.unitPrice, 0), 0);
    }

    get totalWIP(): number {
        return this.lots.reduce((s, l) => s + l.processes.reduce((ss, p) => ss + p.currentQty, 0), 0);
    }

    get totalPaymentDue(): number {
        return this.payments.filter(p => p.status === "pending_approval" || p.status === "approved")
            .reduce((s, p) => s + p.totalAmount, 0);
    }
}

// シングルトン
export const store = new MockStore();
