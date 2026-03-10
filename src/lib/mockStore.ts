/* ─── MockStore V7.2 Final ─── */

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
    stepOrder: number;  // 工程順序番号
    isAssemblyPoint?: boolean; // 合流ポイントか
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
    orderId?: string;
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

function uid() {
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function createInitialLots(): MockLot[] {
    const lot1Id = `lot_${uid()}`;
    const lot1Num = "A23-045";
    const lot2Id = `lot_${uid()}`;
    const lot2Num = "B12-098";
    const lot3Id = `lot_${uid()}`;
    const lot3Num = "C88-121";

    return [
        {
            id: lot1Id, lotNumber: lot1Num, product: "牛刀 210mm", productId: "prod1", totalQty: 500, status: "in_progress", orderDate: "2026-01-15",
            processes: [
                {
                    id: `lp_${uid()}`, name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 490, lossQty: 10, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", groupIndex: 0, stepOrder: 1,
                    deliveries: [
                        { id: `d_${uid()}`, qty: 300, deliveryDate: "2026-01-20", completionDate: "2026-02-01", dueDate: "2026-02-05" },
                        { id: `d_${uid()}`, qty: 200, deliveryDate: "2026-02-01", completionDate: "2026-02-10", dueDate: "2026-02-10" },
                    ]
                },
                {
                    id: `lp_${uid()}`, name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 190, completedQty: 300, lossQty: 0, lossConfirmed: false, unitPrice: 200, unitPriceOverride: null, status: "in_progress", groupIndex: 0, stepOrder: 2,
                    deliveries: [
                        { id: `d_${uid()}`, qty: 300, deliveryDate: "2026-02-05", completionDate: "2026-02-18", dueDate: "2026-02-20" },
                        { id: `d_${uid()}`, qty: 190, deliveryDate: "2026-02-12", completionDate: "", dueDate: "2026-03-05" },
                    ]
                },
                {
                    id: `lp_${uid()}`, name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 300, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", groupIndex: 0, stepOrder: 3,
                    deliveries: [
                        { id: `d_${uid()}`, qty: 100, deliveryDate: "2026-02-20", completionDate: "", dueDate: "2026-03-05" },
                        { id: `d_${uid()}`, qty: 200, deliveryDate: "2026-02-25", completionDate: "", dueDate: "2026-03-08" },
                    ]
                },
                { id: `lp_${uid()}`, name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", groupIndex: 0, stepOrder: 4, deliveries: [] },
                { id: `lp_${uid()}`, name: "柄付け", subcontractor: "自社", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 0, unitPriceOverride: null, status: "pending", groupIndex: 0, stepOrder: 5, isAssemblyPoint: true, deliveries: [] },
            ],
        },
        {
            id: lot2Id, lotNumber: lot2Num, product: "三徳 165mm", productId: "prod2", totalQty: 300, status: "in_progress", orderDate: "2026-02-01",
            processes: [
                {
                    id: `lp_${uid()}`, name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 0, completedQty: 295, lossQty: 5, lossConfirmed: true, unitPrice: 300, unitPriceOverride: null, status: "completed", groupIndex: 0, stepOrder: 1,
                    deliveries: [{ id: `d_${uid()}`, qty: 300, deliveryDate: "2026-02-05", completionDate: "2026-02-12", dueDate: "2026-02-12" }]
                },
                {
                    id: `lp_${uid()}`, name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 290, lossQty: 5, lossConfirmed: true, unitPrice: 200, unitPriceOverride: null, status: "completed", groupIndex: 0, stepOrder: 2,
                    deliveries: [{ id: `d_${uid()}`, qty: 295, deliveryDate: "2026-02-13", completionDate: "2026-02-20", dueDate: "2026-02-22" }]
                },
                {
                    id: `lp_${uid()}`, name: "熱処理", subcontractor: "熱処理 鈴木", currentQty: 90, completedQty: 200, lossQty: 0, lossConfirmed: false, unitPrice: 300, unitPriceOverride: null, status: "in_progress", groupIndex: 0, stepOrder: 3,
                    deliveries: [
                        { id: `d_${uid()}`, qty: 200, deliveryDate: "2026-02-22", completionDate: "2026-03-01", dueDate: "2026-03-01" },
                        { id: `d_${uid()}`, qty: 90, deliveryDate: "2026-02-28", completionDate: "", dueDate: "2026-03-06" },
                    ]
                },
                {
                    id: `lp_${uid()}`, name: "仕上げ研ぎ", subcontractor: "研ぎ工房 佐藤", currentQty: 200, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "in_progress", groupIndex: 0, stepOrder: 4,
                    deliveries: [{ id: `d_${uid()}`, qty: 200, deliveryDate: "2026-03-02", completionDate: "", dueDate: "2026-03-10" }]
                },
            ],
        },
        {
            id: "lot3", lotNumber: "C88-121", product: "ペティ 120mm", productId: "prod3", totalQty: 1000, status: "created", orderDate: "2026-02-10",
            processes: [
                {
                    id: "lp10", name: "鍛造", subcontractor: "鍛造所 田中", currentQty: 1000, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 250, unitPriceOverride: null, status: "pending", groupIndex: 0, stepOrder: 1,
                    deliveries: [{ id: "d12", qty: 1000, deliveryDate: "2026-03-01", completionDate: "", dueDate: "2026-03-15" }]
                },
                { id: "lp11", name: "荒研ぎ", subcontractor: "研ぎ工房 山本", currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false, unitPrice: 180, unitPriceOverride: null, status: "pending", groupIndex: 0, stepOrder: 2, deliveries: [] },
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
        { id: `pl_${uid()}`, lotNumber: "A23-045", processName: "鍛造", subcontractor: "鍛造所 田中", qty: 490, unitPrice: 300, unitPriceOverride: null, amount: 147000, completionDate: "2026-02-10", status: "paid" },
        { id: `pl_${uid()}`, lotNumber: "A23-045", processName: "荒研ぎ", subcontractor: "研ぎ工房 山本", qty: 300, unitPrice: 200, unitPriceOverride: null, amount: 60000, completionDate: "2026-02-18", status: "pre_payment" },
        { id: `pl_${uid()}`, lotNumber: "B12-098", processName: "鍛造", subcontractor: "鍛造所 田中", qty: 295, unitPrice: 300, unitPriceOverride: null, amount: 88500, completionDate: "2026-02-12", status: "paid" },
        { id: `pl_${uid()}`, lotNumber: "B12-098", processName: "荒研ぎ", subcontractor: "研ぎ工房 山本", qty: 290, unitPrice: 200, unitPriceOverride: null, amount: 58000, completionDate: "2026-02-20", status: "pre_payment" },
        { id: `pl_${uid()}`, lotNumber: "B12-098", processName: "熱処理", subcontractor: "熱処理 鈴木", qty: 200, unitPrice: 300, unitPriceOverride: null, amount: 60000, completionDate: "2026-03-01", status: "wip" },
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
        this.lots = [];
        this.orders = [];
        this.products = [];
        this.paymentLines = [];
        this.inventory = [];
        this.users = [];
        this.history = [];
        this.load();

        // 初回起動時のみ初期データを投入
        if (this.products.length === 0) {
            this.lots = createInitialLots();
            this.orders = createInitialOrders();
            this.products = createInitialProducts();
            this.paymentLines = createInitialPaymentLines();
            this.inventory = createInitialInventory();
            this.users = createInitialUsers();
            this.save();
        }
    }

    private load() {
        if (typeof window === "undefined") return;
        try {
            const data = localStorage.getItem("tow_erp_storage");
            if (data) {
                const parsed = JSON.parse(data);
                this.lots = parsed.lots || [];
                this.orders = parsed.orders || [];
                this.products = parsed.products || [];
                this.paymentLines = parsed.paymentLines || [];
                this.inventory = parsed.inventory || [];
                this.users = parsed.users || [];
                this.history = parsed.history || [];
            }
        } catch (e) {
            console.error("Failed to load from storage", e);
        }
    }

    private save() {
        if (typeof window === "undefined") return;
        try {
            const data = JSON.stringify({
                lots: this.lots,
                orders: this.orders,
                products: this.products,
                paymentLines: this.paymentLines,
                inventory: this.inventory,
                users: this.users,
                history: this.history,
            });
            localStorage.setItem("tow_erp_storage", data);
        } catch (e) {
            console.error("Failed to save to storage", e);
        }
    }

    private consumePaymentWip(lotNumber: string, processName: string, subcontractor: string, qty: number) {
        let remaining = qty;
        while (remaining > 0) {
            const wipIndex = this.paymentLines.findIndex(pl =>
                pl.lotNumber === lotNumber &&
                pl.processName === processName &&
                pl.subcontractor === subcontractor &&
                pl.status === "wip"
            );
            if (wipIndex === -1) break;

            const pl = this.paymentLines[wipIndex];
            if (pl.qty <= remaining) {
                remaining -= pl.qty;
                this.paymentLines.splice(wipIndex, 1);
            } else {
                pl.qty -= remaining;
                pl.amount = pl.qty * (pl.unitPriceOverride || pl.unitPrice);
                remaining = 0;
            }
        }
    }

    subscribe(fn: () => void) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
    private notify() { this.save(); this.listeners.forEach(fn => fn()); }
    private addHistory(action: string, detail: string, lotNumber?: string) {
        this.history.unshift({ id: `h${uid()}`, timestamp: new Date().toISOString(), action, detail, lotNumber });
    }

    private checkLotCompletions(lot: MockLot) {
        let anyChanged = false;
        for (let i = 0; i < lot.processes.length; i++) {
            const p = lot.processes[i];
            if (p.status !== "completed") {
                const prevCompleted = i === 0 || lot.processes[i - 1].status === "completed";
                if (p.currentQty === 0 && prevCompleted) {
                    p.status = "completed";
                    anyChanged = true;
                }
            }
        }
        if (lot.processes.every(p => p.status === "completed") && lot.status !== "completed") {
            lot.status = "completed";
            anyChanged = true;
        }
        return anyChanged;
    }

    // ─── 次工程へ (外注先選択対応) ───
    moveForward(lotId: string, processId: string, qty: number, completionDate: string, nextDeliveryDate: string, nextDueDate: string, opts?: { overridePrice?: number; nextSubcontractor?: string }): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `移動数が現在数(${proc.currentQty})を超えています` };
        if (qty <= 0) return { ok: false, error: "1以上の数量を入力してください" };
        if (!completionDate || !nextDeliveryDate || !nextDueDate) return { ok: false, error: "日付は必須です" };

        if (opts?.overridePrice !== undefined && opts.overridePrice !== null && typeof opts.overridePrice === "number") {
            proc.unitPriceOverride = opts.overridePrice;
        }

        const existingDel = proc.deliveries.find(d => !d.completionDate);
        if (existingDel) existingDel.completionDate = completionDate;

        proc.currentQty -= qty;
        proc.completedQty += qty;

        // 現在の工程の WIP 支払を消費
        this.consumePaymentWip(lot.lotNumber, proc.name, proc.subcontractor, qty);

        const effectivePrice = proc.unitPriceOverride !== null ? proc.unitPriceOverride : proc.unitPrice;
        this.paymentLines.push({
            id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: proc.name, subcontractor: proc.subcontractor,
            qty, unitPrice: proc.unitPrice, unitPriceOverride: proc.unitPriceOverride, amount: qty * effectivePrice,
            completionDate, status: "pre_payment",
        });

        // 次工程 (本人より上の最小の sortOrder) のテンプレート名を取得
        const product = this.products.find(p => p.id === lot.productId);
        const currentGroup = product?.processGroups[proc.groupIndex];
        const nextTpl = currentGroup?.templates
            .filter(t => t.sortOrder > proc.stepOrder)
            .sort((a, b) => a.sortOrder - b.sortOrder)[0];

        if (nextTpl) {
            // 組み付けポイントの場合、ここでパーツ在庫を消費する (先行チェック)
            if (nextTpl.isAssemblyPoint) {
                const partsInv = this.inventory.find(i => i.product === `${lot.product} (パーツ)` && i.type === "parts");
                if (partsInv) {
                    if (partsInv.quantity < qty) return { ok: false, error: `パーツ在庫が不足しています (在庫: ${partsInv.quantity}, 必要: ${qty})` };
                    partsInv.quantity -= qty;
                    this.addHistory("パーツ消費", `${lot.lotNumber}: ${qty}個消費 (在庫残: ${partsInv.quantity})`, lot.lotNumber);
                } else {
                    return { ok: false, error: "組み付け用のパーツ在庫が見つかりません" };
                }
            }

            const nextSubName = opts?.nextSubcontractor || nextTpl.subcontractors[0]?.name || "";
            const nextStep = nextTpl.sortOrder;
            const nextGroup = proc.groupIndex;

            // 同じgroupIndex, stepOrder, かつ 外注先 が同じ既存工程があるか探す
            let next = lot.processes.find(p => p.groupIndex === nextGroup && p.stepOrder === nextStep && p.subcontractor === nextSubName);

            if (!next) {
                // なければ新規作成して適切な位置に挿入
                const nextSubInfo = nextTpl.subcontractors.find(s => s.name === nextSubName);
                const newProc: ProcessEntry = {
                    id: `lp${uid()}`,
                    name: nextTpl.name,
                    subcontractor: nextSubName,
                    currentQty: 0,
                    completedQty: 0,
                    lossQty: 0,
                    lossConfirmed: false,
                    unitPrice: nextSubInfo?.unitPrice || 0,
                    unitPriceOverride: null,
                    status: "pending",
                    deliveries: [],
                    groupIndex: nextGroup,
                    stepOrder: nextStep,
                    isAssemblyPoint: nextTpl.isAssemblyPoint
                };
                // 挿入位置を決める (stepOrder順、同じstepOrderなら末尾へ)
                const lastIdxWithSameStep = [...lot.processes].reverse().findIndex(p => p.groupIndex === nextGroup && p.stepOrder <= nextStep);
                if (lastIdxWithSameStep === -1) {
                    lot.processes.unshift(newProc);
                } else {
                    const insertIdx = lot.processes.length - lastIdxWithSameStep;
                    lot.processes.splice(insertIdx, 0, newProc);
                }
                next = newProc;
            }

            next!.currentQty += qty;
            if (next!.status === "pending") next!.status = "in_progress";
            next!.deliveries.push({ id: `d${uid()}`, qty, deliveryDate: nextDeliveryDate, completionDate: "", dueDate: nextDueDate });

            // 次工程の WIP 支払を作成
            this.paymentLines.push({
                id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: next!.name, subcontractor: next!.subcontractor,
                qty, unitPrice: next!.unitPrice, unitPriceOverride: null, amount: qty * next!.unitPrice,
                completionDate: nextDeliveryDate, status: "wip",
            });
        } else {
            // 最終工程の場合
            if (proc.groupIndex > 0) {
                const existingPart = this.inventory.find(i => i.product === `${lot.product} (パーツ)` && i.type === "parts");
                if (existingPart) existingPart.quantity += qty;
                else this.inventory.push({ id: `inv${uid()}`, product: `${lot.product} (パーツ)`, code: "", quantity: qty, type: "parts", warehouse: "仕掛パーツ置場" });
            }
        }

        if (lot.status === "created") lot.status = "in_progress";
        this.checkLotCompletions(lot);

        this.addHistory("工程完了", `${lot.lotNumber} [${proc.name}] → ${qty}個`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }


    // ─── 差戻し (外注先選択対応) ───
    moveBack(lotId: string, processId: string, qty: number, returnDate: string, prevDueDate: string, prevSubcontractor?: string): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: "差戻し数が現在数を超えています" };
        if (!returnDate || !prevDueDate) return { ok: false, error: "日付は必須です" };

        proc.currentQty -= qty;
        this.consumePaymentWip(lot.lotNumber, proc.name, proc.subcontractor, qty);

        // 前工程を探す (現在の stepOrder より小さい中で最大のものを探す)
        const prevSteps = lot.processes
            .filter(p => p.groupIndex === proc.groupIndex && p.stepOrder < proc.stepOrder)
            .sort((a, b) => b.stepOrder - a.stepOrder);
        let prev = prevSteps[0];

        if (prevSubcontractor) {
            const exactPrev = prevSteps.find(p => p.subcontractor === prevSubcontractor);
            if (exactPrev) prev = exactPrev;
        }

        if (prev) {
            prev.currentQty += qty;
            prev.completedQty -= qty;
            if (prev.status === "completed") prev.status = "in_progress";
            prev.deliveries.push({ id: `d${uid()}`, qty, deliveryDate: returnDate, completionDate: "", dueDate: prevDueDate });

            // 前工程の WIP 支払を (再) 作成
            this.paymentLines.push({
                id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: prev.name, subcontractor: prev.subcontractor,
                qty, unitPrice: prev.unitPrice, unitPriceOverride: null, amount: qty * prev.unitPrice,
                completionDate: returnDate, status: "wip",
            });
        }

        if (lot.status === "completed") lot.status = "in_progress";

        this.addHistory("差戻し", `${lot.lotNumber} [${proc.name}] → ${qty}個を前工程へ`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }

    // ─── ロス確定 ───
    confirmLoss(lotId: string, processId: string): { ok: boolean; lossQty: number; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, lossQty: 0, error: "ロットが見つかりません" };
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, lossQty: 0, error: "工程が見つかりません" };
        const loss = proc.currentQty;
        proc.lossQty += loss;
        proc.currentQty = 0;
        proc.lossConfirmed = true;
        proc.status = "completed";

        this.consumePaymentWip(lot.lotNumber, proc.name, proc.subcontractor, loss);

        this.checkLotCompletions(lot);

        if (lot.status === "completed") {
            this.orders.forEach(o => {
                if (o.items.some(i => i.product === lot.product) && o.status !== "cancelled") o.status = "completed";
            });
        }

        this.addHistory("ロス確定", `${lot.lotNumber} [${proc.name}] → ${loss}個廃棄`, lot.lotNumber);
        this.notify();
        return { ok: true, lossQty: loss };
    }

    // ─── カード編集: 納入実績の数量変更 → 前工程連動 ───
    updateDelivery(lotId: string, processId: string, deliveryId: string, newQty: number, newDeliveryDate?: string, newDueDate?: string) {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return;
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return;
        const del = proc.deliveries.find(d => d.id === deliveryId);
        if (!del) return;

        const diff = newQty - del.qty;
        del.qty = newQty;
        if (newDeliveryDate) del.deliveryDate = newDeliveryDate;
        if (newDueDate) del.dueDate = newDueDate;

        // 数量が変わった場合、現工程のcurrentQtyを調整し、且つ WIP 支払も調整
        if (diff !== 0) {
            proc.currentQty += diff;
            const wip = this.paymentLines.find(pl => pl.lotNumber === lot.lotNumber && pl.processName === proc.name && pl.subcontractor === proc.subcontractor && pl.status === "wip");
            if (wip) {
                wip.qty += diff;
                if (wip.qty <= 0) {
                    this.paymentLines = this.paymentLines.filter(p => p.id !== wip.id);
                } else {
                    wip.amount = wip.qty * (wip.unitPriceOverride || wip.unitPrice);
                }
            }

            const prevSteps = lot.processes
                .filter(p => p.groupIndex === proc.groupIndex && p.stepOrder < proc.stepOrder)
                .sort((a, b) => b.stepOrder - a.stepOrder);
            if (prevSteps.length > 0) {
                const prev = prevSteps[0];
                prev.currentQty -= diff; // 減った分は前工程に戻す
                prev.completedQty += diff;
                if (prev.currentQty < 0) prev.currentQty = 0;
                if (prev.completedQty < 0) prev.completedQty = 0;

                if (prev.currentQty > 0 && prev.status === "completed") {
                    prev.status = "in_progress";
                    if (lot.status === "completed") lot.status = "in_progress";
                }
            }
        }
        this.checkLotCompletions(lot);

        this.addHistory("納入編集", `${lot.lotNumber} [${proc.name}] 数量→${newQty}`, lot.lotNumber);
        this.notify();
    }

    // ─── 仕掛登録 (V7) ───
    registerWip(lotId: string, processId: string, qty: number, deliveryDate: string, dueDate: string, subcontractor: string, overridePrice?: number): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };

        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, error: "工程が見つかりません" };

        // 組み付けポイントの場合、パーツ在庫をチェック・消費 (V7.4追加)
        if (proc.isAssemblyPoint) {
            const partsInv = this.inventory.find(i => i.product === `${lot.product} (パーツ)` && i.type === "parts");
            if (partsInv) {
                if (partsInv.quantity < qty) return { ok: false, error: `パーツ在庫が不足しています (在庫: ${partsInv.quantity}, 必要: ${qty})` };
                partsInv.quantity -= qty;
                this.addHistory("パーツ消費", `${lot.lotNumber}: ${qty}個消費 (在庫残: ${partsInv.quantity})`, lot.lotNumber);
            } else {
                return { ok: false, error: "組み付け用のパーツ在庫が見つかりません" };
            }
        }

        proc.currentQty = qty;
        proc.subcontractor = subcontractor;
        proc.unitPriceOverride = overridePrice !== undefined ? overridePrice : null;
        if (proc.unitPriceOverride === null) {
            // マスタから最新単価を引く
            const product = this.products.find(p => p.id === lot.productId);
            const processGroup = product?.processGroups[proc.groupIndex];
            const processTemplate = processGroup?.templates.find(t => t.name === proc.name && t.sortOrder === proc.stepOrder);
            proc.unitPrice = processTemplate?.subcontractors.find(s => s.name === subcontractor)?.unitPrice || proc.unitPrice;
        }

        proc.status = "in_progress";
        proc.deliveries.push({ id: `d${uid()}`, qty, deliveryDate, completionDate: "", dueDate });

        // WIP 支払を作成
        this.paymentLines.push({
            id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: proc.name, subcontractor: proc.subcontractor,
            qty, unitPrice: proc.unitPrice, unitPriceOverride: proc.unitPriceOverride, amount: qty * (proc.unitPriceOverride || proc.unitPrice),
            completionDate: deliveryDate, status: "wip",
        });

        if (lot.status === "created") lot.status = "in_progress";

        // 受注ステータスを連動 (V7.3)
        if (lot.orderId) {
            const order = this.orders.find(o => o.id === lot.orderId);
            if (order && order.status === "pending") {
                order.status = "in_progress";
            }
        }

        this.addHistory("仕掛登録", `${lot.lotNumber} [${proc.name}] ${qty}個投入`, lot.lotNumber);
        this.notify();
        return { ok: true };
    }

    // ─── 受注 ───
    createOrder(order: Omit<MockOrder, "id" | "createdAt">): MockOrder {
        const o: MockOrder = { ...order, id: `ord${uid()}`, createdAt: new Date().toISOString().split("T")[0] };
        this.orders.unshift(o);

        // 新規注文が入ったらロットも自動生成
        o.items.forEach((item, idx) => {
            const product = this.products.find(p => p.name === item.product);
            if (product && item.qty > 0) {
                const processes: ProcessEntry[] = [];
                product.processGroups.forEach((g, gIdx) => {
                    const firstTpl = g.templates.sort((a, b) => a.sortOrder - b.sortOrder)[0];
                    if (firstTpl) {
                        processes.push({
                            id: `lp${uid()}`, name: firstTpl.name, subcontractor: firstTpl.subcontractors[0]?.name || "",
                            currentQty: 0, completedQty: 0, lossQty: 0, lossConfirmed: false,
                            unitPrice: firstTpl.subcontractors[0]?.unitPrice || 0, unitPriceOverride: null, status: "pending",
                            groupIndex: gIdx, stepOrder: firstTpl.sortOrder, isAssemblyPoint: firstTpl.isAssemblyPoint || false,
                            deliveries: []
                        });
                    }
                });
                if (processes.length > 0) {
                    this.lots.push({
                        id: `lot${uid()}`, lotNumber: `${o.orderNumber.split("-")[0]}-${String(this.lots.length + 1).padStart(3, "0")}`,
                        product: product.name, productId: product.id,
                        totalQty: item.qty, status: "created", orderDate: o.createdAt, orderId: o.id, processes
                    });
                }
            }
        });

        this.addHistory("受注作成", `${o.orderNumber} - ${o.customerName}`);
        this.notify();
        return o;
    }

    deleteOrder(orderId: string) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        const relatedLots = this.lots.filter(l => l.orderId === orderId);
        const relatedLotNumbers = relatedLots.map(l => l.lotNumber);

        // 関連ロットも削除
        this.lots = this.lots.filter(l => l.orderId !== orderId);
        // 関連する未確定支払データも削除
        this.paymentLines = this.paymentLines.filter(pl => !relatedLotNumbers.includes(pl.lotNumber) || pl.status === "paid" || pl.status === "confirmed");

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
        if (pl.status === "wip") pl.status = "pre_payment";
        else if (pl.status === "pre_payment") pl.status = "paid";
        else if (pl.status === "paid") pl.status = "confirmed";
        this.addHistory("支払進行", `${pl.lotNumber} ${pl.processName} → ${pl.status}`);
        this.notify();
    }

    revertPayment(id: string) {
        const pl = this.paymentLines.find(p => p.id === id);
        if (!pl) return;
        if (pl.status === "confirmed") pl.status = "paid";
        else if (pl.status === "paid") pl.status = "pre_payment";
        else if (pl.status === "pre_payment") pl.status = "wip";
        this.addHistory("支払取消", `${pl.lotNumber} ${pl.processName} → ${pl.status}`);
        this.notify();
    }

    updatePaymentLine(id: string, qty: number, overridePrice: number | null) {
        const pl = this.paymentLines.find(p => p.id === id);
        if (!pl) return;
        const diff = qty - pl.qty;
        pl.qty = qty; pl.unitPriceOverride = overridePrice;
        pl.amount = qty * (overridePrice || pl.unitPrice);

        // ロット数量との同期 (wip の場合のみ連動させるのが安全)
        if (pl.status === "wip" && diff !== 0) {
            const lot = this.lots.find(l => l.lotNumber === pl.lotNumber);
            const proc = lot?.processes.find(p => p.name === pl.processName && p.subcontractor === pl.subcontractor && p.status === "in_progress");
            if (proc) {
                proc.currentQty += diff;
                const del = proc.deliveries.find(d => !d.completionDate);
                if (del) del.qty += diff;
            }
        }
        this.notify();
    }

    // ─── 在庫・出荷処理 (V4追加) ───
    adjustInventory(id: string, newQty: number, reason: string) {
        const item = this.inventory.find(i => i.id === id);
        if (item) {
            const oldQty = item.quantity;
            const diff = oldQty - newQty;
            item.quantity = newQty;

            // 「販売・発送」の場合は受注残を減らす (売上計上の代わり)
            if (reason === "販売・発送" && diff > 0) {
                let remaining = diff;
                this.orders.filter(o => o.status !== "completed" && o.status !== "cancelled").forEach(order => {
                    const oi = order.items.find(it => it.product === item.product);
                    if (oi && remaining > 0) {
                        const canShip = Math.min(remaining, Math.max(0, oi.qty - oi.shipped));
                        oi.shipped += canShip;
                        remaining -= canShip;
                        if (order.items.every(xi => xi.shipped >= xi.qty)) order.status = "completed";
                    }
                });
            }

            this.addHistory("在庫修正", `${item.product}: ${oldQty} → ${newQty} (${reason})`);
            this.notify();
        }
    }

    updateWarehouse(id: string, warehouse: string) {
        const item = this.inventory.find(i => i.id === id);
        if (item) { item.warehouse = warehouse; this.addHistory("倉庫変更", `${item.product} → ${warehouse}`); this.notify(); }
    }

    moveToInventory(lotId: string, processId: string, qty: number, warehouse: string, completionDate: string, opts?: { overridePrice?: number }): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `移動数が現在数(${proc.currentQty})を超えています` };
        if (!completionDate) return { ok: false, error: "完了日付は必須です" };

        if (opts?.overridePrice !== undefined && opts.overridePrice !== null && typeof opts.overridePrice === "number") {
            proc.unitPriceOverride = opts.overridePrice;
        }

        const existingDel = proc.deliveries.find(d => !d.completionDate);
        if (existingDel) existingDel.completionDate = completionDate;

        proc.currentQty -= qty;
        proc.completedQty += qty;

        // 現在の工程の WIP 支払を消費
        this.consumePaymentWip(lot.lotNumber, proc.name, proc.subcontractor, qty);

        this.checkLotCompletions(lot);

        const invType = proc.groupIndex > 0 ? "parts" : "product";
        const productName = proc.groupIndex > 0 ? `${lot.product} (パーツ)` : lot.product;

        const existing = this.inventory.find(i => i.product === productName && i.type === invType && i.warehouse === warehouse);
        if (existing) existing.quantity += qty;
        else this.inventory.push({ id: `inv${uid()}`, product: productName, code: "", quantity: qty, type: invType, warehouse });

        const effectivePrice = proc.unitPriceOverride !== null ? proc.unitPriceOverride : proc.unitPrice;
        this.paymentLines.push({
            id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: proc.name, subcontractor: proc.subcontractor,
            qty, unitPrice: proc.unitPrice, unitPriceOverride: proc.unitPriceOverride, amount: qty * effectivePrice,
            completionDate, status: "pre_payment",
        });

        this.addHistory("在庫移動", `${lot.lotNumber} → ${warehouse}へ${qty}個`);
        this.notify();
        return { ok: true };
    }

    shipAndInvoice(lotId: string, processId: string, qty: number, completionDate: string, opts?: { overridePrice?: number }): { ok: boolean; error?: string } {
        const lot = this.lots.find(l => l.id === lotId);
        if (!lot) return { ok: false, error: "ロットが見つかりません" };
        const proc = lot.processes.find(p => p.id === processId);
        if (!proc) return { ok: false, error: "工程が見つかりません" };
        if (qty > proc.currentQty) return { ok: false, error: `出荷数が現在数(${proc.currentQty})を超えています` };
        if (!completionDate) return { ok: false, error: "完了日付は必須です" };

        if (opts?.overridePrice !== undefined && opts.overridePrice !== null && typeof opts.overridePrice === "number") {
            proc.unitPriceOverride = opts.overridePrice;
        }

        const existingDel = proc.deliveries.find(d => !d.completionDate);
        if (existingDel) existingDel.completionDate = completionDate;

        // 現在の工程の WIP 支払を消費
        this.consumePaymentWip(lot.lotNumber, proc.name, proc.subcontractor, qty);

        // 該当商品の未完了受注を探し、出荷数を割り当てる
        let remainingQty = qty;

        // まず、このロットが紐づいていた受注を優先して埋める
        if (lot.orderId) {
            const targetOrder = this.orders.find(o => o.id === lot.orderId && o.status !== "completed" && o.status !== "cancelled");
            if (targetOrder) {
                const item = targetOrder.items.find(i => i.product === lot.product);
                if (item && remainingQty > 0) {
                    const diff = Math.min(remainingQty, Math.max(0, item.qty - item.shipped));
                    item.shipped += diff;
                    remainingQty -= diff;
                    if (targetOrder.items.every(xi => xi.shipped >= xi.qty)) targetOrder.status = "completed";
                }
            }
        }

        // 残りがあれば他の未完了受注に割り当てる
        if (remainingQty > 0) {
            this.orders.filter(o => o.status !== "completed" && o.status !== "cancelled").forEach(order => {
                const item = order.items.find(i => i.product === lot.product);
                if (item && remainingQty > 0) {
                    const diff = Math.min(remainingQty, Math.max(0, item.qty - item.shipped));
                    item.shipped += diff;
                    remainingQty -= diff;
                    if (order.items.every(xi => xi.shipped >= xi.qty)) order.status = "completed";
                }
            });
        }

        proc.currentQty -= qty;
        proc.completedQty += qty;
        this.checkLotCompletions(lot);

        const effectivePrice = proc.unitPriceOverride !== null ? proc.unitPriceOverride : proc.unitPrice;
        this.paymentLines.push({
            id: `pl${uid()}`, lotNumber: lot.lotNumber, processName: proc.name, subcontractor: proc.subcontractor,
            qty, unitPrice: proc.unitPrice, unitPriceOverride: proc.unitPriceOverride, amount: qty * effectivePrice,
            completionDate, status: "pre_payment",
        });

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
            .reduce((s, o) => s + o.items.reduce((ss, i) => ss + Math.max(0, i.qty - i.shipped) * i.unitPrice, 0), 0);
    }

    get nextOrderNumber(): string {
        const now = new Date();
        const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const existing = this.orders.filter(o => o.orderNumber.startsWith(prefix));
        return `${prefix}-${existing.length + 1}`;
    }

    get deadlineAlerts() {
        const todayStr = new Date().toISOString().split("T")[0];
        const alerts: { lot: string; product: string; process: string; qty: number; dueDate: string; isOverdue: boolean }[] = [];
        this.lots.forEach(lot => {
            if (lot.status === "completed") return;
            lot.processes.forEach(p => {
                p.deliveries.forEach(d => {
                    if (d.completionDate) return;
                    alerts.push({ lot: lot.lotNumber, product: lot.product, process: p.name, qty: d.qty, dueDate: d.dueDate, isOverdue: d.dueDate < todayStr });
                });
            });
        });
        return alerts.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
}

export const store = new MockStore();
