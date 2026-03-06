"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowRight, ArrowLeft, AlertTriangle, Loader2, Check } from "lucide-react";
import { store, type MockLot, type ProcessEntry } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function RoutingPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
    const [selectedLotId, setSelectedLotId] = useState("");
    const [selectedProcessIdx, setSelectedProcessIdx] = useState(0);

    // 次工程
    const [fwdQty, setFwdQty] = useState("");
    const [fwdCompletionDate, setFwdCompletionDate] = useState("");
    const [fwdDeliveryDate, setFwdDeliveryDate] = useState("");
    const [fwdDueDate, setFwdDueDate] = useState("");
    const [fwdOverride, setFwdOverride] = useState("");
    const [fwdNextSub, setFwdNextSub] = useState("");

    // 差戻し
    const [backQty, setBackQty] = useState("");
    const [backDate, setBackDate] = useState("");
    const [backDueDate, setBackDueDate] = useState("");
    const [backPrevSub, setBackPrevSub] = useState("");

    const [confirmLoss, setConfirmLoss] = useState(false);
    const [loading, setLoading] = useState(false);

    // 最終工程の分岐
    const [shipMode, setShipMode] = useState<"inventory" | "ship" | null>(null);
    const [warehouseName, setWarehouseName] = useState("本社倉庫");

    const refresh = useCallback(() => setLots([...store.lots]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const activeLots = lots.filter(l => l.status !== "completed");
    const selectedLot = activeLots.find(l => l.id === selectedLotId) || null;
    const selectedProc = selectedLot?.processes[selectedProcessIdx] || null;

    // 次工程の外注先候補
    const nextProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc) return [];
        const nextIdx = selectedProcessIdx + 1;
        if (nextIdx >= selectedLot.processes.length) return [];
        const nextProcName = selectedLot.processes[nextIdx].name;
        return store.getSubcontractorsForProcess(selectedLot.productId, nextProcName);
    }, [selectedLot, selectedProc, selectedProcessIdx]);

    // 前工程の外注先候補
    const prevProcessSubs = useMemo(() => {
        if (!selectedLot || selectedProcessIdx <= 0) return [];
        const prevProcName = selectedLot.processes[selectedProcessIdx - 1].name;
        return store.getSubcontractorsForProcess(selectedLot.productId, prevProcName);
    }, [selectedLot, selectedProcessIdx]);

    // ロット選択時に初期化
    useEffect(() => {
        if (selectedLot) {
            setFwdQty(""); setFwdCompletionDate(""); setFwdDeliveryDate(""); setFwdDueDate(""); setFwdOverride(""); setFwdNextSub("");
            setBackQty(""); setBackDate(""); setBackDueDate(""); setBackPrevSub("");
            setShipMode(null);
            // 外注先が1つしかない場合は固定
            if (nextProcessSubs.length === 1) setFwdNextSub(nextProcessSubs[0].name);
            if (prevProcessSubs.length === 1) setBackPrevSub(prevProcessSubs[0].name);
        }
    }, [selectedLotId, selectedProcessIdx, nextProcessSubs, prevProcessSubs, selectedLot]);

    const handleForward = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 200));
        const result = store.moveForward(selectedLot.id, selectedProcessIdx, Number(fwdQty), fwdCompletionDate, fwdDeliveryDate, fwdDueDate, {
            overridePrice: fwdOverride ? Number(fwdOverride) : undefined,
            nextSubcontractor: fwdNextSub || undefined,
        });
        if (result.ok) { showToast("success", `${fwdQty}個を次工程へ送りました`); setFwdQty(""); setFwdCompletionDate(""); setFwdDeliveryDate(""); setFwdDueDate(""); setFwdOverride(""); }
        else { showToast("error", result.error || "エラー"); }
        setLoading(false);
    };

    const handleBack = async () => {
        if (!selectedLot) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 200));
        const result = store.moveBack(selectedLot.id, selectedProcessIdx, Number(backQty), backDate, backDueDate, backPrevSub || undefined);
        if (result.ok) { showToast("warning", `${backQty}個を前工程へ差戻しました`); setBackQty(""); setBackDate(""); setBackDueDate(""); }
        else { showToast("error", result.error || "エラー"); }
        setLoading(false);
    };

    const handleMoveToInventory = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        const result = store.moveToInventory(
            selectedLot.id,
            selectedProcessIdx,
            Number(fwdQty),
            warehouseName,
            fwdCompletionDate,
            { overridePrice: fwdOverride ? Number(fwdOverride) : undefined }
        );
        if (result.ok) {
            showToast("success", `${fwdQty}個を${warehouseName}へ移動しました`);
            setFwdQty("");
            setShipMode(null);
        } else {
            showToast("error", result.error || "エラー");
        }
        setLoading(false);
    };

    const handleShip = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        const result = store.shipAndInvoice(
            selectedLot.id,
            selectedProcessIdx,
            Number(fwdQty),
            fwdCompletionDate,
            { overridePrice: fwdOverride ? Number(fwdOverride) : undefined }
        );
        if (result.ok) {
            showToast("success", `${fwdQty}個を出荷し、売上を計上しました`);
            setFwdQty("");
            setShipMode(null);
        } else {
            showToast("error", result.error || "エラー");
        }
        setLoading(false);
    };

    const handleConfirmLoss = () => {
        if (!selectedLot) return;
        const r = store.confirmLoss(selectedLot.id, selectedProcessIdx);
        if (r.ok) showToast("success", `${r.lossQty}個をロスとして確定しました`);
    };

    const isLastProcess = selectedLot ? selectedProcessIdx === selectedLot.processes.length - 1 : false;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* ロット・工程選択 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ロット</label>
                    <select value={selectedLotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedLotId(e.target.value); setSelectedProcessIdx(0); }}
                        className="select-base">
                        <option value="">選択してください</option>
                        {activeLots.map(l => <option key={l.id} value={l.id}>{l.lotNumber} — {l.product} ({l.totalQty}個)</option>)}
                    </select>
                </div>
                {selectedLot && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">工程</label>
                        <select value={selectedProcessIdx} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProcessIdx(Number(e.target.value))}
                            className="select-base">
                            {selectedLot.processes.map((p, i) => <option key={p.id} value={i}>{p.name} — {p.subcontractor} (現在:{p.currentQty})</option>)}
                        </select>
                    </div>
                )}
            </div>

            {selectedProc && (
                <>
                    {/* 現工程ステータス */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div><p className="text-[10px] font-bold text-slate-400">現在数</p><p className="text-2xl font-black text-slate-800">{selectedProc.currentQty}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">完了数</p><p className="text-2xl font-black text-emerald-600">{selectedProc.completedQty}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">ロス</p><p className="text-2xl font-black text-red-500">{selectedProc.lossQty}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">単価</p><p className="text-2xl font-black">{selectedProc.unitPriceOverride ? <span className="text-amber-600">¥{selectedProc.unitPriceOverride}</span> : <span className="text-slate-600">¥{selectedProc.unitPrice}</span>}</p></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 次工程へ送る */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-blue-500" /> 次工程へ送る</h4>
                            <div><label className="block text-[10px] font-black text-slate-400 mb-1">数量</label><input type="number" value={fwdQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdQty(e.target.value)} max={selectedProc.currentQty} className="input-base" placeholder={`最大 ${selectedProc.currentQty}`} /></div>
                            <div><label className="block text-[10px] font-black text-slate-400 mb-1">現工程完了日 *</label><input type="date" value={fwdCompletionDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdCompletionDate(e.target.value)} className="input-base" /></div>
                            {!isLastProcess && (
                                <>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">次工程搬入日 *</label><input type="date" value={fwdDeliveryDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdDeliveryDate(e.target.value)} className="input-base" /></div>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">次工程完了予定日 *</label><input type="date" value={fwdDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdDueDate(e.target.value)} className="input-base" /></div>
                                </>
                            )}
                            {/* 外注先選択 */}
                            {!isLastProcess && nextProcessSubs.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 mb-1">次工程 外注先</label>
                                    {nextProcessSubs.length === 1 ? (
                                        <input type="text" value={nextProcessSubs[0].name} disabled className="input-base bg-slate-50 text-slate-500" />
                                    ) : (
                                        <select value={fwdNextSub} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFwdNextSub(e.target.value)} className="select-base">
                                            <option value="">選択</option>
                                            {nextProcessSubs.map(s => <option key={s.name} value={s.name}>{s.name} (¥{s.unitPrice})</option>)}
                                        </select>
                                    )}
                                </div>
                            )}
                            <div><label className="block text-[10px] font-black text-slate-400 mb-1">特値 (任意)</label><input type="number" value={fwdOverride} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdOverride(e.target.value)} placeholder="空欄=標準単価" className="input-base" /></div>

                            {isLastProcess ? (
                                <div className="pt-2 space-y-3 border-t border-slate-100 mt-2">
                                    <div className="flex gap-2">
                                        <button onClick={() => setShipMode("inventory")} className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${shipMode === "inventory" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"}`}>在庫へ移動</button>
                                        <button onClick={() => setShipMode("ship")} className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${shipMode === "ship" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"}`}>発送・納品</button>
                                    </div>

                                    {shipMode === "inventory" && (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <label className="block text-[10px] font-black text-slate-400 mb-1">保管倉庫</label>
                                            <input type="text" value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} placeholder="例：本社倉庫" className="input-base mb-3" />
                                            <button onClick={handleMoveToInventory} disabled={loading || !fwdQty || !fwdCompletionDate}
                                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2 text-sm">
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> 在庫へ移動を確定</>}
                                            </button>
                                        </div>
                                    )}

                                    {shipMode === "ship" && (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <p className="text-[10px] text-slate-500 mb-3 bg-emerald-50 p-2 rounded-lg border border-emerald-100">受注残と連動し、出荷枚数を更新します。売上が自動計上されます。</p>
                                            <button onClick={handleShip} disabled={loading || !fwdQty || !fwdCompletionDate}
                                                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2 text-sm">
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> 発送・売上計上を確定</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button onClick={handleForward} disabled={loading || !fwdQty || !fwdCompletionDate || !fwdDeliveryDate || !fwdDueDate}
                                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2 text-sm">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> 次工程へ送る</>}
                                </button>
                            )}
                        </div>

                        {/* 差戻し + ロス */}
                        <div className="space-y-4">
                            {selectedProcessIdx > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-amber-500" /> 差戻し</h4>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">数量</label><input type="number" value={backQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackQty(e.target.value)} max={selectedProc.currentQty} className="input-base" /></div>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">差戻し日 *</label><input type="date" value={backDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackDate(e.target.value)} className="input-base" /></div>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">前工程完了予定日 *</label><input type="date" value={backDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackDueDate(e.target.value)} className="input-base" /></div>
                                    {/* 前工程 外注先選択 */}
                                    {prevProcessSubs.length > 0 && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 mb-1">前工程 外注先</label>
                                            {prevProcessSubs.length === 1 ? (
                                                <input type="text" value={prevProcessSubs[0].name} disabled className="input-base bg-slate-50 text-slate-500" />
                                            ) : (
                                                <select value={backPrevSub} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBackPrevSub(e.target.value)} className="select-base">
                                                    <option value="">選択</option>
                                                    {prevProcessSubs.map(s => <option key={s.name} value={s.name}>{s.name} (¥{s.unitPrice})</option>)}
                                                </select>
                                            )}
                                        </div>
                                    )}
                                    <button onClick={handleBack} disabled={loading || !backQty || !backDate || !backDueDate}
                                        className="w-full bg-amber-500 text-white font-bold py-3 rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2 text-sm">
                                        <ArrowLeft className="w-4 h-4" /> 差戻す
                                    </button>
                                </div>
                            )}

                            {selectedProc.currentQty > 0 && !selectedProc.lossConfirmed && (
                                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 space-y-3">
                                    <h4 className="font-bold text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> ロス確定</h4>
                                    <p className="text-xs text-slate-500">現在数 {selectedProc.currentQty}個 を廃棄(ロス)として確定します。</p>
                                    <button onClick={() => setConfirmLoss(true)} className="w-full bg-red-500 text-white font-bold py-3 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all text-sm">ロス確定</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 操作履歴 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h4 className="font-bold text-sm text-slate-800 mb-3">操作履歴</h4>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {store.history.filter(h => h.lotNumber === selectedLot?.lotNumber).slice(0, 10).map(h => (
                                <div key={h.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-50">
                                    <span className="text-slate-300 text-[10px]">{new Date(h.timestamp).toLocaleString("ja-JP")}</span>
                                    <span className="font-bold text-slate-600">{h.action}</span>
                                    <span className="text-slate-400">{h.detail}</span>
                                </div>
                            ))}
                            {store.history.filter(h => h.lotNumber === selectedLot?.lotNumber).length === 0 && <p className="text-xs text-slate-400">履歴なし</p>}
                        </div>
                    </div>
                </>
            )}

            <ConfirmDialog open={confirmLoss} onClose={() => setConfirmLoss(false)} onConfirm={handleConfirmLoss}
                title="ロスを確定しますか？" message={`${selectedProc?.currentQty || 0}個を廃棄として記録します。この操作は取り消せません。`} confirmLabel="ロス確定" danger />
        </div>
    );
}
