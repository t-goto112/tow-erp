"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

import { Search, Plus, Filter, LayoutGrid, List, ChevronRight, Edit2, History, ArrowRightLeft, User, Package, Calendar, MapPin, Subtitles, Clock, CheckCircle2, AlertCircle, X, ChevronDown, Trash2, ArrowLeftRight, MoreHorizontal, ShieldCheck, FileText, Settings, LogOut, LayoutDashboard, Truck, Wallet, Database, MoreVertical, Layers, Boxes, BadgeCheck, AlertTriangle } from 'lucide-react';
import { store, type MockLot, type ProcessEntry, type Delivery } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

export default function Dashboard() {
    const [, setTick] = useState(0);
    const [selectedLot, setSelectedLot] = useState<MockLot | null>(null);
    const [ganttRange, setGanttRange] = useState<"month" | "3month" | "custom">("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

    const refresh = useCallback(() => setTick((t: number) => t + 1), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const lots = store.lots;
    const orderBacklog = store.totalOrderBacklog;
    const paymentDue = store.paymentLines.filter(p => p.status === "pre_payment").reduce((s, p) => s + p.amount, 0);

    // 仕掛品をロットで集計
    const wipByLot = lots.filter(l => l.status !== "completed").map(lot => {
        const wipQty = lot.processes.reduce((s, p) => s + p.currentQty, 0);
        return { ...lot, wipQty };
    }).filter(l => l.wipQty > 0 || l.status === "created");

    const alerts = store.deadlineAlerts;

    // ガントチャートの日付範囲
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split("T")[0];

    const ganttDates = useMemo(() => {
        let start: Date, end: Date;
        if (ganttRange === "custom" && customFrom && customTo) {
            start = new Date(customFrom); end = new Date(customTo);
        } else {
            start = new Date(todayDate); start.setDate(1);
            end = new Date(start);
            if (ganttRange === "3month") { start.setMonth(start.getMonth() - 1); end.setMonth(end.getMonth() + 2); end.setDate(0); }
            else { end.setMonth(end.getMonth() + 1); end.setDate(0); }
        }
        const days: string[] = [];
        const cur = new Date(start);
        while (cur <= end) { days.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate() + 1); }
        return { days, start: days[0], end: days[days.length - 1] };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ganttRange, customFrom, customTo]);

    // ガントチャートのロットグループ用データ
    const ganttLots = lots.filter(l => l.status !== "completed").map(lot => {
        const bars: { name: string; sub: string; start: string; end: string; color: string; isCurrent: boolean; total: number; wip: number; comp: number; }[] = [];
        lot.processes.forEach(proc => {
            if (proc.deliveries.length === 0 && proc.status === "pending") return;
            const starts = proc.deliveries.map(d => d.deliveryDate).filter(Boolean).sort();
            const ends = proc.deliveries.map(d => d.completionDate || d.dueDate).filter(Boolean).sort();
            const barStart = starts[0] || "";
            const barEnd = ends[ends.length - 1] || "";
            const isOverdue = barEnd && barEnd < todayStr && proc.status !== "completed";
            const color = proc.status === "completed" ? "bg-emerald-400" : isOverdue ? "bg-red-400" : "bg-blue-400";
            bars.push({ name: proc.name, sub: proc.subcontractor, start: barStart, end: barEnd, color, isCurrent: proc.status === "in_progress", total: proc.currentQty + proc.completedQty, wip: proc.currentQty, comp: proc.completedQty });
        });
        return { lot, bars };
    });

    const dayWidth = ganttRange === "3month" ? 12 : 24;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* サマリーカード (完成品在庫削除) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard icon={<Wallet className="w-5 h-5" />} label="受注残高" value={`¥${orderBacklog.toLocaleString()}`} sub={`${store.orders.filter(o => o.status !== "completed" && o.status !== "cancelled").length}件`} color="bg-blue-50 text-blue-600" />
                <SummaryCard icon={<Layers className="w-5 h-5" />} label="仕掛品" value={`${wipByLot.reduce((s, l) => s + l.wipQty, 0)}`} sub={`${wipByLot.length}ロット`} color="bg-amber-50 text-amber-600" />
                <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="支払予定" value={`¥${paymentDue.toLocaleString()}`} sub="未払額" color="bg-emerald-50 text-emerald-600" />
            </div>

            {/* ガントチャート */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-blue-500" />
                        <h3 className="font-black text-slate-800">ガントチャート</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {(["month", "3month", "custom"] as const).map(r => (
                            <button key={r} onClick={() => setGanttRange(r)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${ganttRange === r ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                                {r === "month" ? "今月" : r === "3month" ? "3ヵ月" : "範囲選択"}
                            </button>
                        ))}
                    </div>
                </div>
                {ganttRange === "custom" && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100">
                        <input type="date" value={customFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" />
                        <span className="text-xs text-slate-400">〜</span>
                        <input type="date" value={customTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" />
                    </div>
                )}
                <div className="overflow-x-auto">
                    <div style={{ minWidth: ganttDates.days.length * dayWidth + 200 }} className="relative">
                        {/* 背景の垂直グリッド線 */}
                        <div className="absolute top-0 bottom-0 left-[200px] flex pointer-events-none z-0">
                            {ganttDates.days.map((d: string) => {
                                const dt = new Date(d);
                                const isFirst = dt.getDate() === 1;
                                const isToday = d === todayStr;
                                return (
                                    <div key={d} style={{ width: dayWidth }} className="relative h-full">
                                        <div className={`absolute left-0 top-0 h-full border-l ${isFirst ? "border-slate-300 border-l-2" : "border-slate-100"} ${isToday ? "bg-blue-50/30" : ""}`} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* 日付ヘッダー */}
                        <div className="flex border-b border-slate-100 sticky top-0 bg-white z-20">
                            <div className="w-[200px] shrink-0 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase bg-white z-30 sticky left-0 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">ロット / 工程</div>
                            <div className="flex relative">
                                {ganttDates.days.map((d: string, i: number) => {
                                    const dt = new Date(d);
                                    const isToday = d === todayStr;
                                    const isFirst = dt.getDate() === 1;
                                    return (
                                        <div key={d} style={{ width: dayWidth }} className={`text-center relative`}>
                                            <div className={`relative z-10 bg-white ${isToday ? "bg-blue-50" : ""}`}>
                                                {(i === 0 || isFirst) && <div className="text-[8px] font-bold text-slate-400 whitespace-nowrap">{dt.getMonth() + 1}月</div>}
                                                <div className={`text-[8px] ${isToday ? "text-blue-600 font-black" : "text-slate-300"}`}>{dt.getDate()}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ロットグループ */}
                        {ganttLots.map(({ lot, bars }) => (
                            <div key={lot.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                {/* ロットヘッダー */}
                                <div className="flex items-center cursor-pointer sticky left-0 z-10 bg-white hover:bg-slate-50" onClick={() => setSelectedLot(lot)}>
                                    <div className="w-[200px] shrink-0 px-4 py-2 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold text-blue-600">{lot.lotNumber}</span>
                                            <span className="text-[10px] text-slate-500 truncate" title={lot.product}>{lot.product}</span>
                                            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0 ml-auto" />
                                        </div>
                                    </div>
                                    <div className="flex-1 relative h-2 z-10 pointer-events-none">
                                        {/* 全体スパン（薄いバー） */}
                                        {(() => {
                                            const starts = bars.map(b => b.start).sort();
                                            const ends = bars.map(b => b.end).sort();
                                            if (starts.length === 0) return null;
                                            const s = starts[0] >= ganttDates.start ? starts[0] : ganttDates.start;
                                            const e = ends[ends.length - 1] <= ganttDates.end ? ends[ends.length - 1] : ganttDates.end;
                                            const si = ganttDates.days.indexOf(s);
                                            const ei = ganttDates.days.indexOf(e);
                                            if (si < 0 || ei < 0) return null;
                                            return (
                                                <div className="absolute top-0 h-1 bg-slate-200 rounded-full"
                                                    style={{ left: si * dayWidth, width: (ei - si + 1) * dayWidth }} />
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* 工程バー */}
                                {bars.map((bar, bi) => {
                                    const startIdx = ganttDates.days.indexOf(bar.start >= ganttDates.start ? bar.start : ganttDates.start);
                                    const endIdx = ganttDates.days.indexOf(bar.end <= ganttDates.end ? bar.end : ganttDates.end);
                                    if (startIdx < 0 || endIdx < 0) return null;
                                    const left = startIdx * dayWidth;
                                    const width = Math.max((endIdx - startIdx + 1) * dayWidth, dayWidth);
                                    const gradient = bar.color === "bg-emerald-400" ? "from-emerald-400 to-emerald-500" :
                                        bar.color === "bg-red-400" ? "from-red-400 to-red-500" :
                                            bar.color === "bg-blue-400" ? "from-blue-400 to-blue-500" :
                                                "from-slate-300 to-slate-400";
                                    return (
                                        <div key={bi} className="flex items-center">
                                            <div className="w-[200px] shrink-0 px-4 pl-8 border-r border-slate-100 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                                                <span className="text-[10px] text-slate-400 truncate block" title={bar.name}>{bar.name}</span>
                                            </div>
                                            <div className="relative h-7 flex-1 border-b border-transparent z-10">
                                                <div className={`absolute top-1 rounded-full h-5 bg-gradient-to-r ${gradient} shadow-sm cursor-pointer hover:scale-[1.02] hover:brightness-110 transition-all z-10 flex items-center shadow-md`}
                                                    style={{ left: left + 2, width: width - 4 }}
                                                    title={`${bar.name} [${bar.sub}]: ${bar.start} ~ ${bar.end}`}>
                                                    <span className="text-[9px] text-white font-black px-2 truncate leading-5 flex-1 select-none">
                                                        {bar.total} ({bar.wip}/{bar.comp})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* 今日の線 */}
                        {ganttDates.days.includes(todayStr) && (
                            <div className="absolute top-0 bottom-0 border-l-2 border-red-400 z-20"
                                style={{ left: 200 + ganttDates.days.indexOf(todayStr) * dayWidth }} />
                        )}
                    </div>
                </div>
            </section>

            {/* ロット別仕掛一覧 */}
            <section>
                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-500" /> ロット別仕掛一覧
                </h3>
                <div className="space-y-2">
                    {wipByLot.map(lot => {
                        const currentProc = lot.processes.find(p => p.status === "in_progress");
                        return (
                            <div key={lot.id} onClick={() => setSelectedLot(lot)}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-blue-600">{lot.lotNumber}</span>
                                            <span className="text-xs text-slate-500">{lot.product}</span>
                                        </div>
                                        <div className="flex gap-3 text-[10px] text-slate-400 font-bold">
                                            <span>受注数: {lot.totalQty}</span>
                                            <span>仕掛: {lot.wipQty}</span>
                                            {currentProc && <span className="text-blue-600">{currentProc.name}</span>}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                                </div>
                                <div className="mt-3 bg-slate-50 rounded-lg p-2 overflow-x-auto flex gap-2 text-[10px] text-slate-400 font-bold border border-slate-100">
                                    {lot.processes.map(p => (
                                        <div key={p.id} className={`flex items-center gap-1 py-0.5 px-2 rounded-md shrink-0 ${p.status === "completed" ? "bg-emerald-100 text-emerald-700" : p.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-white border border-slate-200"}`}>
                                            <span className="font-black text-[9px] whitespace-nowrap">{p.name}</span>
                                            <span className="opacity-70 whitespace-nowrap">: 仕掛{p.currentQty}/完了{p.completedQty}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 納期アラート */}
            {alerts.length > 0 && (
                <section>
                    <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" /> 納期アラート
                    </h3>
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <div key={i} className={`flex items-center justify-between rounded-2xl border p-3 ${a.isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
                                <div className="flex items-center gap-3">
                                    {a.isOverdue && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">超過</span>}
                                    <span className="font-mono text-xs font-bold text-blue-600">{a.lot}</span>
                                    <span className="text-xs text-slate-600">{a.process} {a.qty}個</span>
                                </div>
                                <span className={`text-xs font-bold ${a.isOverdue ? "text-red-600" : "text-blue-600"}`}>{a.dueDate}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ロット詳細（カード編集 — 納入日も編集可、数量同期） */}
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />
        </div>
    );
}

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>{icon}</div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-black text-slate-800">{value}</p>
                <p className="text-xs text-slate-400">{sub}</p>
            </div>
        </div>
    );
}

function LotDetailModal({ lot, onClose }: { lot: MockLot | null; onClose: () => void }) {
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [adjustMode, setAdjustMode] = useState<"correct" | "move_prev" | "move_next">("correct");
    const [targetSub, setTargetSub] = useState("");
    const [, setTick] = useState(0);

    if (!lot) return null;

    const handleDeliveryAdjust = (processId: string, deliveryId: string) => {
        const result = store.manualAdjustDeliveryQty(lot.id, processId, deliveryId, adjustMode, Number(editQty), targetSub || undefined);
        if (result.ok) {
            const msg = result.syncPayment ? "調整を実行し、支払金額も更新しました" : "調整を実行しました（支払済のため金額は維持されます）";
            showToast(result.syncPayment ? "success" : "info", msg);
            setEditId(null);
            setTick((t: number) => t + 1);
        } else {
            showToast("error", result.error || "エラー");
        }
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={lot ? `${lot.lotNumber} — ${lot.product}` : ""} subtitle={lot ? `総数量: ${lot.totalQty}個` : ""} width="max-w-2xl">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                {lot.processes.sort((a, b) => a.stepOrder - b.stepOrder).map(proc => (
                    <div key={proc.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400">#{proc.stepOrder}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-slate-800 tracking-tight">{proc.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold">{proc.subcontractor || "未割当"} ・ 単価: ¥{proc.unitPrice}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 text-[10px] font-bold items-center">
                                <span className="text-slate-500">現在:{proc.currentQty}</span>
                                <span className="text-emerald-600">完了:{proc.completedQty}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            {proc.deliveries.length > 0 ? proc.deliveries.map(del => {
                                const isEd = editId === del.id;
                                const product = store.products.find(p => p.id === lot.productId);
                                const group = product?.processGroups[proc.groupIndex];
                                const targetTpl = adjustMode === "move_prev"
                                    ? group?.templates.filter(t => t.sortOrder < proc.stepOrder).sort((a, b) => b.sortOrder - a.sortOrder)[0]
                                    : group?.templates.filter(t => t.sortOrder > proc.stepOrder).sort((a, b) => a.sortOrder - b.sortOrder)[0];
                                const subOptions = targetTpl?.subcontractors || [];

                                // 支払ステータス取得 (V7.8)
                                const payLine = store.paymentLines.find(pl => pl.lotNumber === lot.lotNumber && pl.processName === proc.name && pl.subcontractor === proc.subcontractor);
                                const isSyncedStatus = payLine?.status === "wip" || payLine?.status === "pre_payment";

                                return (
                                    <div key={del.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-all ${isEd ? "border-blue-200 ring-2 ring-blue-50" : "border-slate-100"}`}>
                                        <div className="flex items-center justify-between p-2.5 text-xs">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-700">{del.qty}個</span>
                                                <span className="text-slate-400">納入:{del.deliveryDate}</span>
                                                {del.completionDate && <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">完了:{del.completionDate}</span>}
                                            </div>
                                            {!isEd && (
                                                <button onClick={() => { setEditId(del.id); setEditQty(String(del.qty)); setAdjustMode("correct"); setTargetSub(""); }}
                                                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
                                                    <Edit2 size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {isEd && (
                                            <div className="p-3 border-t border-blue-50 bg-blue-50/20 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase">明細調整 - {del.id}</h5>
                                                    <div className="flex items-center gap-1.5">
                                                        {payLine ? (
                                                            <>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSyncedStatus ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>
                                                                    支払:{payLine.status === "wip" ? "仕掛中" : payLine.status === "pre_payment" ? "支払前" : payLine.status === "paid" ? "支払済" : "確認済"}
                                                                </span>
                                                                {!isSyncedStatus && adjustMode === "correct" && (
                                                                    <div className="flex items-center gap-1 text-amber-600" title="支払確定済みのため、金額は自動修正されません">
                                                                        <AlertCircle size={10} />
                                                                        <span className="text-[9px] font-bold">非連動</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-[9px] text-slate-400 font-bold italic">支払情報なし</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] text-slate-400 mb-0.5">数量</label>
                                                        <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-full input-base !py-1 text-sm font-bold" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] text-slate-400 mb-0.5">モード</label>
                                                        <select value={adjustMode} onChange={(e) => setAdjustMode(e.target.value as any)} className="w-full select-base !py-1 text-xs">
                                                            <option value="correct">修正</option>
                                                            <option value="move_prev">差戻し</option>
                                                            <option value="move_next">送り</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {(adjustMode === "move_prev" || adjustMode === "move_next") && (
                                                    <div>
                                                        <label className="block text-[9px] text-slate-400 mb-0.5">外注先選択</label>
                                                        <select value={targetSub} onChange={(e) => setTargetSub(e.target.value)} className="w-full select-base !py-1 text-xs">
                                                            <option value="">(デフォルト)</option>
                                                            {subOptions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                                        </select>
                                                    </div>
                                                )}

                                                <div className="flex justify-end gap-2 pt-1">
                                                    <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold">キャンセル</button>
                                                    <button onClick={() => handleDeliveryAdjust(proc.id, del.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-sm">実行</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : <p className="text-[10px] text-slate-300 italic">実績なし</p>}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
