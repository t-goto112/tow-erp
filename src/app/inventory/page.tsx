"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Package,
    ArrowLeft,
    Search,
    Plus,
    ChevronRight,
    MoveDown,
    MoveUp,
    History,
    Box,
    Layers,
    ArrowRightLeft,
    Menu,
    X,
} from "lucide-react";

export default function InventoryPage() {
    const [tab, setTab] = useState<"stock" | "history">("stock");
    const [filterType, setFilterType] = useState<"all" | "product" | "material">("all");

    const [inventory, setInventory] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mobileMenu, setMobileMenu] = useState(false);

    // Adjustment Modal State
    const [adjustItem, setAdjustItem] = useState<any>(null);
    const [newQuantity, setNewQuantity] = useState<string>("");
    const [adjReason, setAdjReason] = useState<string>("棚卸による差異修正");

    useEffect(() => {
        fetchInventory();
    }, [tab]);

    const fetchInventory = async () => {
        setLoading(true);
        if (tab === "stock") {
            const { data } = await supabase
                .from("inventory")
                .select(`
            *,
            products(name, code),
            warehouses(name),
            lots(lot_number)
          `)
                .order("updated_at", { ascending: false });
            if (data) setInventory(data);
        } else {
            const { data } = await supabase
                .from("inventory_history")
                .select(`
            *,
            inventory(
              product_id,
              products(name)
            )
          `)
                .order("created_at", { ascending: false });
            if (data) setHistory(data);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex items-center justify-end gap-2 mb-4">
                <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ArrowRightLeft size={14} /> 倉庫間移動
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition">
                    <Plus size={16} /> <span className="hidden xs:inline">登録</span><span className="inline xs:hidden">登録</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button onClick={() => setTab("stock")} className={`pb-3 text-sm font-medium transition ${tab === "stock" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                    在庫一覧
                </button>
                <button onClick={() => setTab("history")} className={`pb-3 text-sm font-medium transition ${tab === "history" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
                    入出庫履歴
                </button>
            </div>

            {tab === "stock" ? (
                <>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="品名・コードで検索..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                        </div>
                        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                            <FilterBtn active={filterType === "all"} onClick={() => setFilterType("all")}>すべて</FilterBtn>
                            <FilterBtn active={filterType === "product"} onClick={() => setFilterType("product")}>完成品</FilterBtn>
                            <FilterBtn active={filterType === "material"} onClick={() => setFilterType("material")}>原材料</FilterBtn>
                        </div>
                    </div>

                    {/* Stock Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 text-left">種類</th>
                                    <th className="px-6 py-3 text-left">品名 / コード</th>
                                    <th className="px-6 py-3 text-left">倉庫</th>
                                    <th className="px-6 py-3 text-left whitespace-nowrap">ロット</th>
                                    <th className="px-6 py-3 text-right">在庫数</th>
                                    <th className="px-6 py-3 text-left">単位</th>
                                    <th className="px-6 py-3 text-left"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inventory.filter((i: any) => filterType === "all" || i.item_type === filterType).map((item: any) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4">
                                            {item.item_type === "product" ?
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 flex items-center gap-1 w-fit"><Layers size={10} /> 完成品</span> :
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 flex items-center gap-1 w-fit"><Box size={10} /> 原材料</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-slate-700">{item.products?.name || "不明な商品"}</p>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.products?.code}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{item.warehouses?.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-blue-600">{item.lots?.lot_number || "—"}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-base font-bold text-slate-800">{Number(item.quantity).toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400">{item.unit}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setAdjustItem(item);
                                                        setNewQuantity(item.quantity.toString());
                                                    }}
                                                    className="p-1.5 rounded-md hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition text-[10px] font-bold border border-blue-100"
                                                >
                                                    修正
                                                </button>
                                                <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition"><ChevronRight size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                /* History Table */
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-3 text-left">日時</th>
                                <th className="px-6 py-3 text-left">種別</th>
                                <th className="px-6 py-3 text-left">品名</th>
                                <th className="px-6 py-3 text-right">数量</th>
                                <th className="px-6 py-3 text-left">ロット</th>
                                <th className="px-6 py-3 text-left">理由</th>
                                <th className="px-6 py-3 text-left">担当</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.map((h: any) => (
                                <tr key={h.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(h.created_at).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        {h.change_type === "in" && <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]"><MoveDown size={12} /> 入庫</span>}
                                        {h.change_type === "out" && <span className="flex items-center gap-1 text-red-600 font-bold text-[10px]"><MoveUp size={12} /> 出庫</span>}
                                        {h.change_type === "transfer" && <span className="flex items-center gap-1 text-blue-600 font-bold text-[10px]"><ArrowRightLeft size={12} /> 移動</span>}
                                    </td>
                                    <td className="px-6 py-4 font-medium">{h.inventory?.products?.name}</td>
                                    <td className={`px-6 py-4 text-right font-bold ${h.change_type === 'in' ? 'text-emerald-600' : h.change_type === 'out' ? 'text-red-600' : ''}`}>
                                        {h.change_type === 'out' ? '-' : h.change_type === 'in' ? '+' : ''}{h.quantity}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-blue-600">—</td>
                                    <td className="px-6 py-4 text-xs text-slate-400">{h.reason}</td>
                                    <td className="px-6 py-4 text-xs text-slate-600">システム</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Adjustment Modal */}
            {
                adjustItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-8 w-[440px] shadow-2xl animate-in fade-in zoom-in duration-200">
                            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <ArrowRightLeft className="text-blue-600" size={20} /> 在庫数修正 (棚卸)
                            </h3>
                            <p className="text-sm text-slate-400 mb-6">
                                {adjustItem.products?.name} <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded ml-1">{adjustItem.products?.code}</span>
                            </p>

                            <div className="space-y-5">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">現在のシステム在庫</label>
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-lg font-mono text-slate-400">
                                            {adjustItem.quantity} <span className="text-xs">{adjustItem.unit}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 text-blue-600">
                                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">実在庫 (手元にある数)</label>
                                        <input
                                            type="number"
                                            autoFocus
                                            value={newQuantity}
                                            onChange={e => setNewQuantity(e.target.value)}
                                            className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-lg font-mono text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">修正理由</label>
                                    <input
                                        type="text"
                                        value={adjReason}
                                        onChange={e => setAdjReason(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button onClick={() => setAdjustItem(null)} className="flex-1 py-3 rounded-xl border border-slate-100 text-sm font-bold text-slate-400 hover:bg-slate-50 transition">キャンセル</button>
                                <button
                                    onClick={async () => {
                                        setLoading(true);
                                        const { error } = await supabase.from("inventory").update({ quantity: Number(newQuantity) }).eq("id", adjustItem.id);
                                        if (error) alert(error.message);
                                        else {
                                            // Record in history
                                            await supabase.from("inventory_history").insert([{
                                                inventory_id: adjustItem.id,
                                                change_type: "adjustment",
                                                quantity: Number(newQuantity) - Number(adjustItem.quantity),
                                                reason: adjReason
                                            }]);
                                            setAdjustItem(null);
                                            fetchInventory();
                                        }
                                        setLoading(false);
                                    }}
                                    className="flex-[2] py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98] transition-all"
                                >
                                    在庫数を更新する
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

function FilterBtn({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`px-3 py-1 rounded text-xs font-medium transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {children}
        </button>
    )
}
