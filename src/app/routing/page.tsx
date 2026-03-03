"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Truck,
    CheckCircle,
    AlertTriangle,
    ArrowLeft,
    Loader2,
    Trash2,
    CornerDownLeft,
    ArrowRight,
    DollarSign,
} from "lucide-react";
import { store, type MockLot } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function RoutingPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
    const [selectedLotId, setSelectedLotId] = useState<string>("");
    const [selectedProcessIdx, setSelectedProcessIdx] = useState<number>(0);
    const [moveQty, setMoveQty] = useState<number>(0);
    const [backQty, setBackQty] = useState<number>(0);
    const [overridePrice, setOverridePrice] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [confirmLossOpen, setConfirmLossOpen] = useState(false);

    // ストアの変更を監視
    const refreshData = useCallback(() => {
        setLots([...store.lots]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    // 選択中のロットと工程
    const selectedLot = lots.find(l => l.id === selectedLotId);
    const selectedProcess = selectedLot?.processes[selectedProcessIdx];
    const prevProcess = selectedLot?.processes[selectedProcessIdx - 1];
    const nextProcess = selectedLot?.processes[selectedProcessIdx + 1];

    // 自動: 最初のロットを選択
    useEffect(() => {
        if (lots.length > 0 && !selectedLotId) {
            setSelectedLotId(lots[0].id);
        }
    }, [lots, selectedLotId]);

    // ─── 次工程へ移動 ───
    const handleMoveForward = async () => {
        if (!selectedLot || moveQty <= 0) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 400)); // UXのための微小ディレイ
        const result = store.moveForward(selectedLot.id, selectedProcessIdx, moveQty);
        setLoading(false);
        if (result.ok) {
            showToast("success", `${moveQty}個を次工程へ移動しました`);
            setMoveQty(0);
        } else {
            showToast("error", result.error || "エラーが発生しました");
        }
    };

    // ─── 差戻し ───
    const handleMoveBack = async () => {
        if (!selectedLot || backQty <= 0) return;
        setLoading(true);
        await new Promise(r => setTimeout(r, 400));
        const result = store.moveBack(selectedLot.id, selectedProcessIdx, backQty);
        setLoading(false);
        if (result.ok) {
            showToast("warning", `${backQty}個を前工程へ差戻しました`);
            setBackQty(0);
        } else {
            showToast("error", result.error || "エラーが発生しました");
        }
    };

    // ─── ロス確定 ───
    const handleConfirmLoss = async () => {
        if (!selectedLot) return;
        const result = store.confirmLoss(selectedLot.id, selectedProcessIdx);
        if (result.ok) {
            showToast("success", `${result.lossQty}個をロス確定しました（工程完了）`);
        } else {
            showToast("error", result.error || "エラーが発生しました");
        }
    };

    // ─── 特値設定 ───
    const handleSetOverridePrice = () => {
        if (!selectedProcess || !overridePrice) return;
        selectedProcess.unitPriceOverride = Number(overridePrice);
        showToast("success", `特値を¥${Number(overridePrice).toLocaleString()}に設定しました`);
        setOverridePrice("");
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
            <h3 className="text-2xl font-black tracking-tight text-slate-800">
                工程実績の報告
            </h3>

            {/* ── ロット・工程選択 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="対象ロット">
                    <select
                        value={selectedLotId}
                        onChange={e => { setSelectedLotId(e.target.value); setSelectedProcessIdx(0); }}
                        className="select-base"
                    >
                        {lots.map(l => (
                            <option key={l.id} value={l.id}>
                                {l.lotNumber} | {l.product} ({l.totalQty}個)
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="対象工程">
                    <select
                        value={selectedProcessIdx}
                        onChange={e => setSelectedProcessIdx(Number(e.target.value))}
                        className="select-base"
                    >
                        {selectedLot?.processes.map((p, i) => (
                            <option key={p.id} value={i}>
                                {p.name} ({p.subcontractor}) — 現在数: {p.currentQty}個
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            {/* ── 工程サマリーバー ── */}
            {selectedLot && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 overflow-x-auto">
                    <div className="flex items-center gap-1 min-w-[600px]">
                        {selectedLot.processes.map((p, i) => {
                            const isActive = i === selectedProcessIdx;
                            const barColor = p.status === "completed" ? "bg-emerald-500" : p.status === "in_progress" ? "bg-blue-500" : "bg-slate-200";
                            return (
                                <div key={p.id} className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => setSelectedProcessIdx(i)}>
                                    <div className={`w-full h-2.5 rounded-full transition-all ${barColor} ${isActive ? "ring-2 ring-blue-400 ring-offset-2" : "opacity-60 group-hover:opacity-100"}`} />
                                    <span className={`text-[9px] font-bold uppercase tracking-wider transition ${isActive ? "text-blue-600" : "text-slate-400"}`}>
                                        {p.name}
                                    </span>
                                    <span className={`text-[10px] font-black ${isActive ? "text-slate-800" : "text-slate-400"}`}>
                                        {p.currentQty}個
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {selectedProcess && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ── A. 工程完了（次工程へ移動） ── */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-50 rounded-full opacity-40 group-hover:scale-110 transition duration-500" />
                        <div className="flex items-center gap-3 mb-6 relative">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center">
                                <ArrowRight className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-black text-lg text-slate-800">次工程へ送る</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {selectedProcess.name} → {nextProcess?.name || "在庫計上"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-5 relative">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">この工程の現在数</span>
                                    <span className="text-2xl font-black text-blue-600">{selectedProcess.currentQty}<span className="text-xs text-slate-400 ml-1">個</span></span>
                                </div>
                            </div>

                            <Field label="完了数（次工程へ送る数）">
                                <input
                                    type="number"
                                    value={moveQty || ""}
                                    onChange={e => setMoveQty(Math.max(0, Number(e.target.value)))}
                                    max={selectedProcess.currentQty}
                                    placeholder="0"
                                    className="input-base text-xl font-black text-blue-600"
                                />
                            </Field>

                            {moveQty > 0 && moveQty <= selectedProcess.currentQty && (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs space-y-1">
                                    <div className="flex justify-between font-bold text-blue-700">
                                        <span>経費計算（良品 × 単価）</span>
                                        <span>¥{(moveQty * (selectedProcess.unitPriceOverride || selectedProcess.unitPrice)).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-blue-500">
                                        <span>{moveQty}個 × ¥{(selectedProcess.unitPriceOverride || selectedProcess.unitPrice).toLocaleString()}</span>
                                        {selectedProcess.unitPriceOverride && <span className="text-amber-600 font-bold">特値適用中</span>}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleMoveForward}
                                disabled={loading || moveQty <= 0 || moveQty > selectedProcess.currentQty}
                                className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> 完了報告を実行</>}
                            </button>
                        </div>
                    </div>

                    {/* ── B. 差戻し＋ロス確定＋特値 ── */}
                    <div className="space-y-6">
                        {/* 差戻し */}
                        {selectedProcessIdx > 0 && (
                            <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-40 group-hover:scale-110 transition duration-500" />
                                <div className="flex items-center gap-3 mb-5 relative">
                                    <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center">
                                        <CornerDownLeft className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">前工程へ差戻し</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">{selectedProcess.name} → {prevProcess?.name}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 relative">
                                    <input
                                        type="number"
                                        value={backQty || ""}
                                        onChange={e => setBackQty(Math.max(0, Number(e.target.value)))}
                                        max={selectedProcess.currentQty}
                                        placeholder="差戻し数"
                                        className="input-base flex-1 text-amber-700 font-bold"
                                    />
                                    <button
                                        onClick={handleMoveBack}
                                        disabled={loading || backQty <= 0 || backQty > selectedProcess.currentQty}
                                        className="px-6 py-3 bg-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-[0.98] transition-all disabled:bg-slate-300 disabled:shadow-none flex items-center gap-2 shrink-0"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowLeft className="w-4 h-4" /> 差戻し</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ロス確定 */}
                        {selectedProcess.currentQty > 0 && !selectedProcess.lossConfirmed && (
                            <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">ロス数確定</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">残りの未完了数を廃棄扱いにする</p>
                                    </div>
                                </div>
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-red-600">廃棄対象数量（自動計算）</span>
                                    <span className="text-2xl font-black text-red-600">{selectedProcess.currentQty}<span className="text-xs ml-1">個</span></span>
                                </div>
                                <button
                                    onClick={() => setConfirmLossOpen(true)}
                                    className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <AlertTriangle className="w-5 h-5" /> ロス数を確定する
                                </button>
                            </div>
                        )}

                        {/* 特値入力 */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">特値設定</h4>
                                    <p className="text-[10px] text-slate-400 font-bold">通常単価: ¥{selectedProcess.unitPrice.toLocaleString()} {selectedProcess.unitPriceOverride ? `→ 特値: ¥${selectedProcess.unitPriceOverride.toLocaleString()}` : ""}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="number"
                                    value={overridePrice}
                                    onChange={e => setOverridePrice(e.target.value)}
                                    placeholder="特値単価を入力"
                                    className="input-base flex-1 font-bold"
                                />
                                <button
                                    onClick={handleSetOverridePrice}
                                    disabled={!overridePrice}
                                    className="px-6 py-3 bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-800/20 hover:bg-slate-900 active:scale-[0.98] transition-all disabled:bg-slate-300 shrink-0"
                                >
                                    設定
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 操作履歴 ── */}
            {store.history.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">最近の操作履歴</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {store.history.slice(0, 10).map(h => (
                            <div key={h.id} className="flex items-center gap-3 text-xs py-2 border-b border-slate-50 last:border-0">
                                <span className="text-[10px] text-slate-300 font-mono shrink-0">{new Date(h.timestamp).toLocaleTimeString("ja-JP")}</span>
                                <span className="font-bold text-slate-600">{h.action}</span>
                                <span className="text-slate-400 truncate">{h.detail}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ロス確定ダイアログ */}
            <ConfirmDialog
                open={confirmLossOpen}
                onClose={() => setConfirmLossOpen(false)}
                onConfirm={handleConfirmLoss}
                title="ロス数を確定しますか？"
                message={`この操作は取り消せません。${selectedProcess?.name || ""}に残っている ${selectedProcess?.currentQty || 0}個 が「確定ロス（廃棄）」となり、この工程が完了します。`}
                confirmLabel="ロスを確定する"
                danger
            />
        </div>
    );
}

function Field({ label, labelColor, children }: { label: string; labelColor?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className={`block text-[10px] font-black mb-2 uppercase tracking-widest ${labelColor || "text-slate-400"}`}>
                {label}
            </label>
            {children}
        </div>
    );
}
