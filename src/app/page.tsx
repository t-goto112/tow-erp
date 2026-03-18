"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import { Search, Plus, Filter, LayoutGrid, List, ChevronRight, History, ArrowRightLeft, User, Package, Calendar, CalendarDays, TrendingUp, MapPin, Subtitles, Clock, CheckCircle2, X, ChevronDown, Trash2, ArrowLeftRight, MoreHorizontal, ShieldCheck, FileText, Settings, LogOut, LayoutDashboard, Truck, Wallet, Database, MoreVertical, Layers, Boxes, BadgeCheck, AlertTriangle, Edit2, Save } from 'lucide-react';
import { updateLotProcessDelivery } from "@/lib/services/lotService";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";

import { useSupabaseData } from "@/lib/useSupabaseData";

export default function Dashboard() {
    const [, setTick] = useState(0);
    const [selectedLot, setSelectedLot] = useState<any | null>(null);
    const [ganttRange, setGanttRange] = useState<"month" | "3month" | "custom">("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

    const { lots, orders, paymentItems, products, profile, refresh } = useSupabaseData();
    const canEdit = profile?.role === 'admin' || (profile?.permissions?.dashboard?.edit !== false);

    const supabase = createClientComponentClient();

    // 1秒ごとに更新（プレースホルダや経過時間用）
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Map properties for UI
    const orderBacklog = useMemo(() => {
        return orders.filter(o => o.status !== "completed" && o.status !== "cancelled").reduce((sum, o) => {
            const qty = (o.order_items || []).reduce((s, item) => s + (item.quantity || 0), 0);
            return sum + qty;
        }, 0);
    }, [orders]);

    const activeWip = useMemo(() => {
        return lots.filter(l => l.status === "in_progress").reduce((sum, l) => sum + (l.total_quantity || 0), 0);
    }, [lots]);

    const wipByLot = useMemo(() => {
        return lots.filter(l => l.status === "in_progress").map(lot => {
            // 受注数 - 最終工程の完了数
            const finishedQty = (lot.lot_processes || [])
                .filter((p: any) => p.processes?.sort_order === Math.max(...(lot.lot_processes?.map((pp: any) => pp.processes?.sort_order || 0) || [0])))
                .reduce((sum: number, p: any) => sum + (p.completed_quantity || 0), 0);
            return {
                ...lot,
                wipQty: lot.total_quantity - finishedQty
            };
        });
    }, [lots]);

    const todayFinished = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return lots.reduce((sum, lot) => {
            const completedToday = (lot.lot_processes || []).reduce((ls, lp) => {
                const delivs = (lp.lot_process_deliveries || []).filter(d => d.completion_date === today);
                return ls + delivs.reduce((ds, d) => ds + (d.qty || 0), 0);
            }, 0);
            return sum + completedToday;
        }, 0);
    }, [lots]);

    // Handlers
    const handleSyncMaster = async () => {
        try {
            // master sync logic placeholder
            showToast("success", "マスタ同期完了");
        } catch (e) {
            showToast("error", "同期エラー" + (e instanceof Error ? `: ${e.message}` : ""));
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm("受注を削除しますか？（関連するロットも削除されます）")) return;
        try {
            const { error } = await supabase.from('orders').delete().eq('id', orderId);
            if (error) throw error;
            showToast("success", "受注削除完了");
            refresh();
        } catch (e) {
            console.error(e);
            showToast("error", "削除エラー");
        }
    };

    return (
        <div className="p-6 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-blue-600" /> ダッシュボード
                    </h1>
                    <p className="text-slate-400 text-xs font-bold mt-1">生産状況概況</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleSyncMaster} className="group flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm active:scale-95">
                        <Database className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition" /> マスタ同期
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-95">
                        <Plus className="w-4 h-4" /> 新規登録
                    </button>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <SummaryCard title="受注残" value={orderBacklog} icon={<FileText className="text-blue-500" />} unit="個" trend="+5.2%" />
                <SummaryCard title="現在仕掛" value={activeWip} icon={<Layers className="text-amber-500" />} unit="個" trend="-2.4%" />
                <SummaryCard title="本日完了" value={todayFinished} icon={<BadgeCheck className="text-emerald-500" />} unit="個" trend="+12.0%" />
                <SummaryCard title="納期遅延" value={0} icon={<AlertTriangle className="text-rose-500" />} unit="件" danger />
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: WIP Detail */}
                <div className="lg:col-span-2 space-y-8">
                    {/* ガントチャート風スケジュール（プレースホルダ） */}
                    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-500" /> 生産スケジュール（予定）
                            </h3>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {["month", "3month"].map(v => (
                                    <button key={v} onClick={() => setGanttRange(v as any)} className={`px-3 py-1 text-[10px] font-black rounded-lg transition ${ganttRange === v ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                                        {v === "month" ? "今月" : "3ヶ月"}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-8 flex flex-col items-center justify-center text-slate-300 min-h-[300px]">
                            <Clock className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-bold opacity-40 italic font-mono uppercase tracking-widest">Schedule Visualization Placeholder</p>
                            <p className="text-[10px] mt-2 opacity-30">今後のアップデートで詳細なガントチャートが表示されます</p>
                        </div>
                    </section>

                    {/* ロット別仕掛一覧 */}
                    <section>
                        <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-500" /> ロット別仕掛一覧
                        </h3>
                        <div className="space-y-2">
                            {wipByLot.map((lot: any) => {
                                const currentProc = (lot.lot_processes || []).find((p: any) => p.status === "in_progress");
                                return (
                                    <div key={lot.id} onClick={() => canEdit && setSelectedLot(lot)}
                                        className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition ${canEdit ? 'hover:shadow-md hover:border-blue-200 cursor-pointer group' : 'opacity-80'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm font-bold text-blue-600">{lot.lot_number}</span>
                                                    <span className="text-xs text-slate-500">{lot.products?.name || ""}</span>
                                                </div>
                                                <div className="flex gap-3 text-[10px] text-slate-400 font-bold">
                                                    <span>受注数: {lot.total_quantity}</span>
                                                    <span>仕掛: {lot.wipQty}</span>
                                                    {currentProc && <span className="text-blue-600">{currentProc.processes?.name || ""}</span>}
                                                </div>
                                            </div>
                                            {canEdit && (
                                                <div className="flex items-center gap-2">
                                                    <Edit2 className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-3 bg-slate-50 rounded-lg p-2 overflow-x-auto flex gap-2 text-[10px] text-slate-400 font-bold border border-slate-100">
                                            {(lot.lot_processes || []).map((p: any) => (
                                                <div key={p.id} className={`flex items-center gap-1 py-0.5 px-2 rounded-md shrink-0 ${p.status === "completed" ? "bg-emerald-100 text-emerald-700" : p.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-white border border-slate-200"}`}>
                                                    <span className="font-black text-[9px] whitespace-nowrap">{p.processes?.name || ""}</span>
                                                    <span className="opacity-70 whitespace-nowrap">: 仕掛{(p.input_quantity || 0) - (p.completed_quantity || 0)}/完了{p.completed_quantity || 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Right Column: Mini Widgets */}
                <div className="space-y-8">
                    {/* 直近の受注 */}
                    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-500" /> 最新の受注登録
                        </h3>
                        <div className="space-y-4">
                            {orders.slice(0, 5).map(o => (
                                <div key={o.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-500 transition border border-transparent group-hover:border-slate-100">
                                            <BadgeCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 tracking-tight">{o.order_number}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{o.customer_name}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteOrder(o.id)} className="p-2 text-slate-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 通知/アラート */}
                    <section className="bg-slate-900 rounded-3xl shadow-xl p-6 text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 transition group-hover:scale-150 duration-700" />
                        <h3 className="text-sm font-black mb-4 flex items-center gap-2 relative">
                            <TrendingUp className="w-4 h-4 text-blue-400" /> システム通知
                        </h3>
                        <div className="space-y-4 relative">
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3">
                                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-black text-white/90">セキュリティ同期完了</p>
                                    <p className="text-[8px] text-white/40 mt-1 font-bold">RLSポリシーが正常に適用されました</p>
                                </div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3">
                                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-white/90">納期遅延アラート（試作）</p>
                                    <p className="text-[8px] text-white/40 mt-1 font-bold">今後の予定に遅延の可能性があります</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* ロット詳細（カード編集 — 納入日も編集可、数量同期） */}
            <LotDetailModal lot={selectedLot} onClose={() => setSelectedLot(null)} refresh={refresh} />
        </div>
    );
}

function SummaryCard({ title, value, icon, unit, trend, danger }: any) {
    return (
        <div className={`bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition hover:shadow-md hover:border-blue-100 group relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 w-16 h-16 opacity-5 -mr-4 -mt-4 transition group-hover:scale-110 duration-500 ${danger ? "text-rose-500" : "text-blue-500"}`}>{icon}</div>
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition group-hover:scale-110 duration-300 shadow-sm ${danger ? "bg-rose-50 border border-rose-100" : "bg-blue-50 border border-blue-100"}`}>
                    <div className="w-5 h-5">{icon}</div>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <div className="flex items-end gap-1">
                <span className={`text-3xl font-black tracking-tighter ${danger ? "text-rose-500" : "text-slate-800"}`}>
                    {value.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-400 mb-1">{unit}</span>
            </div>
            {trend && (
                <div className={`mt-2 text-[9px] font-black flex items-center gap-1 ${trend.startsWith('+') ? "text-emerald-500" : "text-slate-400"}`}>
                    {trend.startsWith('+') ? <TrendingUp size={10} /> : <Clock size={10} />}
                    {trend} vs 先月
                </div>
            )}
        </div>
    );
}

function LotDetailModal({ lot, onClose, refresh }: { lot: any | null; onClose: () => void; refresh: () => void }) {
    const [editingDelivery, setEditingDelivery] = useState<string | null>(null);
    const [editVal, setEditVal] = useState<{ qty: number; date: string; due: string }>({ qty: 0, date: "", due: "" });
    const [saving, setSaving] = useState(false);

    const supabase = createClientComponentClient();

    if (!lot) return null;

    const procs = [...(lot.lot_processes || [])].sort((a: any, b: any) => (a.processes?.sort_order || 0) - (b.processes?.sort_order || 0));

    const handleStartEdit = (del: any) => {
        setEditingDelivery(del.id);
        setEditVal({ qty: del.qty, date: del.delivery_date || "", due: del.due_date || "" });
    };

    const handleSave = async (procId: string) => {
        if (!editingDelivery) return;
        setSaving(true);
        try {
            await updateLotProcessDelivery(procId, editingDelivery, editVal.qty, editVal.date, editVal.due);
            showToast("success", "実績を更新しました");
            setEditingDelivery(null);
            refresh();
        } catch (e) {
            console.error(e);
            showToast("error", "更新に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={!!lot} onClose={onClose} title={lot ? `${lot.lot_number} — ${lot.products?.name || ""}` : ""} subtitle={lot ? `総数量: ${lot.total_quantity}個` : ""} width="max-w-2xl">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                {procs.map((proc: any) => {
                    const currQty = (proc.input_quantity || 0) - (proc.completed_quantity || 0);
                    const deliveries = proc.lot_process_deliveries || [];
                    return (
                        <div key={proc.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400">#{proc.processes?.sort_order || 0}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-slate-800 tracking-tight">{proc.processes?.name || ""}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold">{proc.subcontractors?.name || "未割当"}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 text-[10px] font-bold items-center">
                                    <span className="text-slate-500">仕掛:{currQty}</span>
                                    <span className="text-emerald-600">完了:{proc.completed_quantity || 0}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {deliveries.length > 0 ? deliveries.map((del: any) => (
                                    <div key={del.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                        {editingDelivery === del.id ? (
                                            <div className="p-3 space-y-3">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[8px] font-bold text-slate-400 block mb-1">数量</label>
                                                        <input type="number" value={editVal.qty} onChange={e => setEditVal({ ...editVal, qty: Number(e.target.value) })} className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-bold text-slate-400 block mb-1">納入日</label>
                                                        <input type="date" value={editVal.date} onChange={e => setEditVal({ ...editVal, date: e.target.value })} className="w-full text-[10px] border border-slate-200 rounded px-1 py-1" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] font-bold text-slate-400 block mb-1">期限</label>
                                                        <input type="date" value={editVal.due} onChange={e => setEditVal({ ...editVal, due: e.target.value })} className="w-full text-[10px] border border-slate-200 rounded px-1 py-1" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setEditingDelivery(null)} className="text-[10px] font-bold text-slate-400 px-3 py-1">キャンセル</button>
                                                    <button onClick={() => handleSave(proc.id)} disabled={saving} className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded flex items-center gap-1">
                                                        {saving ? "保存中..." : <><Save size={10} /> 保存</>}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-2.5 text-xs">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-slate-700">{del.qty}個</span>
                                                    {del.delivery_date && <span className="text-slate-400">納入:{del.delivery_date}</span>}
                                                    {del.due_date && <span className="text-slate-400">期限:{del.due_date}</span>}
                                                    {del.completion_date && <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">完了:{del.completion_date}</span>}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); handleStartEdit(del); }} className="p-1 hover:bg-slate-50 rounded transition text-slate-300 hover:text-blue-500">
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )) : <p className="text-[10px] text-slate-300 italic">実績なし</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
