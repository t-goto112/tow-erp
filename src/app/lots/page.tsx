"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Clock, CheckCircle2, Loader2, ChevronRight, Layers, Edit2, Check, X } from "lucide-react";
import { store, type MockLot, type ProcessEntry, type Delivery } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

const statusConfig = {
    created: { label: "未着手", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    in_progress: { label: "進行中", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export default function LotsPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
    const [search, setSearch] = useState("");
    const [selectedLot, setSelectedLot] = useState<MockLot | null>(null);

    const refresh = useCallback(() => setLots([...store.lots]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const filtered = lots.filter(l => l.lotNumber.includes(search) || l.product.includes(search));

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="relative max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="ロット番号・製品名で検索..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
            </div>

            <div className="space-y-3">
                {filtered.map(lot => {
                    const st = statusConfig[lot.status];
                    const wipQty = lot.processes.reduce((s, p) => s + p.currentQty, 0);
                    const totalLoss = lot.processes.reduce((s, p) => s + p.lossQty, 0);
                    const currentActive = lot.processes.find(p => p.status === "in_progress");

                    return (
                        <div key={lot.id} onClick={() => setSelectedLot(lot)}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold text-blue-600">{lot.lotNumber}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">{lot.product}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        総数: {lot.totalQty}個 | 仕掛: {wipQty}個 | ロス: {totalLoss}個
                                    </p>
                                </div>
                                <div className="text-right">
                                    {currentActive && <p className="text-xs font-bold text-blue-600">{currentActive.name}</p>}
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition ml-auto mt-1" />
                                </div>
                            </div>

                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                                {lot.processes.map(p => {
                                    const pct = lot.totalQty > 0 ? (p.completedQty / lot.totalQty) * 100 : 0;
                                    return (
                                        <div key={p.id} title={`${p.name}: ${p.completedQty}完了 / ${p.currentQty}仕掛`}
                                            style={{ width: `${Math.max(pct, 2)}%` }}
                                            className={`rounded-full transition-all ${p.status === "completed" ? "bg-emerald-400" : p.status === "in_progress" ? "bg-blue-400" : "bg-slate-200"}`} />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ロット詳細モーダル（カード型編集画面） */}
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />
        </div>
    );
}

function LotDetailModal({ lot, onClose }: { lot: MockLot | null; onClose: () => void }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editDue, setEditDue] = useState("");

    if (!lot) return null;

    const handleSave = (del: Delivery) => {
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

                        {proc.deliveries.length > 0 ? proc.deliveries.map(del => {
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
                        }) : <p className="text-[10px] text-slate-300 italic">納入実績なし</p>}
                    </div>
                ))}
            </div>
        </Modal>
    );
}
