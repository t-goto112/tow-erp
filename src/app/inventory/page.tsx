"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    Plus,
    Box,
    Layers,
    History,
    Edit2,
    Check,
    Loader2,
} from "lucide-react";
import { store, type MockInventory } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

export default function InventoryPage() {
    const [tab, setTab] = useState<"stock" | "wip">("stock");
    const [search, setSearch] = useState("");
    const [inventory, setInventory] = useState<MockInventory[]>([]);
    const [adjustItem, setAdjustItem] = useState<MockInventory | null>(null);
    const [newQuantity, setNewQuantity] = useState("");
    const [adjReason, setAdjReason] = useState("棚卸による差異修正");
    const [loading, setLoading] = useState(false);

    const refreshData = useCallback(() => {
        setInventory([...store.inventory]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const handleAdjust = async () => {
        if (!adjustItem || !newQuantity) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        store.adjustInventory(adjustItem.id, Number(newQuantity), adjReason);
        showToast("success", `在庫を ${adjustItem.quantity} → ${newQuantity} に修正しました`);
        setLoading(false);
        setAdjustItem(null);
        setNewQuantity("");
    };

    // 仕掛品: lot_processesの現在数を集計
    const wipData = store.lots.flatMap(lot =>
        lot.processes.filter(p => p.currentQty > 0).map(p => ({
            lot: lot.lotNumber,
            product: lot.product,
            process: p.name,
            subcontractor: p.subcontractor,
            qty: p.currentQty,
            status: p.status,
        }))
    );

    const filtered = inventory.filter(i => i.product.includes(search) || i.lot.includes(search));

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                    <button onClick={() => setTab("stock")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "stock" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        <Box size={14} /> 完成品在庫
                    </button>
                    <button onClick={() => setTab("wip")} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "wip" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                        <Layers size={14} /> 仕掛品
                    </button>
                </div>
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="商品名・ロット番号で検索..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                </div>
            </div>

            {tab === "stock" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">商品</th><th className="px-4 py-3 text-left">ロット</th><th className="px-4 py-3 text-left">区分</th><th className="px-4 py-3 text-right">数量</th><th className="px-4 py-3 text-left">倉庫</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-bold text-slate-700">{item.product}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{item.lot}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === "product" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                            {item.type === "product" ? "完成品" : "原材料"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-lg">{item.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{item.warehouse}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => { setAdjustItem(item); setNewQuantity(String(item.quantity)); }}
                                            className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="数量修正">
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === "wip" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">ロット</th><th className="px-4 py-3 text-left">製品</th><th className="px-4 py-3 text-left">工程</th><th className="px-4 py-3 text-left">外注先</th><th className="px-4 py-3 text-right">現在数</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {wipData.filter(w => w.product.includes(search) || w.lot.includes(search)).map((w, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{w.lot}</td>
                                    <td className="px-4 py-3 font-bold text-slate-700">{w.product}</td>
                                    <td className="px-4 py-3 text-slate-600">{w.process}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{w.subcontractor}</td>
                                    <td className="px-4 py-3 text-right font-black text-lg text-blue-600">{w.qty}</td>
                                </tr>
                            ))}
                            {wipData.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">仕掛品はありません</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 在庫修正モーダル */}
            <Modal open={!!adjustItem} onClose={() => setAdjustItem(null)} title="在庫数量を修正" subtitle={adjustItem?.product}>
                {adjustItem && (
                    <div className="space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase">現在の在庫数</span>
                            <span className="text-2xl font-black text-slate-800">{adjustItem.quantity}<span className="text-xs text-slate-400 ml-1">個</span></span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">修正後の数量</label>
                            <input type="number" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="input-base text-xl font-black text-blue-600" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">修正理由</label>
                            <select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="select-base">
                                <option>棚卸による差異修正</option>
                                <option>返品による加減</option>
                                <option>破損・廃棄</option>
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
        </div>
    );
}
