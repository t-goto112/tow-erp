"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    AlertTriangle,
    Wallet,
    TrendingUp,
    Package,
    Layers,
    ArrowRight,
    CalendarDays,
    ChevronRight,
    X,
    Check,
    Loader2,
    Edit2,
} from "lucide-react";
import { store, type MockLot, type ProcessEntry, type Delivery } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Link from "next/link";
import Modal from "@/components/Modal";

export default function Dashboard() {
    const [, setTick] = useState(0);
    const [selectedLot, setSelectedLot] = useState<MockLot | null>(null);
    const [ganttRange, setGanttRange] = useState<"month" | "3month" | "custom">("month");

    const refresh = useCallback(() => setTick(t => t + 1), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const lots = store.lots;
    const orderBacklog = store.totalOrderBacklog;
    const completedInventory = store.inventory.filter(i => i.type === "product").reduce((s, i) => s + i.quantity, 0);
    const paymentDue = store.paymentLines.filter(p => p.status === "pre_payment" || p.status === "paid").reduce((s, p) => s + p.amount, 0);

    // 仕掛品をロット(製品)ごとに集計
    const wipByLot = lots.filter(l => l.status !== "completed").map(lot => {
        const wipQty = lot.processes.reduce((s, p) => s + p.currentQty, 0);
        return { ...lot, wipQty };
    }).filter(l => l.wipQty > 0 || l.status === "created");

    // 納期アラート
    const alerts = store.deadlineAlerts;

    // ガントチャートの日付範囲
    const today = new Date();
    const ganttStart = new Date(today);
    ganttStart.setDate(1); // 今月1日
    if (ganttRange === "3month") ganttStart.setMonth(ganttStart.getMonth() - 1);
    const ganttEnd = new Date(ganttStart);
    if (ganttRange === "month") ganttEnd.setMonth(ganttEnd.getMonth() + 1);
    else ganttEnd.setMonth(ganttEnd.getMonth() + 3);

    const totalDays = Math.ceil((ganttEnd.getTime() - ganttStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 100 / totalDays;

    function dayOffset(dateStr: string) {
        const d = new Date(dateStr);
        return Math.ceil((d.getTime() - ganttStart.getTime()) / (1000 * 60 * 60 * 24));
    }

    // ガントバー色
    const barColors = ["bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-purple-400", "bg-rose-400", "bg-cyan-400"];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* ── KPI カード ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="受注残高" value={`¥${orderBacklog.toLocaleString()}`} icon={TrendingUp} color="blue" href="/orders" />
                {wipByLot.map(lot => (
                    <div key={lot.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all" onClick={() => setSelectedLot(lot)}>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{lot.product}</p>
                        <p className="text-xl font-black text-amber-600">{lot.wipQty}<span className="text-xs text-slate-400 ml-1">仕掛</span></p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{lot.lotNumber}</p>
                    </div>
                ))}
                <SummaryCard label="完成品在庫" value={`${completedInventory}個`} icon={Package} color="emerald" href="/inventory" />
                <SummaryCard label="支払確定額" value={`¥${paymentDue.toLocaleString()}`} icon={Wallet} color="purple" href="/payments" />
            </div>

            {/* ── ガントチャート ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-blue-500" />
                        <h3 className="font-black text-sm text-slate-800">生産ガントチャート</h3>
                    </div>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                        {[{ k: "month" as const, l: "今月" }, { k: "3month" as const, l: "3ヶ月" }].map(r => (
                            <button key={r.k} onClick={() => setGanttRange(r.k)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition ${ganttRange === r.k ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                                {r.l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ヘッダー */}
                <div className="overflow-x-auto pb-2">
                    <div style={{ minWidth: "700px" }}>
                        {/* 日付ヘッダー */}
                        <div className="flex border-b border-slate-100 pb-1 mb-2 pl-36">
                            {Array.from({ length: totalDays }, (_, i) => {
                                const d = new Date(ganttStart);
                                d.setDate(d.getDate() + i);
                                const isToday = d.toISOString().split("T")[0] === today.toISOString().split("T")[0];
                                const isFirst = d.getDate() === 1;
                                return (
                                    <div key={i} style={{ width: `${dayWidth}%` }} className={`text-center shrink-0 ${isToday ? "font-black text-blue-600" : ""}`}>
                                        {(isFirst || d.getDate() % 5 === 0 || isToday) && (
                                            <span className={`text-[8px] ${isToday ? "bg-blue-600 text-white px-1 py-0.5 rounded" : "text-slate-300"}`}>
                                                {isFirst ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getDate()}`}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* ロット行 */}
                        {lots.filter(l => l.status !== "completed").map((lot, lotIdx) => (
                            <div key={lot.id} className="flex items-center mb-1 group">
                                <div className="w-36 shrink-0 pr-2 cursor-pointer hover:text-blue-600 transition" onClick={() => setSelectedLot(lot)}>
                                    <p className="text-[10px] font-bold text-slate-800 truncate group-hover:text-blue-600">{lot.lotNumber}</p>
                                    <p className="text-[8px] text-slate-400 truncate">{lot.product}</p>
                                </div>
                                <div className="flex-1 relative h-6 bg-slate-50 rounded">
                                    {/* 今日線 */}
                                    <div className="absolute top-0 bottom-0 w-px bg-blue-400 z-10" style={{ left: `${dayOffset(today.toISOString().split("T")[0]) * dayWidth}%` }} />
                                    {lot.processes.map((proc, pi) => {
                                        return proc.deliveries.map((del, di) => {
                                            const start = dayOffset(del.deliveryDate);
                                            const end = del.completionDate ? dayOffset(del.completionDate) : dayOffset(del.dueDate);
                                            const width = Math.max(end - start, 1);
                                            const isComplete = !!del.completionDate;
                                            return (
                                                <div key={`${proc.id}-${di}`}
                                                    title={`${proc.name}: ${del.qty}個 (${del.deliveryDate}〜${del.dueDate})`}
                                                    className={`absolute top-0.5 h-5 rounded-md text-[7px] font-bold text-white flex items-center justify-center overflow-hidden transition-all ${isComplete ? barColors[pi % barColors.length] : barColors[pi % barColors.length] + " opacity-60 border-2 border-dashed border-white/50"}`}
                                                    style={{
                                                        left: `${start * dayWidth}%`,
                                                        width: `${width * dayWidth}%`,
                                                        minWidth: "16px",
                                                    }}>
                                                    {width * dayWidth > 3 && <span className="truncate px-0.5">{proc.name}</span>}
                                                </div>
                                            );
                                        });
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── ロット別仕掛一覧 ── */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-amber-500" /> ロット別仕掛一覧
                        </h3>
                        <Link href="/lots" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                            すべて <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {lots.filter(l => l.status !== "completed").map(lot => {
                            const wipQty = lot.processes.reduce((s, p) => s + p.currentQty, 0);
                            const currentProc = lot.processes.find(p => p.status === "in_progress");
                            return (
                                <div key={lot.id}
                                    onClick={() => setSelectedLot(lot)}
                                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition group">
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-mono text-xs font-bold text-blue-600">{lot.lotNumber}</span>
                                            <span className="text-xs text-slate-500">{lot.product}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            仕掛: {wipQty}個 {currentProc && `| ${currentProc.name}`}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                                </div>
                            );
                        })}
                        {lots.filter(l => l.status !== "completed").length === 0 && (
                            <p className="text-sm text-slate-400 py-6 text-center">仕掛中のロットはありません</p>
                        )}
                    </div>
                </div>

                {/* ── 納期アラート ── */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h3 className="font-black text-sm text-slate-800">納期アラート</h3>
                    </div>
                    {alerts.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">アラートなし</p>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {alerts.map((a, i) => (
                                <div key={i} className={`p-3 rounded-2xl border text-xs font-bold ${a.isOverdue ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
                                    <div className="flex items-center justify-between">
                                        <span>
                                            {a.lot} {a.product} ({a.process}・{a.qty}本)
                                        </span>
                                        <span>
                                            完了予定: {new Date(a.dueDate).getMonth() + 1}月{new Date(a.dueDate).getDate()}日
                                            {a.isOverdue && <span className="ml-1.5 bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px]">超過</span>}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── クイックアクション ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction href="/orders" label="新規受注入力" color="blue" />
                <QuickAction href="/routing" label="進捗報告" color="slate" />
                <QuickAction href="/master" label="マスタ管理" color="emerald" />
                <QuickAction href="/payments" label="支払管理" color="purple" />
            </div>

            {/* ── ロット詳細カード(編集可能) ── */}
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} />
        </div>
    );
}

// ─── ロット詳細カード（編集可能） ───
function LotDetailModal({ lot, onClose }: { lot: MockLot | null; onClose: () => void }) {
    const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editDue, setEditDue] = useState("");

    if (!lot) return null;

    const handleSaveDelivery = (proc: ProcessEntry, delivery: Delivery) => {
        if (editQty) delivery.qty = Number(editQty);
        if (editDue) delivery.dueDate = editDue;
        showToast("success", "更新しました");
        setEditingDeliveryId(null);
        setEditQty(""); setEditDue("");
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={`${lot.lotNumber} — ${lot.product}`} subtitle={`総数量: ${lot.totalQty}個`} width="max-w-2xl">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {lot.processes.map((proc, pi) => (
                    <div key={proc.id} className={`rounded-2xl border p-4 ${proc.status === "in_progress" ? "border-blue-200 bg-blue-50/30" : "border-slate-100"}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${proc.status === "completed" ? "bg-emerald-500" : proc.status === "in_progress" ? "bg-blue-500" : "bg-slate-300"}`} />
                                <span className="font-bold text-sm text-slate-800">{proc.name}</span>
                                <span className="text-[10px] text-slate-400">({proc.subcontractor})</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                                <span className="font-bold text-slate-500">現在: {proc.currentQty}</span>
                                <span className="font-bold text-emerald-600">完了: {proc.completedQty}</span>
                                {proc.lossQty > 0 && <span className="font-bold text-red-500">ロス: {proc.lossQty}</span>}
                            </div>
                        </div>

                        {/* 納入実績一覧 */}
                        {proc.deliveries.length > 0 ? (
                            <div className="space-y-1.5">
                                {proc.deliveries.map(del => {
                                    const isEditing = editingDeliveryId === del.id;
                                    return (
                                        <div key={del.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-slate-100 text-xs">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} placeholder={String(del.qty)} className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs font-bold" />
                                                    <span>個</span>
                                                    <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} className="px-1.5 py-1 border border-slate-200 rounded text-xs" />
                                                    <button onClick={() => handleSaveDelivery(proc, del)} className="p-1 bg-blue-600 text-white rounded"><Check size={12} /></button>
                                                    <button onClick={() => setEditingDeliveryId(null)} className="p-1 bg-slate-200 rounded"><X size={12} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-slate-700">{del.qty}個</span>
                                                        <span className="text-slate-400">納入: {del.deliveryDate}</span>
                                                        <span className="text-slate-400">予定: {del.dueDate}</span>
                                                        {del.completionDate && <span className="text-emerald-600 font-bold">完了: {del.completionDate}</span>}
                                                    </div>
                                                    {!del.completionDate && (
                                                        <button onClick={() => { setEditingDeliveryId(del.id); setEditQty(String(del.qty)); setEditDue(del.dueDate); }}
                                                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition">
                                                            <Edit2 size={12} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-300 italic">納入実績なし</p>
                        )}
                    </div>
                ))}
            </div>
        </Modal>
    );
}

function SummaryCard({ label, value, icon: Icon, color, href }: { label: string; value: string; icon: any; color: string; href: string }) {
    const colorMap: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 shadow-blue-100/50",
        amber: "bg-amber-50 text-amber-600 shadow-amber-100/50",
        emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-100/50",
        purple: "bg-purple-50 text-purple-600 shadow-purple-100/50",
    };
    return (
        <Link href={href} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${colorMap[color]}`}><Icon className="w-5 h-5" /></div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
        </Link>
    );
}

function QuickAction({ href, label, color }: { href: string; label: string; color: string }) {
    const colorMap: Record<string, string> = { blue: "bg-blue-600 shadow-blue-600/20 hover:bg-blue-700", slate: "bg-slate-800 shadow-slate-800/20 hover:bg-slate-900", emerald: "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700", purple: "bg-purple-600 shadow-purple-600/20 hover:bg-purple-700" };
    return (
        <Link href={href} className={`${colorMap[color]} text-white font-bold py-4 px-4 rounded-2xl shadow-xl text-center text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2`}>
            {label} <ArrowRight className="w-4 h-4" />
        </Link>
    );
}
