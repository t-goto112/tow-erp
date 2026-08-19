"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Loader2, Trash2, Edit2, Check, X } from "lucide-react";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSupabaseData, SupabaseOrder } from "@/lib/useSupabaseData";
import { createSupabaseOrder, deleteSupabaseOrder, updateOrderItem } from "@/lib/services/orderService";

const channelLabels: Record<string, string> = { ec: "EC", wholesale: "卸売", direct: "直販" };
const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "未着手", color: "bg-slate-100 text-slate-600" },
    in_progress: { label: "仕掛中", color: "bg-blue-50 text-blue-700" },
    completed: { label: "完成済", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "取消", color: "bg-red-50 text-red-500" },
};

export default function OrdersPage() {
    const { orders, products, productGroups, loading: dataLoading, profile, refresh } = useSupabaseData();
    const router = useRouter();
    const canEdit = profile?.role === 'admin' || (profile?.permissions?.orders?.edit === true);

    // 閲覧権限がない場合はアクセスブロック
    useEffect(() => {
        if (!dataLoading && profile && profile.role !== 'admin' && profile.permissions?.orders?.view === false) {
            router.replace("/");
        }
    }, [dataLoading, profile, router]);

    if (!dataLoading && profile && profile.role !== 'admin' && profile.permissions?.orders?.view === false) {
        return null;
    }

    const [isNewOpen, setIsNewOpen] = useState(false);
    const [detailOrder, setDetailOrder] = useState<SupabaseOrder | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editItemId, setEditItemId] = useState<string | null>(null);
    const [editItemQty, setEditItemQty] = useState("");
    const [editItemPrice, setEditItemPrice] = useState("");
    const [saving, setSaving] = useState(false);

    // detailOrderをordersデータと同期（編集後のリアルタイム反映）
    useEffect(() => {
        if (detailOrder) {
            const updated = orders.find(o => o.id === detailOrder.id);
            if (updated) {
                setDetailOrder(updated);
            }
        }
    }, [orders]);

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
    const [formItems, setFormItems] = useState([{ product: "", quantity: 0, unitPrice: 0, shipped_quantity: 0 }]);
    const [loading, setLoading] = useState(false);

    const filtered = useMemo(() => {
        let data: SupabaseOrder[] = orders;
        if (statusFilter !== "all") data = data.filter((o: SupabaseOrder) => o.status === statusFilter);
        if (periodFrom) data = data.filter((o: SupabaseOrder) => o.created_at >= periodFrom);
        if (periodTo) data = data.filter((o: SupabaseOrder) => o.created_at <= periodTo);
        if (productFilter) data = data.filter((o: SupabaseOrder) => o.order_items.some((i: any) => i.products?.name?.includes(productFilter)));
        return data;
    }, [orders, statusFilter, periodFrom, periodTo, productFilter]);

    const openNew = () => {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Find existing orders for this month to determine the next serial number
        const monthOrders = orders.filter(o => o.order_number.startsWith(yearMonth));
        const maxNum = monthOrders.reduce((max, o) => {
            const parts = o.order_number.split('-');
            if (parts.length > 1) {
                const num = parseInt(parts[1], 10);
                return !isNaN(num) ? Math.max(max, num) : max;
            }
            return max;
        }, 0);
        
        const nextNum = maxNum + 1;
        setFormNumber(`${yearMonth}-${nextNum}`);
        setFormCustomer(""); setFormChannel("wholesale"); setFormDueDate(""); setFormNotes("");
        setFormItems([{ product: "", quantity: 0, unitPrice: 0, shipped_quantity: 0 }]);
        setIsNewOpen(true);
    };

    const isEcOrDirect = formChannel === "ec" || formChannel === "direct";

    const handleCreate = async () => {
        if (!formCustomer || !formDueDate || formItems.some(i => !i.product || i.quantity <= 0)) {
            showToast("error", "必須項目を入力してください"); return;
        }
        try {
            setLoading(true);
            console.log("OrdersPage: Creating order", formNumber);
            const items = formItems.map(i => ({ ...i, unitPrice: isEcOrDirect ? 0 : i.unitPrice }));
            const resultId = await createSupabaseOrder({
                orderNumber: formNumber,
                customerName: formCustomer,
                channel: formChannel,
                dueDate: formDueDate,
                status: "pending",
                notes: formNotes,
                items
            });

            console.log("OrdersPage: Order created successfully", resultId);
            showToast("success", `受注 ${formNumber} を登録しました`);
            setIsNewOpen(false);

            // 重要: refresh() が完了するのを待つ必要はないが、確実に呼ぶ
            refresh();
        } catch (err: any) {
            console.error("OrdersPage: handleCreate error", err);
            showToast("error", "受注の登録に失敗しました: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteSupabaseOrder(deleteId);
            showToast("success", "受注を削除し、関連する仕掛・在庫データを消去しました");
            setDeleteId(null);
            setDetailOrder(null);
            refresh();
        } catch (err) {
            console.error(err);
            showToast("error", "受注の削除に失敗しました");
        }
    };

    const handleSaveItem = async (item: any) => {
        if (!detailOrder) return;
        const newQty = Number(editItemQty);
        const newPrice = Number(editItemPrice);
        if (newQty <= 0) { showToast("error", "数量は1以上を入力してください"); return; }
        setSaving(true);
        try {
            await updateOrderItem(item.id, detailOrder.id, newQty, newPrice);
            showToast("success", "受注内容を更新しました");
            setEditItemId(null);
            refresh();
        } catch (err: any) {
            console.error(err);
            showToast("error", "更新に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    if (dataLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

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
                        {productGroups.map(g => {
                            const groupProds = products.filter(p => p.group_id === g.id);
                            if (groupProds.length === 0) return null;
                            return (
                                <optgroup key={g.id} label={g.name}>
                                    {groupProds.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </optgroup>
                            );
                        })}
                        {(() => {
                            const unclassified = products.filter(p => !p.group_id);
                            if (unclassified.length === 0) return null;
                            return (
                                <optgroup label="未分類">
                                    {unclassified.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </optgroup>
                            );
                        })()}
                    </select>
                </div>
                {canEdit && (
                    <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
                        <Plus size={16} /> 新規受注
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {filtered.map(order => {
                    const st = statusLabels[order.status] || statusLabels.pending;
                    const total = order.order_items?.reduce((s, i) => s + i.quantity * i.unit_price, 0) || 0;
                    const firstItem = order.order_items?.[0];
                    const itemName = firstItem?.products?.name || "";
                    const orderQty = firstItem?.quantity || 0;
                    const shippedQty = firstItem?.shipped_quantity || 0;
                    const remainQty = Math.max(0, orderQty - shippedQty);
                    return (
                        <div key={order.id} onClick={() => setDetailOrder(order)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-blue-600">{order.order_number}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">{channelLabels[order.channel]}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">{order.customer_name}</p>
                            <div className="flex gap-3 text-[10px] text-slate-400 font-bold mt-1">
                                <span>納期: {order.due_date}</span>
                                {total > 0 && <span>合計: ¥{total.toLocaleString()}</span>}
                            </div>
                            {itemName && (
                                <div className="flex gap-3 text-[10px] font-bold mt-1.5">
                                    <span className="text-slate-500">{itemName}</span>
                                    <span className="text-slate-400">受注数: {orderQty.toLocaleString()}</span>
                                    <span className={remainQty > 0 ? "text-amber-600" : "text-emerald-600"}>残り: {remainQty.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
                {filtered.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">該当する受注はありません</p></div>}
            </div>

            {/* 詳細モーダル */}
            <Modal open={!!detailOrder} onClose={() => { setDetailOrder(null); setEditItemId(null); }} title={detailOrder?.order_number || ""} subtitle={detailOrder?.customer_name} width="max-w-2xl">
                {detailOrder && (
                    <div className="space-y-4">
                        <div className="flex gap-2 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold ${statusLabels[detailOrder.status]?.color || statusLabels.pending.color}`}>{statusLabels[detailOrder.status]?.label || "未着手"}</span>
                            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500">{channelLabels[detailOrder.channel]}</span>
                            <span className="text-slate-400">納期: {detailOrder.due_date}</span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">品目</p>
                                <p className="text-xs font-black text-slate-600">合計: ¥{(detailOrder.order_items?.reduce((s, i) => s + i.quantity * i.unit_price, 0) || 0).toLocaleString()}</p>
                            </div>
                            {detailOrder.order_items?.map((item, i) => {
                                const isEditingItem = editItemId === item.id;
                                const remainQty = Math.max(0, item.quantity - (item.shipped_quantity || 0));
                                return (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-200/60 last:border-0 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-slate-700 font-medium">{item.products?.name}</span>
                                            {!isEditingItem && (
                                                <div className="flex gap-3 text-[10px] mt-0.5">
                                                    <span className="text-slate-400">数量: {item.quantity}</span>
                                                    {item.unit_price > 0 && <span className="text-slate-400">単価: ¥{item.unit_price.toLocaleString()}</span>}
                                                    <span className={remainQty > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>残り: {remainQty}</span>
                                                </div>
                                            )}
                                        </div>
                                        {isEditingItem ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[9px] text-slate-400 w-6">数量</span>
                                                        <input type="number" value={editItemQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditItemQty(e.target.value)} className="w-20 px-1.5 py-1 border border-slate-200 rounded text-xs text-right" />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[9px] text-slate-400 w-6">単価</span>
                                                        <input type="number" value={editItemPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditItemPrice(e.target.value)} className="w-20 px-1.5 py-1 border border-slate-200 rounded text-xs text-right" />
                                                    </div>
                                                </div>
                                                <button onClick={() => handleSaveItem(item)} disabled={saving} className="p-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition disabled:opacity-50"><Check size={12} /></button>
                                                <button onClick={() => setEditItemId(null)} className="p-1.5 bg-slate-200 rounded text-xs hover:bg-slate-300 transition"><X size={12} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                {item.unit_price > 0 && <span className="font-bold text-sm text-slate-600">¥{(item.quantity * item.unit_price).toLocaleString()}</span>}
                                                {canEdit && (
                                                    <button onClick={() => { setEditItemId(item.id); setEditItemQty(String(item.quantity)); setEditItemPrice(String(item.unit_price)); }} title="編集" className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition">
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {detailOrder.notes && <p className="text-xs text-slate-500 bg-amber-50 rounded-xl p-3 border border-amber-200">📝 {detailOrder.notes}</p>}
                        {canEdit && (
                            <button onClick={() => setDeleteId(detailOrder.id)} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-200 hover:bg-red-100 transition text-sm">
                                <Trash2 size={14} /> この受注を削除する
                            </button>
                        )}
                    </div>
                )}
            </Modal>

            {/* 新規受注モーダル */}
            <Modal open={isNewOpen} onClose={() => setIsNewOpen(false)} title="新規受注" subtitle={formNumber} width="max-w-3xl">
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
                            <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                                <select value={item.product} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const arr = [...formItems]; arr[i].product = e.target.value; setFormItems(arr); }} className="select-base flex-1 w-full text-sm">
                                    <option value="">選択</option>
                                    {productGroups.map(g => {
                                        const groupProds = products.filter(p => p.group_id === g.id);
                                        if (groupProds.length === 0) return null;
                                        return (
                                            <optgroup key={g.id} label={g.name}>
                                                {groupProds.map(p => (
                                                    <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}
                                    {(() => {
                                        const unclassified = products.filter(p => !p.group_id);
                                        if (unclassified.length === 0) return null;
                                        return (
                                            <optgroup label="未分類">
                                                {unclassified.map(p => (
                                                    <option key={p.id} value={p.name}>{p.name}</option>
                                                ))}
                                            </optgroup>
                                        );
                                    })()}
                                </select>
                                <input type="number" placeholder="数量" value={item.quantity || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const arr = [...formItems]; arr[i].quantity = Number(e.target.value); setFormItems(arr); }} className="input-base w-full sm:w-24 shrink-0 px-2" />
                                <input type="number" placeholder="単価" value={item.unitPrice || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const arr = [...formItems]; arr[i].unitPrice = Number(e.target.value); setFormItems(arr); }} className="input-base w-full sm:w-16 shrink-0 px-2 text-xs" disabled={isEcOrDirect} />
                            </div>
                        ))}

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
