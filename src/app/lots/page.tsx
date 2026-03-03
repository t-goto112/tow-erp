"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Package,
    Search,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ChevronRight,
} from "lucide-react";
import { store, type MockLot } from "@/lib/mockStore";
import Modal from "@/components/Modal";

const statusConfig = {
    created: { label: "未着手", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    in_progress: { label: "進行中", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
};

const processStatusConfig = {
    pending: { label: "待機", color: "bg-slate-100 text-slate-500", icon: Clock },
    in_progress: { label: "作業中", color: "bg-blue-50 text-blue-700", icon: Loader2 },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
};

export default function LotsPage() {
    const [lots, setLots] = useState<MockLot[]>([]);
    const [search, setSearch] = useState("");
    const [detailLot, setDetailLot] = useState<MockLot | null>(null);

    const refreshData = useCallback(() => {
        setLots([...store.lots]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const filteredLots = lots.filter(l => l.lotNumber.includes(search) || l.product.includes(search));

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="ロット番号・製品名で検索..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                </div>
            </div>

            <div className="space-y-3">
                {filteredLots.map(lot => {
                    const st = statusConfig[lot.status];
                    const totalCurrent = lot.processes.reduce((s, p) => s + p.currentQty, 0);
                    const totalCompleted = lot.processes.reduce((s, p) => s + p.completedQty, 0);
                    const totalLoss = lot.processes.reduce((s, p) => s + p.lossQty, 0);
                    const lastCompleted = lot.processes.filter(p => p.status === "completed").pop();
                    const currentActive = lot.processes.find(p => p.status === "in_progress");

                    return (
                        <div key={lot.id} onClick={() => setDetailLot(lot)}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-bold text-blue-600">{lot.lotNumber}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">{lot.product}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        総数量: {lot.totalQty}個 | 仕掛: {totalCurrent}個 | ロス: {totalLoss}個
                                    </p>
                                </div>
                                <div className="text-right">
                                    {currentActive && (
                                        <p className="text-xs font-bold text-blue-600">{currentActive.name}</p>
                                    )}
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition ml-auto mt-1" />
                                </div>
                            </div>

                            {/* 工程バー */}
                            <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                                {lot.processes.map((p, i) => {
                                    const pct = lot.totalQty > 0 ? (p.completedQty / lot.totalQty) * 100 : 0;
                                    return (
                                        <div key={p.id} title={`${p.name}: ${p.completedQty}完了 / ${p.currentQty}仕掛`}
                                            style={{ width: `${Math.max(pct, 2)}%` }}
                                            className={`rounded-full transition-all ${p.status === "completed" ? "bg-emerald-400" : p.status === "in_progress" ? "bg-blue-400" : "bg-slate-200"}`} />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ロット詳細モーダル */}
            <Modal open={!!detailLot} onClose={() => setDetailLot(null)}
                title={detailLot?.lotNumber || ""} subtitle={`${detailLot?.product} — 総数量: ${detailLot?.totalQty}個`} width="max-w-2xl">
                {detailLot && (
                    <div className="space-y-4">
                        {detailLot.processes.map((p, i) => {
                            const pst = processStatusConfig[p.status];
                            const PIcon = pst.icon;
                            const effectivePrice = p.unitPriceOverride || p.unitPrice;
                            const cost = p.completedQty * effectivePrice;
                            return (
                                <div key={p.id} className={`rounded-2xl border p-4 transition ${p.status === "in_progress" ? "border-blue-200 bg-blue-50/30" : "border-slate-100"}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl ${pst.color} flex items-center justify-center`}>
                                                <PIcon className={`w-4 h-4 ${p.status === "in_progress" ? "animate-spin" : ""}`} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm text-slate-800">{p.name}</span>
                                                <p className="text-[10px] text-slate-400">{p.subcontractor}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pst.color}`}>{pst.label}</span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">現在数</p>
                                            <p className="text-lg font-black text-slate-800">{p.currentQty}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">完了数</p>
                                            <p className="text-lg font-black text-emerald-600">{p.completedQty}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">ロス</p>
                                            <p className={`text-lg font-black ${p.lossQty > 0 ? "text-red-500" : "text-slate-300"}`}>{p.lossQty}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-2 border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">外注費</p>
                                            <p className="text-sm font-black text-slate-700">¥{cost.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {p.unitPriceOverride && (
                                        <div className="mt-2 text-[10px] text-amber-600 font-bold">⚡ 特値適用中: ¥{p.unitPriceOverride.toLocaleString()} (通常: ¥{p.unitPrice.toLocaleString()})</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>
        </div>
    );
}
