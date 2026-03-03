"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    Copy,
    Settings2,
    X,
    Loader2,
    Check,
} from "lucide-react";
import { store, type MockProduct, type MockProcessMaster, type MockSubcontractor } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

type Tab = "products" | "processes" | "subcontractors";

export default function MasterPage() {
    const [tab, setTab] = useState<Tab>("products");
    const [search, setSearch] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Form states
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");
    const [formCost, setFormCost] = useState("");
    const [formParallel, setFormParallel] = useState(false);
    const [formCategory, setFormCategory] = useState("自社");
    const [formContact, setFormContact] = useState("");

    const [products, setProducts] = useState<MockProduct[]>([]);
    const [processes, setProcesses] = useState<MockProcessMaster[]>([]);
    const [subcontractors, setSubcontractors] = useState<MockSubcontractor[]>([]);

    const refreshData = useCallback(() => {
        setProducts([...store.products]);
        setProcesses([...store.processMasters]);
        setSubcontractors([...store.subcontractors]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const resetForm = () => {
        setFormName(""); setFormCode(""); setFormCost(""); setFormParallel(false); setFormCategory("自社"); setFormContact("");
    };

    const openAddModal = () => {
        resetForm();
        setEditItem(null);
        setIsAddModalOpen(true);
    };

    const openEditModal = (item: any) => {
        setEditItem(item);
        if (tab === "products") { setFormName(item.name); setFormCode(item.code); setFormCost(String(item.materialCost)); }
        else if (tab === "processes") { setFormName(item.name); setFormParallel(item.isParallel); setFormCategory(item.category); }
        else { setFormName(item.name); setFormContact(item.contactInfo); }
        setIsAddModalOpen(true);
    };

    const handleSave = async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        if (tab === "products") {
            if (!formName || !formCode) { showToast("error", "商品名とコードは必須です"); setLoading(false); return; }
            store.createProduct({ name: formName, code: formCode, materialCost: Number(formCost) || 0 });
            showToast("success", `商品「${formName}」を登録しました`);
        } else if (tab === "processes") {
            if (!formName) { showToast("error", "工程名は必須です"); setLoading(false); return; }
            store.createProcessMaster({ name: formName, isParallel: formParallel, category: formCategory });
            showToast("success", `工程「${formName}」を登録しました`);
        } else {
            if (!formName) { showToast("error", "外注先名は必須です"); setLoading(false); return; }
            store.createSubcontractor({ name: formName, contactInfo: formContact });
            showToast("success", `外注先「${formName}」を登録しました`);
        }
        setLoading(false);
        setIsAddModalOpen(false);
        resetForm();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const tableMap = { products: "products" as const, processes: "processMasters" as const, subcontractors: "subcontractors" as const };
        store.deleteItem(tableMap[tab], deleteId);
        showToast("success", "削除しました");
        setDeleteId(null);
    };

    const handleDuplicate = (p: MockProduct) => {
        store.createProduct({ name: p.name + " (コピー)", code: p.code + "-COPY", materialCost: p.materialCost });
        showToast("success", `「${p.name}」を複製しました`);
    };

    const tabLabels = { products: "商品", processes: "工程", subcontractors: "外注先" };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm w-fit">
                    {(["products", "processes", "subcontractors"] as Tab[]).map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === t ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                            {tabLabels[t]}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="検索..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                    </div>
                    <button onClick={openAddModal}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all shrink-0">
                        <Plus size={18} /> 新規登録
                    </button>
                </div>
            </div>

            {/* Product Table */}
            {tab === "products" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">コード</th><th className="px-4 py-3 text-left">商品名</th><th className="px-4 py-3 text-left">材料費</th><th className="px-4 py-3 text-left">工程数</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {products.filter(p => p.name.includes(search) || p.code.includes(search)).map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{p.code}</td>
                                    <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                                    <td className="px-4 py-3 text-slate-600">¥{p.materialCost.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-500">{p.processCount}工程</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button title="複製" onClick={() => handleDuplicate(p)} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"><Copy size={14} /></button>
                                            <button title="編集" onClick={() => openEditModal(p)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                                            <button title="削除" onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === "processes" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">工程名</th><th className="px-4 py-3 text-left">並列可</th><th className="px-4 py-3 text-left">区分</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {processes.filter(p => p.name.includes(search)).map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                                    <td className="px-4 py-3">{p.isParallel ? <span className="text-emerald-500 text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">並列可</span> : <span className="text-slate-300 text-[10px]">単一</span>}</td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">{p.category}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button title="編集" onClick={() => openEditModal(p)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                                            <button title="削除" onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === "subcontractors" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            <tr><th className="px-4 py-3 text-left">名前</th><th className="px-4 py-3 text-left">連絡先</th><th className="px-4 py-3 text-left">単価設定</th><th className="px-4 py-3"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {subcontractors.filter(s => s.name.includes(search)).map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">{s.contactInfo || "—"}</td>
                                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{s.rateCount}件</span></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button title="編集" onClick={() => openEditModal(s)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                                            <button title="削除" onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 新規登録/編集モーダル */}
            <Modal open={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); resetForm(); }} title={editItem ? `${tabLabels[tab]}を編集` : `${tabLabels[tab]}を新規登録`} subtitle="Master Data Management">
                <div className="space-y-5">
                    {tab === "products" && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">商品コード</label>
                                <input type="text" value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="GYU-210" className="input-base" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">商品名</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="牛刀 210mm" className="input-base" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">材料費 (円)</label>
                                <input type="number" value={formCost} onChange={e => setFormCost(e.target.value)} placeholder="800" className="input-base" />
                            </div>
                        </>
                    )}
                    {tab === "processes" && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">工程名</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="鍛造" className="input-base" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={formParallel} onChange={e => setFormParallel(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                                </label>
                                <span className="text-sm font-bold text-slate-600">並列加工可</span>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">区分</label>
                                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="select-base">
                                    <option>自社</option><option>外注</option>
                                </select>
                            </div>
                        </>
                    )}
                    {tab === "subcontractors" && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">外注先名</label>
                                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="鍛造所 田中" className="input-base" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">連絡先</label>
                                <input type="text" value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="0575-22-XXXX" className="input-base" />
                            </div>
                        </>
                    )}
                    <button onClick={handleSave} disabled={loading}
                        className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> {editItem ? "変更を保存" : "登録する"}</>}
                    </button>
                </div>
            </Modal>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
                title="データを削除しますか？" message="この操作は取り消せません。関連するデータにも影響する可能性があります。" confirmLabel="削除する" danger />
        </div>
    );
}
