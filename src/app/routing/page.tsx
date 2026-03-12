"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowRight, ArrowLeft, AlertTriangle, Loader2, Check } from "lucide-react";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSupabaseData, SupabaseLot, SupabaseLotProcess } from "@/lib/useSupabaseData";
import { moveForward, registerWip, moveBack, moveToInventory, shipAndInvoice, confirmLoss } from "@/lib/services/routingService";

export default function RoutingPage() {
    const { lots, processes, subcontractors, processRates, loading: dataLoading, refresh } = useSupabaseData();
    const [selectedLotId, setSelectedLotId] = useState("");
    const [selectedProcessId, setSelectedProcessId] = useState("");

    // 次工程
    const [fwdQty, setFwdQty] = useState("");
    const [fwdDeliveryDate, setFwdDeliveryDate] = useState("");
    const [fwdDueDate, setFwdDueDate] = useState("");
    const [fwdCompletionDate, setFwdCompletionDate] = useState("");
    const [fwdOverride, setFwdOverride] = useState("");
    const [fwdNextSub, setFwdNextSub] = useState("");

    // 仕掛登録 (V7)
    const [wipQty, setWipQty] = useState("");
    const [wipDeliveryDate, setWipDeliveryDate] = useState("");
    const [wipDueDate, setWipDueDate] = useState("");
    const [wipSub, setWipSub] = useState("");
    const [wipOverride, setWipOverride] = useState("");

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

    const activeLots = lots.filter(l => l.status !== "completed");
    const selectedLot = activeLots.find(l => l.id === selectedLotId) || null;
    const selectedProc = selectedLot?.lot_processes?.find(p => p.id === selectedProcessId) || null;
    const selectedProcCurrentQty = selectedProc ? ((selectedProc.input_quantity || 0) - (selectedProc.completed_quantity || 0) - (selectedProc.loss_qty || 0)) : 0;

    const needsWipRegistration = selectedProc?.status === "pending" || (selectedProc?.processes?.group_index === 0 && selectedProc?.processes?.sort_order === 1 && selectedProc?.status !== "completed");

    // 選択中工程の外注先
    const currentProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc || !selectedProc.process_id) return [];
        return processRates.filter(r => r.process_id === selectedProc.process_id).map(r => ({ ...r.subcontractors, unitPrice: r.unit_price, id: r.subcontractor_id }));
    }, [selectedLot, selectedProc, processRates]);

    // 次工程の外注先候補
    const nextProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc || !selectedProc.processes) return [];
        const productProcs = processes.filter(p => p.product_id === selectedLot.product_id && p.group_index === selectedProc.processes!.group_index).sort((a, b) => a.sort_order - b.sort_order);
        const nextTpl = productProcs.find(t => t.sort_order > selectedProc.processes!.sort_order);
        if (!nextTpl) return [];
        return processRates.filter(r => r.process_id === nextTpl.id).map(r => ({ ...r.subcontractors, unitPrice: r.unit_price, id: r.subcontractor_id, process_id: nextTpl.id }));
    }, [selectedLot, selectedProc, processes, processRates]);

    // 前工程の外注先候補
    const prevProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc || !selectedProc.processes) return [];
        const productProcs = processes.filter(p => p.product_id === selectedLot.product_id && p.group_index === selectedProc.processes!.group_index).sort((a, b) => b.sort_order - a.sort_order);
        const prevTpl = productProcs.find(t => t.sort_order < selectedProc.processes!.sort_order);
        if (!prevTpl) return [];
        return processRates.filter(r => r.process_id === prevTpl.id).map(r => ({ ...r.subcontractors, unitPrice: r.unit_price, id: r.subcontractor_id, process_id: prevTpl.id }));
    }, [selectedLot, selectedProc, processes, processRates]);

    // ロット選択時に初期化
    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        if (selectedLot) {
            setFwdQty(""); setFwdCompletionDate(today); setFwdDeliveryDate(today); setFwdDueDate(today); setFwdOverride(""); setFwdNextSub("");
            setBackQty(""); setBackDate(today); setBackDueDate(today); setBackPrevSub("");
            setWipQty(selectedLot.totalQty.toString()); setWipDeliveryDate(today); setWipDueDate(today); setWipSub(""); setWipOverride("");
            setShipMode(null);
            // 外注先が1つしかない場合は固定
            if (nextProcessSubs.length === 1) setFwdNextSub(nextProcessSubs[0].name);
            if (prevProcessSubs.length === 1) setBackPrevSub(prevProcessSubs[0].name);
            if (currentProcessSubs.length === 1) setWipSub(currentProcessSubs[0].name);
        }
    }, [selectedLotId, selectedProcessId, nextProcessSubs, prevProcessSubs, currentProcessSubs, selectedLot]);

    const handleForward = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        try {
            await moveForward(selectedLot.id, selectedProc.id, Number(fwdQty), fwdCompletionDate, fwdDeliveryDate, fwdDueDate, nextProcessSubs[0]?.process_id, fwdNextSub || undefined, fwdOverride ? Number(fwdOverride) : undefined);
            showToast("success", `${fwdQty}個を次工程へ送りました`);
            setFwdQty("");
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterWip = async () => {
        if (!selectedLot || !selectedProc || !wipSub) return;
        setLoading(true);
        try {
            // Find subcontractor ID by name
            const subId = currentProcessSubs.find(s => s.name === wipSub)?.id || '';
            await registerWip(selectedLot.id, selectedProc.id, Number(wipQty), wipDeliveryDate, wipDueDate, subId, wipOverride ? Number(wipOverride) : undefined);
            showToast("success", "仕掛品として登録しました");
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        } finally {
            setLoading(false);
        }
    };

    const handleBack = async () => {
        if (!selectedLot || !selectedProc || prevProcessSubs.length === 0) return;
        setLoading(true);
        try {
            const subId = prevProcessSubs.find(s => s.name === backPrevSub)?.id;
            await moveBack(selectedLot.id, selectedProc.id, Number(backQty), backDate, backDueDate, prevProcessSubs[0].process_id, subId);
            showToast("warning", `${backQty}個を前工程へ差戻しました`);
            setBackQty(""); setBackDate(""); setBackDueDate("");
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        } finally {
            setLoading(false);
        }
    };

    const handleMoveToInventory = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        try {
            await moveToInventory(selectedLot.id, selectedProc.id, Number(fwdQty), warehouseName, fwdCompletionDate, selectedLot.product_id);
            showToast("success", `${fwdQty}個を${warehouseName}へ移動しました`);
            setFwdQty("");
            setShipMode(null);
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        } finally {
            setLoading(false);
        }
    };

    const handleShip = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        try {
            await shipAndInvoice(selectedLot.id, selectedProc.id, Number(fwdQty), selectedLot.order_id);
            showToast("success", `${fwdQty}個を出荷し、売上を計上しました`);
            setFwdQty("");
            setShipMode(null);
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmLoss = async () => {
        if (!selectedLot || !selectedProc) return;
        try {
            const r = await confirmLoss(selectedLot.id, selectedProc.id);
            setConfirmLoss(false);
            showToast("success", `${r.lossQty}個をロスとして確定しました`);
            refresh();
        } catch (e: any) {
            showToast("error", e.message || "エラー");
        }
    };

    // グループ内の最終工程か判定
    const isLastProcess = useMemo(() => {
        if (!selectedLot || !selectedProc || !selectedProc.processes) return false;
        const hasNext = processes.some(t => t.product_id === selectedLot.product_id && t.group_index === selectedProc.processes!.group_index && t.sort_order > selectedProc.processes!.sort_order);
        return !hasNext;
    }, [selectedLot, selectedProc, processes]);

    // 次工程への移行が可能か（次工程候補が存在し、完了していないか）
    // 次工程を一つに絞るか、すでに複製されている場合はUIにどう出すか。RoutingPageの現在のUIでは、
    // moveForward の際に fwdNextSub で指定した外注情報に基づき、次工程を自動的に複製/合流するため、
    // 次工程が存在するかは hasNext に依存する。

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* ロット・工程選択 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ロット</label>
                    <select value={selectedLotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedLotId(e.target.value); setSelectedProcessId(""); }}
                        className="select-base">
                        <option value="">選択してください</option>
                        {activeLots.map(l => <option key={l.id} value={l.id}>{l.lot_number} — {l.products?.name} ({l.total_quantity}個)</option>)}
                    </select>
                </div>
                {selectedLot && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">工程</label>
                        <select value={selectedProcessId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProcessId(e.target.value)}
                            className="select-base">
                            <option value="">選択してください</option>
                            {selectedLot.lot_processes?.map((p) => {
                                const pCurrentQty = (p.input_quantity || 0) - (p.completed_quantity || 0) - (p.loss_qty || 0);
                                return <option key={p.id} value={p.id}>{p.processes?.name} — {p.subcontractors?.name || '未定'} (現在:{pCurrentQty})</option>;
                            })}
                        </select>
                    </div>
                )}
            </div>

            {selectedProc && (needsWipRegistration || (selectedProc.processes?.group_index === 0 && selectedProc.processes?.sort_order === 1 && selectedProcCurrentQty > 0)) && (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 border-b border-blue-50 pb-4">
                        <div className="bg-blue-600 p-2 rounded-lg text-white"><Loader2 className="w-5 h-5" /></div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-tight">工程の仕掛登録 (投入)</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Register WIP - {selectedProc.processes?.name}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">追加投入数量</label><input type="number" value={wipQty} onChange={e => setWipQty(e.target.value)} className="input-base" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">受注日 (参考)</label><input type="date" value={selectedLot?.created_at?.split('T')[0]} disabled className="input-base bg-slate-50 text-slate-400" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">着手日 *</label><input type="date" value={wipDeliveryDate} onChange={e => setWipDeliveryDate(e.target.value)} className="input-base" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">工程完了予定日 *</label><input type="date" value={wipDueDate} onChange={e => setWipDueDate(e.target.value)} className="input-base" /></div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1">外注先</label>
                            <select value={wipSub} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWipSub(e.target.value)} className="select-base">
                                <option value="">選択してください</option>
                                {currentProcessSubs.map((s: any) => <option key={s.name} value={s.name}>{s.name} (標準:¥{s.unitPrice})</option>)}
                            </select>
                        </div>
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">特値 (任意)</label><input type="number" value={wipOverride} onChange={e => setWipOverride(e.target.value)} placeholder="空欄=標準単価" className="input-base" /></div>
                    </div>

                    <button onClick={handleRegisterWip} disabled={loading || !wipQty || !wipDeliveryDate || !wipDueDate || !wipSub}
                        className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>仕掛登録を確定</>}
                    </button>
                </div>
            )}

            {selectedProc && (selectedProc.status !== "pending" || (selectedProc.processes?.group_index === 0 && selectedProc.processes?.sort_order === 1 && selectedProcCurrentQty > 0)) && (
                <>
                    {/* 現工程ステータス */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div><p className="text-[10px] font-bold text-slate-400">現在数</p><p className="text-2xl font-black text-slate-800">{selectedProcCurrentQty}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">完了数</p><p className="text-2xl font-black text-emerald-600">{selectedProc.completed_quantity || 0}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">ロス</p><p className="text-2xl font-black text-red-500">{selectedProc.loss_qty || 0}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400">単価</p><p className="text-2xl font-black"><span className="text-slate-600">¥{(selectedProc as any).unit_price_override || currentProcessSubs.find(s => s.id === selectedProc.subcontractor_id)?.unitPrice || 0}</span></p></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 次工程へ送る */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-blue-500" /> 次工程へ送る</h4>
                            <div><label className="block text-[10px] font-black text-slate-400 mb-1">数量</label><input type="number" value={fwdQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFwdQty(e.target.value)} max={selectedProcCurrentQty} className="input-base" placeholder={`最大 ${selectedProcCurrentQty}`} /></div>
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
                                        {selectedProc.processes?.group_index === 0 && (
                                            <button onClick={() => setShipMode("ship")} className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${shipMode === "ship" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"}`}>発送・納品</button>
                                        )}
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
                            {selectedLot.lot_processes && selectedLot.lot_processes.findIndex((p: any) => p.id === selectedProcessId) > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><ArrowLeft className="w-4 h-4 text-amber-500" /> 差戻し</h4>
                                    <div><label className="block text-[10px] font-black text-slate-400 mb-1">数量</label><input type="number" value={backQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackQty(e.target.value)} max={selectedProcCurrentQty} className="input-base" /></div>
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

                            {selectedProcCurrentQty > 0 && (
                                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5 space-y-3">
                                    <h4 className="font-bold text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> ロス確定</h4>
                                    <p className="text-xs text-slate-500">現在数 {selectedProcCurrentQty}個 を廃棄(ロス)として確定します。</p>
                                    <button onClick={() => setConfirmLoss(true)} className="w-full bg-red-500 text-white font-bold py-3 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all text-sm">ロス確定</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 操作履歴 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h4 className="font-bold text-sm text-slate-800 mb-3">操作履歴</h4>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {/* History is currently disabled while transitioning to Supabase */}
                            <p className="text-xs text-slate-400">開発中: 履歴は今後実装予定です。</p>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDialog open={confirmLoss} onClose={() => setConfirmLoss(false)} onConfirm={handleConfirmLoss}
                title="ロスを確定しますか？" message={`${selectedProcCurrentQty}個を廃棄として記録します。この操作は取り消せません。`} confirmLabel="ロス確定" danger />
        </div>
    );
}
