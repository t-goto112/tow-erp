"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    FileText,
    Search,
    Plus,
    CheckCircle2,
    Clock,
    Loader2,
    ShoppingCart,
    Store,
    X,
    Check,
} from "lucide-react";
import { store, type MockOrder } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

const channelConfig = {
    ec: { label: "EC", icon: ShoppingCart, color: "bg-blue-50 text-blue-700" },
    wholesale: { label: "卸", icon: Store, color: "bg-amber-50 text-amber-700" },
    direct: { label: "直販", icon: FileText, color: "bg-emerald-50 text-emerald-700" },
};

const statusConfig = {
    pending: { label: "未処理", color: "bg-slate-100 text-slate-600" },
    in_progress: { label: "制作中", color: "bg-blue-50 text-blue-700" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "キャンセル", color: "bg-red-50 text-red-600" },
};

export default function OrdersPage() {
    const [search, setSearch] = useState("");
    const [orders, setOrders] = useState<MockOrder[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [detailOrder, setDetailOrder] = useState<MockOrder | null>(null);
    const [loading, setLoading] = useState(false);

    // 新規受注フォーム
    const [formOrderNumber, setFormOrderNumber] = useState("");
    const [formCustomer, setFormCustomer] = useState("");
    const [formChannel, setFormChannel] = useState<"ec" | "wholesale" | "direct">("wholesale");
    const [formDueDate, setFormDueDate] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [formItems, setFormItems] = useState([{ product: "", qty: 0, unitPrice: 0 }]);

    const refreshData = useCallback(() => {
        setOrders([...store.orders]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const resetForm = () => {
        setFormOrderNumber(`ORD-${new Date().getFullYear()}-${String(store.orders.length + 1).padStart(3, "0")}`);
        setFormCustomer(""); setFormChannel("wholesale"); setFormDueDate(""); setFormNotes("");
        setFormItems([{ product: "", qty: 0, unitPrice: 0 }]);
    };

    const handleCreateOrder = async () => {
        if (!formCustomer || !formOrderNumber) { showToast("error", "受注番号と顧客名は必須です"); return; }
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        store.createOrder({
            orderNumber: formOrderNumber,
            customerName: formCustomer,
            channel: formChannel,
            dueDate: formDueDate,
            status: "pending",
            notes: formNotes,
            items: formItems.filter(i => i.product && i.qty > 0).map(i => ({ ...i, shipped: 0 })),
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

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="受注番号・顧客名で検索..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                </div>
                <button onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <Plus size={16} /> 新規受注入力
                </button>
            </div>

            {/* 受注カード一覧 */}
            <div className="space-y-3">
                {orders.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                        <p className="text-sm text-slate-400">受注データがありません</p>
                    </div>
                ) : (
                    orders.filter(o => o.orderNumber.includes(search) || o.customerName.includes(search)).map(order => {
                        const ch = channelConfig[order.channel] || channelConfig.direct;
                        const st = statusConfig[order.status] || statusConfig.pending;
                        const ChIcon = ch.icon;
                        const totalAmount = order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
                        return (
                            <div key={order.id} onClick={() => setDetailOrder(order)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
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
                                        <p className="text-lg font-bold">¥{totalAmount.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400">{order.items.length}品目</p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                    {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                            <span className="font-bold">{item.product}</span>
                                            <span className="text-slate-400">×</span>
                                            <span>{item.qty}</span>
                                            {item.shipped > 0 && (
                                                <span className="flex items-center gap-0.5 text-blue-600 font-bold bg-blue-50 px-1 rounded">
                                                    <CheckCircle2 size={8} /> {item.shipped}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
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

                    {/* 品目 */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">品目</label>
                        {formItems.map((item, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                                <select value={item.product} onChange={e => updateItem(i, "product", e.target.value)} className="select-base text-xs">
                                    <option value="">商品を選択</option>
                                    {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                                <input type="number" value={item.qty || ""} onChange={e => updateItem(i, "qty", Number(e.target.value))} placeholder="数量" className="input-base text-xs" />
                                <input type="number" value={item.unitPrice || ""} onChange={e => updateItem(i, "unitPrice", Number(e.target.value))} placeholder="単価" className="input-base text-xs" />
                            </div>
                        ))}
                        <button type="button" onClick={addItemRow} className="text-xs text-blue-600 font-bold hover:underline mt-1">+ 品目を追加</button>
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

            {/* 受注詳細モーダル */}
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
                            <div className="space-y-2">
                                {detailOrder.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div>
                                            <span className="font-bold text-sm text-slate-700">{item.product}</span>
                                            <span className="text-xs text-slate-400 ml-2">× {item.qty}</span>
                                        </div>
                                        <span className="font-bold text-sm">¥{(item.qty * item.unitPrice).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {detailOrder.notes && (
                            <div className="border-t border-slate-100 pt-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">メモ</span>
                                <p className="text-sm text-slate-600">{detailOrder.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
