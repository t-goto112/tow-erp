"use client";

import React, { useState } from "react";
import { ChevronRight, Check, X, Edit2, Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import { useSupabaseData, SupabaseLot } from "@/lib/useSupabaseData";
import { updateLotProcessDelivery } from "@/lib/services/lotService";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    created: { label: "未着手", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    in_progress: { label: "進行中", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

export default function LotsPage() {
    const { lots, orders, loading, refresh } = useSupabaseData();
    const [selectedLot, setSelectedLot] = useState<SupabaseLot | null>(null);
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState("");
    const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);

    const resetForm = () => {
        setSelectedOrderId("");
        setSelectedItemIdx(null);
    };

    const handleCreateLot = () => {
        if (!selectedOrderId || selectedItemIdx === null) return;
        // The codebase actually creates lots automatically within order creation right now.
        // For manual lot creation from orders, an RPS or specific service call would be needed.
        showToast("success", "新規ロット機能は現在受注時に自動化されています");
        setIsNewOpen(false);
        resetForm();
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="space-y-3">
                {lots.map(lot => {
                    const st = statusConfig[lot.status] || statusConfig.created;
                    const wipQty = lot.lot_processes?.reduce((s, p) => s + p.current_quantity, 0) || 0;
                    const MathTotalLoss = lot.lot_processes?.reduce((s, p) => s + p.loss_quantity, 0) || 0;
                    const processList = lot.lot_processes?.sort((a, b) => a.step_order - b.step_order) || [];
                    const currentActive = processList.find(p => p.status === "in_progress");

                    return (
                        <div key={lot.id} onClick={() => setSelectedLot(lot)}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold text-blue-600">{lot.lot_number}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">{lot.products?.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">総数: {lot.total_quantity}個 | 仕掛: {wipQty}個 | ロス: {MathTotalLoss}個</p>
                                </div>
                                <div className="text-right">
                                    {currentActive && <p className="text-xs font-bold text-blue-600">{currentActive.process_name}</p>}
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition ml-auto mt-1" />
                                </div>
                            </div>
                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                                {processList.map(p => {
                                    const pct = lot.total_quantity > 0 ? (p.completed_quantity / lot.total_quantity) * 100 : 0;
                                    return <div key={p.id} title={`${p.process_name}: ${p.completed_quantity}完了 / ${p.current_quantity}仕掛`} style={{ width: `${Math.max(pct, 2)}%` }}
                                        className={`rounded-full transition-all ${p.status === "completed" ? "bg-emerald-400" : p.status === "in_progress" ? "bg-blue-400" : "bg-slate-200"}`} />;
                                })}
                            </div>
                        </div>
                    );
                })}
                {lots.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">表示するロットがありません</p></div>}
            </div>

            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} refresh={refresh} />

            {/* 新規ロット登録モーダル */}
            <Modal open={isNewOpen} onClose={() => { setIsNewOpen(false); resetForm(); }} title="新規ロット登録" subtitle="受注品目から製造ロットを作成します" width="max-w-2xl">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">対象受注</label>
                        <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="select-base">
                            <option value="">受注を選択</option>
                            {orders.filter(o => o.status === "pending").map(o => (
                                <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedOrderId && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">対象品目</label>
                            <div className="space-y-2">
                                {orders.find(o => o.id === selectedOrderId)?.order_items?.map((item, i) => (
                                    <button key={i} onClick={() => setSelectedItemIdx(i)}
                                        className={`w-full text-left p-3 rounded-xl border transition ${selectedItemIdx === i ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm">{item.products?.name}</span>
                                            <span className="text-xs text-slate-500">{item.quantity} 個</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button onClick={handleCreateLot} disabled={!selectedOrderId || selectedItemIdx === null}
                            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300">
                            ロットを作成する
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function LotDetailModal({ lot, onClose, refresh }: { lot: SupabaseLot | null; onClose: () => void, refresh: () => void }) {
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editDeliveryDate, setEditDeliveryDate] = useState("");
    const [editDue, setEditDue] = useState("");
    const [loadingAction, setLoadingAction] = useState(false);

    if (!lot) return null;

    const processList = lot.lot_processes ? [...lot.lot_processes].sort((a, b) => a.step_order - b.step_order) : [];

    const handleSave = async (processId: string, deliveryId: string) => {
        try {
            setLoadingAction(true);
            await updateLotProcessDelivery(processId, deliveryId, Number(editQty), editDeliveryDate || undefined, editDue || undefined);
            showToast("success", "実績を更新しました");
            setEditId(null);
            refresh();
            // 簡易的に選択中ロットを閉じるかリフレッシュするか。
            // 理想的にはフックから最新のlotを取り直してUIを更新しますが、単純化のため一覧を再取得します。
        } catch (err) {
            console.error(err);
            showToast("error", "更新に失敗しました");
        } finally {
            setLoadingAction(false);
        }
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={`${lot.lot_number} — ${lot.products?.name}`} subtitle={`総数量: ${lot.total_quantity}個`} width="max-w-2xl">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {processList.map((proc) => (
                    <div key={proc.id} className={`rounded-2xl border p-4 ${proc.status === "in_progress" ? "border-blue-200 bg-blue-50/30" : "border-slate-100"}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${proc.status === "completed" ? "bg-emerald-500" : proc.status === "in_progress" ? "bg-blue-500" : "bg-slate-300"}`} />
                                <span className="font-bold text-sm">{proc.process_name}</span>
                                <span className="text-[10px] text-slate-400">({proc.subcontractors?.name || "自社"})</span>
                            </div>
                            <div className="flex gap-2 text-[10px] font-bold">
                                <span className="text-slate-500">現在:{proc.current_quantity}</span>
                                <span className="text-emerald-600">完了:{proc.completed_quantity}</span>
                                {proc.loss_quantity > 0 && <span className="text-red-500">ロス:{proc.loss_quantity}</span>}
                            </div>
                        </div>
                        {proc.lot_process_deliveries && proc.lot_process_deliveries.length > 0 ? proc.lot_process_deliveries.map(del => {
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
                                            <button onClick={() => handleSave(proc.id, del.id)} disabled={loadingAction} className="p-1 bg-blue-600 text-white rounded"><Check size={12} /></button>
                                            <button onClick={() => setEditId(null)} disabled={loadingAction} className="p-1 bg-slate-200 rounded"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold">{del.qty}個</span>
                                                <span className="text-slate-400">納入:{del.delivery_date || "-"}</span>
                                                <span className="text-slate-400">予定:{del.due_date || "-"}</span>
                                                {del.completion_date && <span className="text-emerald-600 font-bold">完了:{del.completion_date}</span>}
                                            </div>
                                            {!del.completion_date && (
                                                <button onClick={() => { setEditId(del.id); setEditQty(String(del.qty)); setEditDeliveryDate(del.delivery_date || ""); setEditDue(del.due_date || ""); }}
                                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Edit2 size={12} /></button>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        }) : <p className="text-[10px] text-slate-300 italic">納入実績レコードなし</p>}
                    </div>
                ))}
            </div>
        </Modal>
    );
}

