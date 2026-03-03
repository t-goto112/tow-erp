"use client";

import { useState, useEffect, useCallback } from "react";
import {
    AlertTriangle,
    CalendarDays,
    Clock,
    Wallet,
    TrendingUp,
    Package,
    Layers,
    ArrowRight,
    Activity,
} from "lucide-react";
import { store } from "@/lib/mockStore";
import Link from "next/link";

export default function Dashboard() {
    const [, setTick] = useState(0);

    const refreshData = useCallback(() => {
        setTick(t => t + 1);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const orderBacklog = store.totalOrderBacklog;
    const totalWIP = store.totalWIP;
    const paymentDue = store.totalPaymentDue;
    const completedInventory = store.inventory.filter(i => i.type === "product").reduce((s, i) => s + i.quantity, 0);

    // 納期切迫ロット
    const urgentLots = store.lots.flatMap(lot =>
        lot.processes.filter(p => p.status === "in_progress" && p.currentQty > 0).map(p => ({
            lot: lot.lotNumber,
            product: lot.product,
            process: p.name,
            qty: p.currentQty,
            due: p.dueDate,
        }))
    ).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);

    // 工程別仕掛サマリー
    const processSummary: Record<string, number> = {};
    store.lots.forEach(lot => {
        lot.processes.forEach(p => {
            if (p.currentQty > 0) {
                processSummary[p.name] = (processSummary[p.name] || 0) + p.currentQty;
            }
        });
    });
    const processEntries = Object.entries(processSummary).sort((a, b) => b[1] - a[1]);
    const maxProcessQty = Math.max(...processEntries.map(([, v]) => v), 1);

    return (
        <div className="space-y-8 animate-in">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="受注残高" value={`¥${orderBacklog.toLocaleString()}`} icon={TrendingUp} color="blue" href="/orders" />
                <SummaryCard label="仕掛品合計" value={`${totalWIP}個`} icon={Layers} color="amber" href="/lots" />
                <SummaryCard label="完成品在庫" value={`${completedInventory}個`} icon={Package} color="emerald" href="/inventory" />
                <SummaryCard label="支払確定額" value={`¥${paymentDue.toLocaleString()}`} icon={Wallet} color="purple" href="/payments" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── 工程別仕掛品バーチャート ── */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            <h3 className="font-black text-sm text-slate-800">工程別 仕掛品数</h3>
                        </div>
                        <Link href="/routing" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                            進捗報告 <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {processEntries.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">仕掛品はありません</p>
                    ) : (
                        <div className="space-y-4">
                            {processEntries.map(([name, qty]) => (
                                <div key={name}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-slate-600">{name}</span>
                                        <span className="text-xs font-black text-slate-800">{qty}個</span>
                                    </div>
                                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${(qty / maxProcessQty) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 納期切迫リスト ── */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h3 className="font-black text-sm text-slate-800">納期切迫リスト</h3>
                        </div>
                        <Link href="/lots" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                            ロット一覧 <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {urgentLots.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">切迫中のロットはありません</p>
                    ) : (
                        <div className="space-y-2">
                            {urgentLots.map((u, i) => {
                                const isOverdue = u.due < new Date().toISOString().split("T")[0];
                                return (
                                    <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${isOverdue ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono text-xs font-bold text-blue-600">{u.lot}</span>
                                                <span className="text-xs text-slate-500">{u.product}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">{u.process} — {u.qty}個</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold ${isOverdue ? "text-red-600" : "text-slate-600"}`}>
                                                {isOverdue ? "⚠ 超過" : u.due}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 受注一覧（直近3件） ── */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-blue-500" /> 最新受注
                    </h3>
                    <Link href="/orders" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                        すべて表示 <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="space-y-2">
                    {store.orders.slice(0, 3).map(order => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <span className="font-mono text-xs font-bold text-blue-600">{order.orderNumber}</span>
                                <span className="text-xs text-slate-500 ml-2">{order.customerName}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-800">¥{order.items.reduce((s, i) => s + i.qty * i.unitPrice, 0).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── クイックアクション ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction href="/orders" label="新規受注入力" color="blue" />
                <QuickAction href="/routing" label="進捗報告" color="slate" />
                <QuickAction href="/master" label="マスタ管理" color="emerald" />
                <QuickAction href="/payments" label="支払管理" color="purple" />
            </div>

            {/* ── 操作履歴 ── */}
            {store.history.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> 最近の操作
                    </h4>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {store.history.slice(0, 8).map(h => (
                            <div key={h.id} className="flex items-center gap-3 text-xs py-1.5">
                                <span className="text-[10px] text-slate-300 font-mono shrink-0 w-16">{new Date(h.timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className="font-bold text-slate-500 shrink-0 w-16">{h.action}</span>
                                <span className="text-slate-400 truncate">{h.detail}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
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
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${colorMap[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
        </Link>
    );
}

function QuickAction({ href, label, color }: { href: string; label: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: "bg-blue-600 shadow-blue-600/20 hover:bg-blue-700",
        slate: "bg-slate-800 shadow-slate-800/20 hover:bg-slate-900",
        emerald: "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700",
        purple: "bg-purple-600 shadow-purple-600/20 hover:bg-purple-700",
    };

    return (
        <Link href={href}
            className={`${colorMap[color]} text-white font-bold py-4 px-4 rounded-2xl shadow-xl text-center text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2`}>
            {label} <ArrowRight className="w-4 h-4" />
        </Link>
    );
}
