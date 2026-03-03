"use client";

import React, { useState } from "react";
import {
    Package,
    ArrowLeft,
    Search,
    Plus,
    GitBranch,
    GitMerge,
    RotateCcw,
    ChevronDown,
    ChevronRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from "lucide-react";

/* ─── mock data ─── */
const LOTS = [
    {
        id: "1", lotNumber: "A23-045", product: "牛刀 210mm", quantity: 500, status: "in_progress" as const,
        splitType: "none" as const, childLots: [],
        processes: [
            { name: "鍛造", sub: "鍛造所 田中", status: "completed", input: 500, completed: 490, defect: 10 },
            { name: "荒研ぎ", sub: "研ぎ工房 山本", status: "in_progress", input: 490, completed: 300, defect: 5 },
            { name: "熱処理", sub: "熱処理 鈴木", status: "pending", input: 0, completed: 0, defect: 0 },
            { name: "仕上げ研ぎ", sub: "研ぎ工房 佐藤", status: "pending", input: 0, completed: 0, defect: 0 },
            { name: "柄付け", sub: "—", status: "pending", input: 0, completed: 0, defect: 0 },
        ],
    },
    {
        id: "2", lotNumber: "B12-098", product: "三徳 165mm", quantity: 300, status: "in_progress" as const,
        splitType: "split" as const, childLots: ["B12-098-A (150本)", "B12-098-B (150本)"],
        processes: [
            { name: "鍛造", sub: "鍛造所 田中", status: "completed", input: 300, completed: 295, defect: 5 },
            { name: "荒研ぎ", sub: "研ぎ工房 山本", status: "completed", input: 295, completed: 290, defect: 5 },
            { name: "熱処理", sub: "熱処理 鈴木", status: "in_progress", input: 290, completed: 200, defect: 2 },
            { name: "仕上げ研ぎ", sub: "—", status: "pending", input: 0, completed: 0, defect: 0 },
        ],
    },
    {
        id: "3", lotNumber: "C88-121", product: "ペティ 120mm", quantity: 1000, status: "created" as const,
        splitType: "none" as const, childLots: [],
        processes: [
            { name: "鍛造", sub: "—", status: "pending", input: 0, completed: 0, defect: 0 },
            { name: "荒研ぎ", sub: "—", status: "pending", input: 0, completed: 0, defect: 0 },
        ],
    },
];

const statusConfig = {
    created: { label: "未着手", color: "bg-slate-100 text-slate-600", icon: Clock },
    in_progress: { label: "進行中", color: "bg-blue-50 text-blue-700", icon: Loader2 },
    completed: { label: "完了", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
    rework: { label: "手直し", color: "bg-amber-50 text-amber-700", icon: RotateCcw },
    pending: { label: "待機", color: "bg-slate-50 text-slate-500", icon: Clock },
};

export default function LotsPage() {
    const [search, setSearch] = useState("");
    const [expandedLot, setExpandedLot] = useState<string | null>("1");

    return (
        <div className="flex flex-col space-y-4 animate-in fade-in duration-300">
            <header className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold">ロット・工程管理</h2>
                <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition">
                        <GitBranch size={14} /> 分割
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition">
                        <GitMerge size={14} /> 統合
                    </button>
                </div>
            </header>

            {/* Search + New */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="ロット番号・商品名で検索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                    />
                </div>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:scale-[1.02] transition-all">
                    <Plus size={16} /> 新規ロット
                </button>
            </div>

            {/* Lot Cards */}
            <div className="space-y-3">
                {LOTS.filter((l) => l.lotNumber.includes(search) || l.product.includes(search)).map((lot) => {
                    const expanded = expandedLot === lot.id;
                    const cfg = statusConfig[lot.status];
                    const completedSteps = lot.processes.filter((p) => p.status === "completed").length;
                    const progress = Math.round((completedSteps / lot.processes.length) * 100);

                    return (
                        <div key={lot.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
                            {/* Lot header */}
                            <button
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
                                onClick={() => setExpandedLot(expanded ? null : lot.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-sm font-bold text-blue-600">{lot.lotNumber}</span>
                                        <span className="text-xs text-slate-500">{lot.product} / {lot.quantity}本</span>
                                    </div>
                                    {lot.splitType === "split" && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 flex items-center gap-1">
                                            <GitBranch size={10} /> 分割済
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Progress bar mini */}
                                    <div className="hidden sm:flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium w-8">{progress}%</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                                    {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                </div>
                            </button>

                            {/* Expanded: process timeline */}
                            {expanded && (
                                <div className="border-t border-slate-100 px-4 pb-4 bg-slate-50/30">
                                    {lot.childLots.length > 0 && (
                                        <div className="mt-3 mb-2 flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                                            <GitBranch size={12} /> 子ロット: {lot.childLots.join(", ")}
                                        </div>
                                    )}
                                    <div className="mt-4 space-y-0 relative">
                                        {lot.processes.map((proc, idx) => {
                                            const pcfg = statusConfig[proc.status as keyof typeof statusConfig];
                                            const Icon = pcfg.icon;
                                            const isLast = idx === lot.processes.length - 1;
                                            return (
                                                <div key={idx} className="flex group">
                                                    {/* Timeline line */}
                                                    <div className="flex flex-col items-center mr-4">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm z-10 ${proc.status === "completed" ? "bg-emerald-500 text-white" : proc.status === "in_progress" ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-300"}`}>
                                                            <Icon size={14} />
                                                        </div>
                                                        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1 rounded-full group-hover:bg-blue-200 transition-colors" />}
                                                    </div>
                                                    {/* Content */}
                                                    <div className="flex-1 pb-6">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700">{proc.name}</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">{proc.sub}</p>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pcfg.color}`}>{pcfg.label}</span>
                                                        </div>
                                                        {proc.status !== "pending" && (
                                                            <div className="mt-2 flex gap-4 text-[10px] font-bold bg-white p-2 rounded-lg border border-slate-100 shadow-sm w-fit">
                                                                <span className="text-slate-400 uppercase tracking-tighter">投入: <span className="text-slate-800">{proc.input}</span></span>
                                                                <span className="text-slate-400 uppercase tracking-tighter">完了: <span className="text-emerald-600">{proc.completed}</span></span>
                                                                <span className="text-slate-400 uppercase tracking-tighter">不良: <span className={proc.defect > 0 ? "text-red-600" : "text-slate-300"}>{proc.defect}</span></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Action buttons */}
                                    <div className="flex gap-2 mt-2">
                                        <button className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                                            <RotateCcw size={16} /> 差戻し
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                            <CheckCircle2 size={16} /> 進捗報告
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
