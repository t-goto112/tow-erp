"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { store, type MockOrder, type OrderItem } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const channelLabels: Record<string, string> = { ec: "EC", wholesale: "卸売", direct: "直販" };
const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "未着手", color: "bg-slate-100 text-slate-600" },
    in_progress: { label: "仕掛中", color: "bg-blue-50 text-blue-700" },
    completed: { label: "完成済", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "取消", color: "bg-red-50 text-red-500" },
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<MockOrder[]>([]);
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [detailOrder, setDetailOrder] = useState<MockOrder | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // フィルタ
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [periodFrom, setPeriodFrom] = useState("");
    const [periodTo, setPeriodTo] = useState("");
    const [productFilter, setProductFilter] = useState("");

    // 新規受注フォーム
    const [formNumber, setFormNumber] = useState("");
    const [formCustomer, setFormCustomer] = useState("");
    const [formChannel, setFormChannel] = useState<"ec" | "wholesale" | "direct">("wholesale");
    const [formDueDate, setFormDueDate] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formItems, setFormItems] = useState<OrderItem[]>([{ product: "", qty: 0, unitPrice: 0, shipped: 0 }]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(() => setOrders([...store.orders]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const filtered = useMemo(() => {
        let data = orders;
        if (statusFilter !== "all") data = data.filter(o => o.status === statusFilter);
        if (periodFrom) data = data.filter(o => o.createdAt >= periodFrom);
        if (periodTo) data = data.filter(o => o.createdAt <= periodTo);
        if (productFilter) data = data.filter(o => o.items.some(i => i.product.includes(productFilter)));
        return data;
    }, [orders, statusFilter, periodFrom, periodTo, productFilter]);

    const openNew = () => {
        setFormNumber(store.nextOrderNumber);
        setFormCustomer(""); setFormChannel("wholesale"); setFormDueDate(""); setFormNotes("");
        setFormItems([{ product: "", qty: 0, unitPrice: 0, shipped: 0 }]);
        setIsNewOpen(true);
    };

    const isEcOrDirect = formChannel === "ec" || formChannel === "direct";

    const handleCreate = async () => {
        if (!formCustomer || !formDueDate || formItems.some(i => !i.product || i.qty <= 0)) {
            showToast("error", "必須項目を入力してください"); return;
        }
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        const items = formItems.map(i => ({ ...i, unitPrice: isEcOrDirect ? 0 : i.unitPrice }));
        store.createOrder({ orderNumber: formNumber, customerName: formCustomer, channel: formChannel, dueDate: formDueDate, status: "pending", notes: formNotes, items });
        showToast("success", `受注 ${formNumber} を登録しました`);
        setLoading(false); setIsNewOpen(false);
    };

    const handleDelete = () => {
        if (!deleteId) return;
        store.deleteOrder(deleteId);
        showToast("success", "受注を削除し、関連する仕掛・在庫を消去しました");
        setDeleteId(null); setDetailOrder(null);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
                        <option value="all">全ステータス</option>
                        <option value="pending">未着手</option>
                        <option value="in_progress">仕掛中</option>
                        <option value="completed">完成済</option>
                    </select>
                    <div className="flex items-center gap-1 text-xs">
                        <input type="date" value={periodFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                        <span className="text-slate-400">〜</span>
                        <input type="date" value={periodTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    </div>
                    <select value={productFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProductFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
                        <option value="">全製品</option>
                        {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                </div>
                <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
                    <Plus size={16} /> 新規受注
                </button>
            </div>

            <div className="space-y-3">
                {filtered.map(order => {
                    const st = statusLabels[order.status];
                    const total = order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                    return (
                        <div key={order.id} onClick={() => setDetailOrder(order)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-blue-600">{order.orderNumber}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">{channelLabels[order.channel]}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">{order.customerName}</p>
                            <div className="flex gap-3 text-[10px] text-slate-400 font-bold mt-1">
                                <span>納期: {order.dueDate}</span>
                                {total > 0 && <span>合計: ¥{total.toLocaleString()}</span>}
                                <span>{order.items.length}品目</span>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">該当する受注はありません</p></div>}
            </div>

            {/* 詳細モーダル — 削除ボタン追加 */}
            <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={detailOrder?.orderNumber || ""} subtitle={detailOrder?.customerName} width="max-w-lg">
                {detailOrder && (
                    <div className="space-y-4">
                        <div className="flex gap-2 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold ${statusLabels[detailOrder.status].color}`}>{statusLabels[detailOrder.status].label}</span>
                            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500">{channelLabels[detailOrder.channel]}</span>
                            <span className="text-slate-400">納期: {detailOrder.dueDate}</span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">品目</p>
                            {detailOrder.items.map((item, i) => (
                                <div key={i} className="flex justify-between py-1 text-sm">
                                    <span className="text-slate-700">{item.product} × {item.qty}</span>
                                    {item.unitPrice > 0 && <span className="font-bold text-slate-600">¥{(item.qty * item.unitPrice).toLocaleString()}</span>}
                                </div>
                            ))}
                        </div>
                        {detailOrder.notes && <p className="text-xs text-slate-500 bg-amber-50 rounded-xl p-3 border border-amber-200">📝 {detailOrder.notes}</p>}
                        <button onClick={() => setDeleteId(detailOrder.id)} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-200 hover:bg-red-100 transition text-sm">
                            <Trash2 size={14} /> この受注を削除する
                        </button>
                    </div>
                )}
            </Modal>

            {/* 新規受注モーダル */}
            <Modal open={isNewOpen} onClose={() => setIsNewOpen(false)} title="新規受注" subtitle={formNumber} width="max-w-lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">受注番号</label><input type="text" value={formNumber} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormNumber(e.target.value)} className="input-base text-sm" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">チャネル</label><select value={formChannel} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormChannel(e.target.value as "ec" | "wholesale" | "direct")} className="select-base">{Object.entries(channelLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    </div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">得意先名</label><input type="text" value={formCustomer} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormCustomer(e.target.value)} className="input-base" /></div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">納期</label><input type="date" value={formDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDueDate(e.target.value)} className="input-base" /></div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">品目</label>
                        {formItems.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <select value={item.product} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const arr = [...formItems]; arr[i].product = e.target.value; setFormItems(arr); }} className="select-base flex-1 min-w-0 text-sm">
                                    <option value="">選択</option>{store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                                <input type="number" placeholder="数量" value={item.qty || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const arr = [...formItems]; arr[i].qty = Number(e.target.value); setFormItems(arr); }} className="input-base w-24 shrink-0 px-2" />
                                <input type="number" placeholder="単価" value={item.unitPrice || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const arr = [...formItems]; arr[i].unitPrice = Number(e.target.value); setFormItems(arr); }} className="input-base w-16 shrink-0 px-2 text-xs" disabled={isEcOrDirect} />
                            </div>
                        ))}
                        <button type="button" onClick={() => setFormItems(prev => [...prev, { product: "", qty: 0, unitPrice: 0, shipped: 0 }])} className="text-[10px] text-blue-600 font-bold hover:underline">+ 品目を追加</button>
                    </div>
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">備考</label><textarea value={formNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormNotes(e.target.value)} rows={2} className="input-base" /></div>
                    <button onClick={handleCreate} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "登録する"}
                    </button>
                </div>
            </Modal>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
                title="受注を削除しますか？" message="この受注に関連する仕掛品・在庫データもすべて消去されます。この操作は元に戻せません。" confirmLabel="削除する" danger />
        </div>
    );
}
