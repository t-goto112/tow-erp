"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    ChevronRight,
    ArrowLeft,
    Copy,
    Settings2,
    X,
} from "lucide-react";

type Tab = "products" | "processes" | "subcontractors";

export default function MasterPage() {
    const [tab, setTab] = useState<Tab>("products");
    const [search, setSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({ name: "", code: "", material_cost: 0 });

    // DB Data States
    const [products, setProducts] = useState<any[]>([]);
    const [processes, setProcesses] = useState<any[]>([]);
    const [subcontractors, setSubcontractors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [pRes, procRes, subRes] = await Promise.all([
            supabase.from("products").select("*").order("created_at"),
            supabase.from("processes").select("*").order("display_order"),
            supabase.from("subcontractors").select("*").order("name"),
        ]);

        if (pRes.data) setProducts(pRes.data);
        if (procRes.data) setProcesses(procRes.data);
        if (subRes.data) setSubcontractors(subRes.data);
        setLoading(false);
    };

    const handleDelete = async (table: string, id: string) => {
        if (!confirm("本当に削除しますか？")) return;
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) alert("削除に失敗しました: " + error.message);
        else fetchData();
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                {/* Tabs */}
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                    <TabBtn active={tab === "products"} onClick={() => setTab("products")}>商品</TabBtn>
                    <TabBtn active={tab === "processes"} onClick={() => setTab("processes")}>工程</TabBtn>
                    <TabBtn active={tab === "subcontractors"} onClick={() => setTab("subcontractors")}>外注先</TabBtn>
                </div>

                {/* Search + Add */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm hidden xs:block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="検索..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 flex-shrink-0 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        <Plus size={18} /> 新規登録
                    </button>
                </div>
            </div>

            {/* Table */}
            {tab === "products" && (
                <DataTable
                    headers={["コード", "商品名", "材料費", "工程数", ""]}
                    rows={products.filter((p) => (p.name?.includes(search) || p.code?.includes(search))).map((p) => [
                        <span key="c" className="font-mono text-xs font-bold text-blue-600">{p.code}</span>,
                        <span key="n" className="font-medium text-slate-700">{p.name}</span>,
                        <span key="m" className="text-slate-600">¥{(p.material_cost || 0).toLocaleString()}</span>,
                        <span key="p" className="text-slate-500">{p.process_count || 0}工程</span>,
                        <div key="a" className="flex items-center gap-1 justify-end">
                            <button title="複製" className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition">
                                <Copy size={14} />
                            </button>
                            <button title="詳細設定" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition" onClick={() => setSelectedProduct(p)}>
                                <Settings2 size={14} />
                            </button>
                            <button title="編集" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition">
                                <Edit2 size={14} />
                            </button>
                            <button title="削除" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" onClick={() => handleDelete("products", p.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>,
                    ])}
                />
            )}

            {tab === "processes" && (
                <DataTable
                    headers={["工程名", "並列可", "区分", ""]}
                    rows={processes.filter((p) => p.name.includes(search)).map((p) => [
                        <span key="n" className="font-medium text-slate-700">{p.name}</span>,
                        <span key="is">
                            {p.is_parallel ? <span className="text-emerald-500 text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">並列可</span> : <span className="text-slate-300 text-[10px]">単一</span>}
                        </span>,
                        <span key="t" className="text-slate-400 text-xs">{p.category || "自社"}</span>,
                        <div key="a" className="flex items-center gap-1 justify-end">
                            <button title="編集" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                            <button title="削除" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" onClick={() => handleDelete("processes", p.id)}><Trash2 size={14} /></button>
                        </div>,
                    ])}
                />
            )}

            {tab === "subcontractors" && (
                <DataTable
                    headers={["名前", "連絡先", "単価設定", ""]}
                    rows={subcontractors.filter((s) => s.name.includes(search)).map((s) => [
                        <span key="n" className="font-medium text-slate-700">{s.name}</span>,
                        <span key="c" className="text-slate-400 text-xs">{s.contact_info || "—"}</span>,
                        <span key="r" className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{s.rate_count || 0}件</span>,
                        <div key="a" className="flex items-center gap-1 justify-end">
                            <button title="編集" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                            <button title="削除" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" onClick={() => handleDelete("subcontractors", s.id)}><Trash2 size={14} /></button>
                        </div>,
                    ])}
                />
            )}
        </div>
    );
}

/* ─── sub-components ─── */
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
        >
            {children}
        </button>
    );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                    {rows.map((cells, ri) => (
                        <tr key={ri} className="hover:bg-slate-50/50 transition">
                            {cells.map((cell, ci) => (
                                <td key={ci} className="px-4 py-3">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
