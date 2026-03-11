"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight, Check, X, Edit2 } from "lucide-react";
import { store, type MockLot, type Delivery } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    created: { label: "未着手", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    in_progress: { label: "進行中", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export default function LotsPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
    const [selectedLot, setSelectedLot] = useState<MockLot | null>(null);

    const refresh = useCallback(() => setLots([...store.lots]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-3">
                {lots.map(lot => {
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
                                    <p className="text-[10px] text-slate-400 mt-0.5">総数: {lot.totalQty}個 | 仕掛: {wipQty}個 | ロス: {totalLoss}個</p>
                                </div>
                                <div className="text-right">
                                    {currentActive && <p className="text-xs font-bold text-blue-600">{currentActive.name}</p>}
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition ml-auto mt-1" />
                                </div>
                            </div>
                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                                {lot.processes.map(p => {
                                    const pct = lot.totalQty > 0 ? (p.completedQty / lot.totalQty) * 100 : 0;
                                    return <div key={p.id} title={`${p.name}: ${p.completedQty}完了 / ${p.currentQty}仕掛`} style={{ width: `${Math.max(pct, 2)}%` }}
                                        className={`rounded-full transition-all ${p.status === "completed" ? "bg-emerald-400" : p.status === "in_progress" ? "bg-blue-400" : "bg-slate-200"}`} />;
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />

            {/* 新規ロット登録モーダル */}
            <Modal open={isNewOpen} onClose={() => { setIsNewOpen(false); resetForm(); }} title="新規ロット登録" subtitle="受注品目から製造ロットを作成します" width="max-w-2xl">
                <div className="space-y-4">
                    {/* Content for new lot registration modal */}
                    <p className="text-sm text-slate-500">This is a placeholder for the new lot registration form.</p>
                </div>
            </Modal>
        </div>
    );
}

function LotDetailModal({ lot, onClose }: { lot: MockLot | null; onClose: () => void }) {
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editDeliveryDate, setEditDeliveryDate] = useState("");
    const [editDue, setEditDue] = useState("");
    const [, setTick] = useState(0);

    if (!lot) return null;

    const handleSave = (processId: string, deliveryId: string) => {
        store.updateDelivery(lot.id, processId, deliveryId, Number(editQty), editDeliveryDate || undefined, editDue || undefined);
        showToast("success", "更新しました");
        setEditId(null);
        setTick((t: number) => t + 1);
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={`${lot.lotNumber} — ${lot.product}`} subtitle={`総数量: ${lot.totalQty}個`} width="max-w-2xl">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {lot.processes.map((proc, pi) => (
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
                            const isEd = editId === del.id;
                            return (
                                <div key={del.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-slate-100 text-xs mb-1.5">
                                    {isEd ? (
                                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                                            <label className="text-[9px] text-slate-400">数量</label>
                                            <input type="number" value={editQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditQty(e.target.value)} className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs font-bold" />
                                            <label className="text-[9px] text-slate-400">納入日</label>
                                            <input type="date" value={editDeliveryDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDeliveryDate(e.target.value)} className="px-1.5 py-1 border border-slate-200 rounded text-xs" />
                                            <label className="text-[9px] text-slate-400">予定日</label>
                                            <input type="date" value={editDue} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDue(e.target.value)} className="px-1.5 py-1 border border-slate-200 rounded text-xs" />
                                            <button onClick={() => handleSave(proc.id, del.id)} className="p-1 bg-blue-600 text-white rounded"><Check size={12} /></button>
                                            <button onClick={() => setEditId(null)} className="p-1 bg-slate-200 rounded"><X size={12} /></button>
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
                                                <button onClick={() => { setEditId(del.id); setEditQty(String(del.qty)); setEditDeliveryDate(del.deliveryDate); setEditDue(del.dueDate); }}
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
