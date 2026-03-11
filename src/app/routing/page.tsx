"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowRight, ArrowLeft, AlertTriangle, Loader2, Check } from "lucide-react";
import { store, type MockLot, type ProcessEntry } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function RoutingPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
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

    const refresh = useCallback(() => setLots([...store.lots]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const activeLots = lots.filter((l: MockLot) => l.status !== "completed");
    const selectedLot = activeLots.find((l: MockLot) => l.id === selectedLotId) || null;
    const selectedProc = selectedLot?.processes.find((p: ProcessEntry) => p.id === selectedProcessId) || null;

    const needsWipRegistration = selectedProc?.status === "pending" || (selectedProc?.groupIndex === 0 && selectedProc?.stepOrder === 1 && selectedProc?.status !== "completed");

    // 選択中工程の外注先
    const currentProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc) return [];
        return store.getSubcontractorsForProcess(selectedLot.productId, selectedProc.name);
    }, [selectedLot, selectedProc]);

    // 次工程の外注先候補
    const nextProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc) return [];
        const product = store.products.find(p => p.id === selectedLot.productId);
        const group = product?.processGroups[selectedProc.groupIndex];
        const nextTpl = group?.templates
            .filter(t => t.sortOrder > selectedProc.stepOrder)
            .sort((a, b) => a.sortOrder - b.sortOrder)[0];
        if (!nextTpl) return [];
        return nextTpl.subcontractors;
    }, [selectedLot, selectedProc]);

    // 前工程の外注先候補
    const prevProcessSubs = useMemo(() => {
        if (!selectedLot || !selectedProc) return [];
        const product = store.products.find(p => p.id === selectedLot.productId);
        const group = product?.processGroups[selectedProc.groupIndex];
        const prevTpl = group?.templates
            .filter(t => t.sortOrder < selectedProc.stepOrder)
            .sort((a, b) => b.sortOrder - a.sortOrder)[0];
        if (!prevTpl) return [];
        return prevTpl.subcontractors;
    }, [selectedLot, selectedProc]);

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
        await new Promise(r => setTimeout(r, 200));
        const result = store.moveForward(selectedLot.id, selectedProc.id, Number(fwdQty), fwdCompletionDate, fwdDeliveryDate, fwdDueDate, {
            overridePrice: fwdOverride ? Number(fwdOverride) : undefined,
            nextSubcontractor: fwdNextSub || undefined,
        });
        if (result.ok) { showToast("success", `${fwdQty}個を次工程へ送りました`); setFwdQty(""); }
        else { showToast("error", result.error || "エラー"); }
        setLoading(false);
    };

    const handleRegisterWip = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        const result = store.registerWip(selectedLot.id, selectedProc.id, Number(wipQty), wipDeliveryDate, wipDueDate, wipSub, wipOverride ? Number(wipOverride) : undefined);
        if (result.ok) {
            showToast("success", "仕掛品として登録しました");
            refresh();
        } else {
            showToast("error", result.error || "エラー");
        }
        setLoading(false);
    };

    const handleBack = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 200));
        const result = store.moveBack(selectedLot.id, selectedProc.id, Number(backQty), backDate, backDueDate, backPrevSub || undefined);
        if (result.ok) { showToast("warning", `${backQty}個を前工程へ差戻しました`); setBackQty(""); setBackDate(""); setBackDueDate(""); }
        else { showToast("error", result.error || "エラー"); }
        setLoading(false);
    };

    const handleMoveToInventory = async () => {
        if (!selectedLot || !selectedProc) return;
        setLoading(true);
        const result = store.moveToInventory(
            selectedLot.id,
            selectedProc.id,
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
            selectedProc.id,
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
        if (!selectedLot || !selectedProc) return;
        const r = store.confirmLoss(selectedLot.id, selectedProc.id);
        if (r.ok) showToast("success", `${r.lossQty}個をロスとして確定しました`);
    };

    // グループ内の最終工程か判定（自身の groupIndex と共通の工程を探し、自身より先の stepOrder が存在するかどうか）
    const isLastProcess = useMemo(() => {
        if (!selectedLot || !selectedProc) return false;
        const product = store.products.find(p => p.id === selectedLot.productId);
        const group = product?.processGroups[selectedProc.groupIndex];
        if (!group) return false;

        // マスタテンプレートにおいて、自分より大きい sortOrder が存在するか
        const hasNextInTemplate = group.templates.some(t => t.sortOrder > selectedProc.stepOrder);
        return !hasNextInTemplate;
    }, [selectedLot, selectedProc]);

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
                        {activeLots.map(l => <option key={l.id} value={l.id}>{l.lotNumber} — {l.product} ({l.totalQty}個)</option>)}
                    </select>
                </div>
                {selectedLot && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">工程</label>
                        <select value={selectedProcessId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProcessId(e.target.value)}
                            className="select-base">
                            <option value="">選択してください</option>
                            {selectedLot.processes.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.subcontractor} (現在:{p.currentQty})</option>)}
                        </select>
                    </div>
                )}
            </div>

            {selectedProc && (needsWipRegistration || (selectedProc.groupIndex === 0 && selectedProc.stepOrder === 1 && selectedProc.status !== "completed")) && (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 border-b border-blue-50 pb-4">
                        <div className="bg-blue-600 p-2 rounded-lg text-white"><Loader2 className="w-5 h-5" /></div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-tight">工程の仕掛登録 (投入)</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Register WIP - {selectedProc.name}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">追加投入数量</label><input type="number" value={wipQty} onChange={e => setWipQty(e.target.value)} className="input-base" /></div>
                        <div><label className="block text-[10px] font-black text-slate-400 mb-1">受注日 (参考)</label><input type="date" value={selectedLot?.orderDate} disabled className="input-base bg-slate-50 text-slate-400" /></div>
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

            {selectedProc && (selectedProc.status !== "pending" || (selectedProc.groupIndex === 0 && selectedProc.stepOrder === 1 && selectedProc.currentQty > 0)) && (
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
                                        {selectedProc.groupIndex === 0 && (
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
                            {selectedLot.processes.findIndex((p: any) => p.id === selectedProcessId) > 0 && (
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

                            {selectedProc.currentQty > 0 && (
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
