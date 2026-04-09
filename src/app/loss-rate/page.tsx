"use client";

import React, { useState, useMemo } from "react";
import { TrendingDown, Package, Settings, Users, Loader2, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { useSupabaseData } from "@/lib/useSupabaseData";

type Tab = "product" | "process" | "subcontractor";
type SortKey = string;
type SortDir = "asc" | "desc";

export default function LossRatePage() {
    const { lots, products, loading } = useSupabaseData();
    const [tab, setTab] = useState<Tab>("product");
    const [sortKey, setSortKey] = useState<SortKey>("lossRate");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    // ━━━━━━━━━━━━ 商品別ロス率 ━━━━━━━━━━━━
    const byProduct = useMemo(() => {
        const map = new Map<string, { name: string; totalInput: number; totalCompleted: number }>();
        lots.forEach((lot: any) => {
            const productName = lot.products?.name || "不明";
            const productId = lot.product_id;
            if (!map.has(productId)) map.set(productId, { name: productName, totalInput: 0, totalCompleted: 0 });
            const entry = map.get(productId)!;
            // 仕掛登録総数 = 最初の工程(group_index=0, sort_order最小)のinput_quantity合算
            const mainProcs = (lot.lot_processes || []).filter((p: any) => (p.processes?.group_index || 0) === 0);
            const sortedProcs = mainProcs.sort((a: any, b: any) => (a.processes?.sort_order || 0) - (b.processes?.sort_order || 0));
            // 最初の工程のinput_quantityを仕掛登録総数とする
            const firstSortOrder = sortedProcs.length > 0 ? sortedProcs[0].processes?.sort_order : null;
            const firstProcs = firstSortOrder !== null ? sortedProcs.filter((p: any) => p.processes?.sort_order === firstSortOrder) : [];
            entry.totalInput += firstProcs.reduce((s: number, p: any) => s + (p.input_quantity || 0), 0);
            // 完成総数 = 最後の工程のcompleted_quantity合算
            const lastSortOrder = sortedProcs.length > 0 ? sortedProcs[sortedProcs.length - 1].processes?.sort_order : null;
            const lastProcs = lastSortOrder !== null ? sortedProcs.filter((p: any) => p.processes?.sort_order === lastSortOrder) : [];
            entry.totalCompleted += lastProcs.reduce((s: number, p: any) => s + (p.completed_quantity || 0), 0);
        });
        return Array.from(map.values()).map(e => ({
            ...e,
            lossQty: Math.max(0, e.totalInput - e.totalCompleted),
            lossRate: e.totalInput > 0 ? Math.max(0, ((e.totalInput - e.totalCompleted) / e.totalInput) * 100) : 0,
        }));
    }, [lots]);

    // ━━━━━━━━━━━━ 工程別ロス率 ━━━━━━━━━━━━
    const byProcess = useMemo(() => {
        const map = new Map<string, { name: string; totalInput: number; totalLoss: number }>();
        lots.forEach((lot: any) => {
            (lot.lot_processes || []).forEach((lp: any) => {
                const procName = lp.processes?.name || "不明";
                const procId = lp.process_id;
                if (!map.has(procId)) map.set(procId, { name: procName, totalInput: 0, totalLoss: 0 });
                const entry = map.get(procId)!;
                entry.totalInput += (lp.input_quantity || 0);
                if (lp.loss_confirmed) {
                    entry.totalLoss += (lp.loss_qty || 0);
                }
            });
        });
        return Array.from(map.values()).map(e => ({
            ...e,
            lossRate: e.totalInput > 0 ? (e.totalLoss / e.totalInput) * 100 : 0,
        }));
    }, [lots]);

    // ━━━━━━━━━━━━ 外注先別ロス率 ━━━━━━━━━━━━
    const bySubcontractor = useMemo(() => {
        const map = new Map<string, { name: string; totalInput: number; totalLoss: number }>();
        lots.forEach((lot: any) => {
            (lot.lot_processes || []).forEach((lp: any) => {
                const subName = lp.subcontractors?.name || "未割当";
                const subId = lp.subcontractor_id || "none";
                if (!map.has(subId)) map.set(subId, { name: subName, totalInput: 0, totalLoss: 0 });
                const entry = map.get(subId)!;
                entry.totalInput += (lp.input_quantity || 0);
                if (lp.loss_confirmed) {
                    entry.totalLoss += (lp.loss_qty || 0);
                }
            });
        });
        return Array.from(map.values()).map(e => ({
            ...e,
            lossRate: e.totalInput > 0 ? (e.totalLoss / e.totalInput) * 100 : 0,
        }));
    }, [lots]);

    // ソート適用
    const sortedData = useMemo(() => {
        let data: any[];
        if (tab === "product") data = [...byProduct];
        else if (tab === "process") data = [...byProcess];
        else data = [...bySubcontractor];

        data.sort((a, b) => {
            const aVal = a[sortKey] ?? 0;
            const bVal = b[sortKey] ?? 0;
            if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        });
        return data;
    }, [tab, byProduct, byProcess, bySubcontractor, sortKey, sortDir]);

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "product", label: "商品別", icon: <Package className="w-4 h-4" /> },
        { key: "process", label: "工程別", icon: <Settings className="w-4 h-4" /> },
        { key: "subcontractor", label: "外注先別", icon: <Users className="w-4 h-4" /> },
    ];

    const SortIcon = ({ col }: { col: string }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 inline ml-1" />;
        return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-500 inline ml-1" /> : <ArrowDown className="w-3 h-3 text-blue-500 inline ml-1" />;
    };

    const getRateColor = (rate: number) => {
        if (rate >= 10) return "text-red-600 bg-red-50";
        if (rate >= 5) return "text-amber-600 bg-amber-50";
        if (rate > 0) return "text-blue-600 bg-blue-50";
        return "text-emerald-600 bg-emerald-50";
    };

    const getRateBarWidth = (rate: number) => Math.min(rate, 100);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* ヘッダー */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-orange-500 text-white rounded-2xl shadow-lg flex items-center justify-center">
                    <TrendingDown className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800">ロス率分析</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Loss Rate Analysis</p>
                </div>
            </div>

            {/* タブ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex border-b border-slate-100">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setTab(t.key); setSortKey("lossRate"); setSortDir("desc"); }}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${tab === t.key
                                ? "border-blue-600 text-blue-600 bg-blue-50/30"
                                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* サマリーカード */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-100">
                    <MiniCard label="対象数" value={`${sortedData.length}件`} />
                    <MiniCard label="平均ロス率" value={`${sortedData.length > 0 ? (sortedData.reduce((s, d) => s + d.lossRate, 0) / sortedData.length).toFixed(1) : 0}%`} />
                    <MiniCard label="最大ロス率" value={`${sortedData.length > 0 ? Math.max(...sortedData.map(d => d.lossRate)).toFixed(1) : 0}%`} />
                    <MiniCard label={tab === "product" ? "総仕掛登録数" : "総納入数"} value={sortedData.reduce((s, d) => s + (tab === "product" ? d.totalInput : d.totalInput), 0).toLocaleString()} />
                </div>

                {/* テーブル */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("name")}>
                                    {tab === "product" ? "商品名" : tab === "process" ? "工程名" : "外注先名"}
                                    <SortIcon col="name" />
                                </th>
                                {tab === "product" ? (
                                    <>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalInput")}>
                                            仕掛登録総数<SortIcon col="totalInput" />
                                        </th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalCompleted")}>
                                            完成総数<SortIcon col="totalCompleted" />
                                        </th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("lossQty")}>
                                            ロス数<SortIcon col="lossQty" />
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalInput")}>
                                            納入総数<SortIcon col="totalInput" />
                                        </th>
                                        <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalLoss")}>
                                            ロス確定数<SortIcon col="totalLoss" />
                                        </th>
                                    </>
                                )}
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none min-w-[180px]" onClick={() => handleSort("lossRate")}>
                                    ロス率<SortIcon col="lossRate" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedData.length === 0 && (
                                <tr>
                                    <td colSpan={tab === "product" ? 5 : 4} className="text-center py-12 text-slate-300 font-bold">
                                        データがありません
                                    </td>
                                </tr>
                            )}
                            {sortedData.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-bold text-slate-700">{row.name}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-600">{row.totalInput.toLocaleString()}</td>
                                    {tab === "product" && (
                                        <td className="px-4 py-3 text-right font-mono text-slate-600">{row.totalCompleted.toLocaleString()}</td>
                                    )}
                                    {tab === "product" ? (
                                        <td className="px-4 py-3 text-right font-mono text-slate-600">{row.lossQty.toLocaleString()}</td>
                                    ) : (
                                        <td className="px-4 py-3 text-right font-mono text-slate-600">{row.totalLoss.toLocaleString()}</td>
                                    )}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden md:block">
                                                <div
                                                    className={`h-full rounded-full transition-all ${row.lossRate >= 10 ? "bg-red-400" : row.lossRate >= 5 ? "bg-amber-400" : row.lossRate > 0 ? "bg-blue-400" : "bg-emerald-400"}`}
                                                    style={{ width: `${getRateBarWidth(row.lossRate)}%` }}
                                                />
                                            </div>
                                            <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-black min-w-[56px] text-right ${getRateColor(row.lossRate)}`}>
                                                {row.lossRate.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 凡例 */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs text-slate-400 font-bold mb-2">📊 ロス率の計算方法</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-500">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <span className="font-black text-slate-700">商品別</span>: (仕掛登録総数 − 完成総数) ÷ 仕掛登録総数
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <span className="font-black text-slate-700">工程別</span>: ロス確定総数 ÷ その工程への納入総数
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <span className="font-black text-slate-700">外注先別</span>: ロス確定総数 ÷ その外注先への納入総数
                    </div>
                </div>
                <div className="flex gap-3 mt-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> 0%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> ~5%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> ~10%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> 10%~</span>
                </div>
            </div>
        </div>
    );
}

function MiniCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-lg font-black text-slate-700">{value}</p>
        </div>
    );
}
