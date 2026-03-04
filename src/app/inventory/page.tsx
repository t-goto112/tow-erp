"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Box, Layers, Edit2, Check, Loader2, ChevronRight, X } from "lucide-react";
import { store, type MockInventory, type MockLot } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

export default function InventoryPage() {
    const [tab, setTab] = useState<"stock" | "wip">("stock");
    const [inventory, setInventory] = useState<MockInventory[]>([]);
    const [lots, setLots] = useState<MockLot[]>([]);
    const [adjustItem, setAdjustItem] = useState<MockInventory | null>(null);
    const [newQuantity, setNewQuantity] = useState("");
    const [adjReason, setAdjReason] = useState("棚卸による差異修正");
    const [loading, setLoading] = useState(false);
    const [selectedLot, setSelectedLot] = useState<MockLot | null>(null);

    // フィルタ
    const [productFilter, setProductFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const refresh = useCallback(() => {
        setInventory([...store.inventory]);
        setLots([...store.lots]);
    }, []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const handleAdjust = async () => {
        if (!adjustItem || !newQuantity) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        store.adjustInventory(adjustItem.id, Number(newQuantity), adjReason);
        showToast("success", `在庫を ${adjustItem.quantity} → ${newQuantity} に修正しました`);
        setLoading(false); setAdjustItem(null); setNewQuantity("");
    };

    // 完成品在庫（ロット記載なし、同じ製品を集約）
    const stockItems = useMemo(() => {
        const grouped: Record<string, MockInventory> = {};
        inventory.filter(i => i.type === "product").forEach(i => {
            if (grouped[i.product]) grouped[i.product].quantity += i.quantity;
            else grouped[i.product] = { ...i };
        });
        let result = Object.values(grouped);
        if (productFilter) result = result.filter(i => i.product.includes(productFilter));
        return result;
    }, [inventory, productFilter]);

    // 仕掛品をロットでグループ
    const wipByLot = useMemo(() => {
        let data = lots.filter(l => l.status !== "completed");
        if (productFilter) data = data.filter(l => l.product.includes(productFilter));
        if (dateFrom) data = data.filter(l => l.orderDate >= dateFrom);
        if (dateTo) data = data.filter(l => l.orderDate <= dateTo);
        return data;
    }, [lots, productFilter, dateFrom, dateTo]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                    <button onClick={() => setTab("stock")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${tab === "stock" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        <Box size={14} /> 完成品在庫
                    </button>
                    <button onClick={() => setTab("wip")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${tab === "wip" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        <Layers size={14} /> 仕掛品
                    </button>
                </div>

                {/* フィルタ */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
                        <option value="">全製品</option>
                        {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    {tab === "wip" && (
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400">発注日:</span>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                            <span className="text-slate-400">〜</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                        </div>
                    )}
                </div>
            </div>

            {/* 完成品在庫 */}
            {tab === "stock" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">商品</th><th className="px-4 py-3 text-left">区分</th><th className="px-4 py-3 text-right">数量</th><th className="px-4 py-3 text-left">倉庫</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {stockItems.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-bold text-slate-700">{item.product}</td>
                                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">完成品</span></td>
                                    <td className="px-4 py-3 text-right font-black text-lg">{item.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{item.warehouse}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => { setAdjustItem(item); setNewQuantity(String(item.quantity)); }} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="数量修正"><Edit2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                            {stockItems.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">完成品在庫はありません</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 仕掛品（ロットグループ） */}
            {tab === "wip" && (
                <div className="space-y-3">
                    {wipByLot.map(lot => {
                        const wipQty = lot.processes.reduce((s, p) => s + p.currentQty, 0);
                        const currentProc = lot.processes.find(p => p.status === "in_progress");
                        return (
                            <div key={lot.id} onClick={() => setSelectedLot(lot)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-blue-600">{lot.lotNumber}</span>
                                            <span className="text-xs text-slate-500">{lot.product}</span>
                                        </div>
                                        <div className="flex gap-3 text-[10px] text-slate-400 font-bold">
                                            <span>総数: {lot.totalQty}</span>
                                            <span>仕掛: {wipQty}</span>
                                            {currentProc && <span className="text-blue-600">{currentProc.name} 作業中</span>}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                                </div>
                                {/* 工程バー */}
                                <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-100 mt-3">
                                    {lot.processes.map(p => {
                                        const pct = lot.totalQty > 0 ? (p.completedQty / lot.totalQty) * 100 : 0;
                                        return <div key={p.id} style={{ width: `${Math.max(pct, 2)}%` }} className={`rounded-full ${p.status === "completed" ? "bg-emerald-400" : p.status === "in_progress" ? "bg-blue-400" : "bg-slate-200"}`} />;
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {wipByLot.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">仕掛品はありません</p></div>}
                </div>
            )}

            {/* 在庫修正モーダル */}
            <Modal open={!!adjustItem} onClose={() => setAdjustItem(null)} title="在庫数量を修正" subtitle={adjustItem?.product}>
                {adjustItem && (
                    <div className="space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase">現在数</span>
                            <span className="text-2xl font-black text-slate-800">{adjustItem.quantity}<span className="text-xs text-slate-400 ml-1">個</span></span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">修正後</label>
                            <input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="input-base text-xl font-black text-blue-600" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">理由</label>
                            <select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="select-base">
                                <option>棚卸による差異修正</option>
                                <option>返品による加減</option>
                                <option>破損・廃棄</option>
                                <option>販売・発送</option>
                                <option>入力ミスの訂正</option>
                                <option>その他</option>
                            </select>
                        </div>
                        <button onClick={handleAdjust} disabled={loading || !newQuantity}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> 在庫を修正する</>}
                        </button>
                    </div>
                )}
            </Modal>

            {/* ロット詳細（ダッシュボードと同じカード） */}
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />
        </div>
    );
}

// ─── ロット詳細カード（編集可能 — ダッシュボードと共通） ───
function LotDetailModal({ lot, onClose }: { lot: MockLot | null; onClose: () => void }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editDue, setEditDue] = useState("");

    if (!lot) return null;

    const handleSave = (del: any) => {
        if (editQty) del.qty = Number(editQty);
        if (editDue) del.dueDate = editDue;
        showToast("success", "更新しました");
        setEditingId(null);
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={`${lot.lotNumber} — ${lot.product}`} subtitle={`総数量: ${lot.totalQty}個`} width="max-w-2xl">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {lot.processes.map(proc => (
                    <div key={proc.id} className={`rounded-2xl border p-4 ${proc.status === "in_progress" ? "border-blue-200 bg-blue-50/30" : "border-slate-100"}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${proc.status === "completed" ? "bg-emerald-500" : proc.status === "in_progress" ? "bg-blue-500" : "bg-slate-300"}`} />
                                <span className="font-bold text-sm">{proc.name}</span>
                                <span className="text-[10px] text-slate-400">({proc.subcontractor})</span>
                            </div>
                            <div className="flex gap-2 text-[10px] font-bold">
                                <span className="text-slate-500">現在:{proc.currentQty}</span>
                                <span className="text-emerald-600">完了:{proc.completedQty}</span>
                                {proc.lossQty > 0 && <span className="text-red-500">ロス:{proc.lossQty}</span>}
                            </div>
                        </div>
                        {proc.deliveries.map(del => {
                            const isEditing = editingId === del.id;
                            return (
                                <div key={del.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-slate-100 text-xs mb-1.5">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs font-bold" />
                                            <span>個</span>
                                            <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} className="px-1.5 py-1 border border-slate-200 rounded text-xs" />
                                            <button onClick={() => handleSave(del)} className="p-1 bg-blue-600 text-white rounded"><Check size={12} /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 bg-slate-200 rounded"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold">{del.qty}個</span>
                                                <span className="text-slate-400">納入:{del.deliveryDate}</span>
                                                <span className="text-slate-400">予定:{del.dueDate}</span>
                                                {del.completionDate && <span className="text-emerald-600 font-bold">完了:{del.completionDate}</span>}
                                            </div>
                                            {!del.completionDate && (
                                                <button onClick={() => { setEditingId(del.id); setEditQty(String(del.qty)); setEditDue(del.dueDate); }}
                                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Edit2 size={12} /></button>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {proc.deliveries.length === 0 && <p className="text-[10px] text-slate-300 italic">納入実績なし</p>}
                    </div>
                ))}
            </div>
        </Modal>
    );
}
