"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, CheckCircle2, Clock, Loader2, ShoppingCart, Store, FileText, Check, X, Filter } from "lucide-react";
import { store, type MockOrder } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

const channelConfig = {
    ec: { label: "EC", icon: ShoppingCart, color: "bg-blue-50 text-blue-700" },
    wholesale: { label: "卸", icon: Store, color: "bg-amber-50 text-amber-700" },
    direct: { label: "直販", icon: FileText, color: "bg-emerald-50 text-emerald-700" },
};

const statusConfig = {
    pending: { label: "仕掛中", color: "bg-slate-100 text-slate-600" },
    in_progress: { label: "仕掛中", color: "bg-blue-50 text-blue-700" },
    completed: { label: "完成済", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "キャンセル", color: "bg-red-50 text-red-600" },
};

type StatusFilter = "wip" | "completed" | "paid";

export default function OrdersPage() {
    const [orders, setOrders] = useState<MockOrder[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [detailOrder, setDetailOrder] = useState<MockOrder | null>(null);
    const [loading, setLoading] = useState(false);

    // フィルタ
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("wip");
    const [productFilter, setProductFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // 新規受注フォーム
    const [formOrderNumber, setFormOrderNumber] = useState("");
    const [formCustomer, setFormCustomer] = useState("");
    const [formChannel, setFormChannel] = useState<"ec" | "wholesale" | "direct">("wholesale");
    const [formDueDate, setFormDueDate] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formItems, setFormItems] = useState([{ product: "", qty: 0, unitPrice: 0 }]);

    const refresh = useCallback(() => setOrders([...store.orders]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const resetForm = () => {
        setFormOrderNumber(store.nextOrderNumber);
        setFormCustomer(""); setFormChannel("wholesale"); setFormDueDate(""); setFormNotes("");
        setFormItems([{ product: "", qty: 0, unitPrice: 0 }]);
    };

    const isEcOrDirect = formChannel === "ec" || formChannel === "direct";

    const handleCreateOrder = async () => {
        if (!formCustomer || !formOrderNumber) { showToast("error", "受注番号と顧客名は必須です"); return; }
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        store.createOrder({
            orderNumber: formOrderNumber, customerName: formCustomer, channel: formChannel, dueDate: formDueDate, status: "pending", notes: formNotes,
            items: formItems.filter(i => i.product && i.qty > 0).map(i => ({
                ...i,
                unitPrice: isEcOrDirect ? 0 : i.unitPrice,
                shipped: 0,
            })),
        });
        showToast("success", `受注「${formOrderNumber}」を登録しました`);
        setLoading(false);
        setIsAddModalOpen(false);
    };

    const addItemRow = () => setFormItems([...formItems, { product: "", qty: 0, unitPrice: 0 }]);
    const updateItem = (index: number, field: string, value: any) => {
        const updated = [...formItems];
        (updated[index] as any)[field] = value;
        setFormItems(updated);
    };

    // フィルタリング
    const filtered = useMemo(() => {
        return orders.filter(o => {
            // ステータス
            if (statusFilter === "wip" && (o.status === "completed" || o.status === "cancelled")) return false;
            if (statusFilter === "completed" && o.status !== "completed") return false;
            // 支払済 = 関連する支払行が全て confirmed
            if (statusFilter === "paid") {
                const hasPaid = store.paymentLines.some(pl => pl.status === "confirmed");
                if (!hasPaid) return false;
            }
            // 製品名
            if (productFilter && !o.items.some(i => i.product.includes(productFilter))) return false;
            // 期間
            if (dateFrom && o.createdAt < dateFrom) return false;
            if (dateTo && o.createdAt > dateTo) return false;
            return true;
        });
    }, [orders, statusFilter, productFilter, dateFrom, dateTo]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* フィルタバー */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-wrap">
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                    {([{ k: "wip" as const, l: "仕掛中" }, { k: "completed" as const, l: "完成済" }, { k: "paid" as const, l: "支払い済" }]).map(f => (
                        <button key={f.k} onClick={() => setStatusFilter(f.k)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${statusFilter === f.k ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                            {f.l}
                        </button>
                    ))}
                </div>

                <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none">
                    <option value="">全製品</option>
                    {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>

                <div className="flex items-center gap-1.5 text-xs">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    <span className="text-slate-400">〜</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                </div>

                <div className="ml-auto">
                    <button onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
                        <Plus size={16} /> 新規受注入力
                    </button>
                </div>
            </div>

            {/* 受注カード */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">該当する受注データはありません</p></div>
                ) : filtered.map(order => {
                    const ch = channelConfig[order.channel];
                    const st = statusConfig[order.status];
                    const ChIcon = ch.icon;
                    const totalAmount = order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                    return (
                        <div key={order.id} onClick={() => setDetailOrder(order)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold text-blue-600">{order.orderNumber}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ch.color} flex items-center gap-1`}><ChIcon size={10} />{ch.label}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    </div>
                                    <p className="text-sm font-medium">{order.customerName}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">納期: {order.dueDate || "未設定"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold">{totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}</p>
                                    <p className="text-[10px] text-slate-400">{order.items.length}品目</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        <span className="font-bold">{item.product}</span><span className="text-slate-400">×</span><span>{item.qty}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 新規受注モーダル */}
            <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="新規受注入力" subtitle="Order Registration" width="max-w-xl">
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">受注番号</label>
                            <input type="text" value={formOrderNumber} onChange={e => setFormOrderNumber(e.target.value)} className="input-base" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">チャンネル</label>
                            <select value={formChannel} onChange={e => setFormChannel(e.target.value as any)} className="select-base">
                                <option value="ec">EC</option><option value="wholesale">卸</option><option value="direct">直販</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">顧客名</label>
                        <input type="text" value={formCustomer} onChange={e => setFormCustomer(e.target.value)} placeholder="東京刃物店" className="input-base" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">納期</label>
                        <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input-base" />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">品目</label>
                        {formItems.map((item, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                                <select value={item.product} onChange={e => updateItem(i, "product", e.target.value)} className="select-base text-xs">
                                    <option value="">商品を選択</option>
                                    {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                                <input type="number" value={item.qty || ""} onChange={e => updateItem(i, "qty", Number(e.target.value))} placeholder="数量" className="input-base text-xs" />
                                {isEcOrDirect ? (
                                    <input type="text" value="—" disabled className="input-base text-xs bg-slate-100 text-slate-400 cursor-not-allowed" />
                                ) : (
                                    <input type="number" value={item.unitPrice || ""} onChange={e => updateItem(i, "unitPrice", Number(e.target.value))} placeholder="単価" className="input-base text-xs" />
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addItemRow} className="text-xs text-blue-600 font-bold hover:underline mt-1">+ 品目を追加</button>
                        {isEcOrDirect && <p className="text-[10px] text-amber-600 mt-1 font-bold">EC・直販の受注残は¥0で計算されます</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">メモ</label>
                        <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className="input-base resize-none" placeholder="補足事項..." />
                    </div>

                    <button onClick={handleCreateOrder} disabled={loading}
                        className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> 受注を登録する</>}
                    </button>
                </div>
            </Modal>

            {/* 詳細モーダル */}
            <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={detailOrder?.orderNumber || ""} subtitle={detailOrder?.customerName}>
                {detailOrder && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ステータス</span><span className={`px-2 py-1 rounded text-xs font-bold ${statusConfig[detailOrder.status]?.color}`}>{statusConfig[detailOrder.status]?.label}</span></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">納期</span><p className="text-sm font-bold">{detailOrder.dueDate || "未設定"}</p></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">チャンネル</span><p className="text-sm font-bold">{channelConfig[detailOrder.channel]?.label}</p></div>
                            <div><span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">登録日</span><p className="text-sm font-bold">{detailOrder.createdAt}</p></div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-3">品目一覧</span>
                            {detailOrder.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                                    <div><span className="font-bold text-sm">{item.product}</span><span className="text-xs text-slate-400 ml-2">× {item.qty}</span></div>
                                    <span className="font-bold text-sm">{item.unitPrice > 0 ? `¥${(item.qty * item.unitPrice).toLocaleString()}` : "—"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
