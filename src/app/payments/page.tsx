"use client";

import React, { useState } from "react";
import {
    TrendingUp,
    ArrowLeft,
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    DollarSign,
    ChevronDown,
    ChevronRight,
    ShieldCheck,
    Send,
    Download,
    FileText,
    Filter,
    Menu,
    X,
    CreditCard,
} from "lucide-react";

/* ─── mock data ─── */
const PAYMENTS = [
    {
        id: "1", subcontractor: "鍛造所 田中", periodStart: "2026-02-01", periodEnd: "2026-02-28",
        status: "pending_approval" as const, totalAmount: 245000, submittedBy: "佐々木", submittedAt: "2026-02-25",
        items: [
            { lot: "A23-045", process: "鍛造", good: 490, unitPrice: 300, amount: 147000, override: false },
            { lot: "B12-098", process: "鍛造", good: 295, unitPrice: 300, amount: 88500, override: false },
            { lot: "D01-055", process: "鍛造", good: 30, unitPrice: 320, amount: 9600, override: true },
        ],
    },
    {
        id: "2", subcontractor: "研ぎ工房 山本", periodStart: "2026-02-01", periodEnd: "2026-02-28",
        status: "draft" as const, totalAmount: 156000, submittedBy: null, submittedAt: null,
        items: [
            { lot: "A23-045", process: "荒研ぎ", good: 300, unitPrice: 200, amount: 60000, override: false },
            { lot: "B12-098", process: "荒研ぎ", good: 290, unitPrice: 200, amount: 58000, override: false },
            { lot: "E44-012", process: "仕上げ研ぎ", good: 190, unitPrice: 200, amount: 38000, override: false },
        ],
    },
    {
        id: "3", subcontractor: "熱処理 鈴木", periodStart: "2026-01-01", periodEnd: "2026-01-31",
        status: "paid" as const, totalAmount: 180000, submittedBy: "佐々木", submittedAt: "2026-02-01",
        items: [
            { lot: "Z99-001", process: "熱処理", good: 600, unitPrice: 300, amount: 180000, override: false },
        ],
    },
];

const statusConfig = {
    draft: { label: "下書き", color: "bg-slate-100 text-slate-600", icon: Clock },
    pending_approval: { label: "承認待ち", color: "bg-amber-50 text-amber-700", icon: AlertCircle },
    approved: { label: "承認済", color: "bg-blue-50 text-blue-700", icon: ShieldCheck },
    paid: { label: "支払完了", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
};

export default function PaymentsPage() {
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [mobileMenu, setMobileMenu] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>("1");

    const exportAllToCSV = () => {
        const headers = ["外注先", "期間", "金額", "ステータス"];
        const rows = PAYMENTS.map(p => [
            p.subcontractor,
            `${p.periodStart}〜${p.periodEnd}`,
            p.totalAmount,
            statusConfig[p.status].label
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `支払一覧_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPaymentPDF = (id: string) => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex items-center justify-end gap-2 mb-6">
                <button
                    onClick={exportAllToCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                    <Download size={16} /> <span className="hidden xs:inline">出力</span>
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition">
                    <ShieldCheck size={16} /> <span className="hidden xs:inline">一括確定</span><span className="inline xs:hidden">確定</span>
                </button>
            </div>

            {/* Filters & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                <div className="lg:col-span-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="外注先名・請求番号で検索..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-100">
                            <FilterBtn active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>すべて</FilterBtn>
                            <FilterBtn active={filterStatus === "pending"} onClick={() => setFilterStatus("pending")}>未確定</FilterBtn>
                            <FilterBtn active={filterStatus === "waiting"} onClick={() => setFilterStatus("waiting")}>支払待ち</FilterBtn>
                            <FilterBtn active={filterStatus === "paid"} onClick={() => setFilterStatus("paid")}>完了</FilterBtn>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-600 p-4 rounded-xl shadow-lg shadow-blue-600/20 text-white flex flex-col justify-center">
                    <p className="text-xs text-blue-100">今月の支払総額</p>
                    <p className="text-2xl font-bold mt-1">¥428,500</p>
                </div>
            </div>

            {/* Payment cards */}
            <div className="space-y-3">
                {PAYMENTS.filter((p) => p.subcontractor.includes(searchTerm)).map((payment) => {
                    const expanded = expandedId === payment.id;
                    const cfg = statusConfig[payment.status];
                    const Icon = cfg.icon;
                    return (
                        <div key={payment.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <button className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition" onClick={() => setExpandedId(expanded ? null : payment.id)}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <DollarSign size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{payment.subcontractor}</p>
                                        <p className="text-xs text-slate-400">{payment.periodStart} 〜 {payment.periodEnd}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="text-lg font-bold">¥{payment.totalAmount.toLocaleString()}</p>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${cfg.color}`}><Icon size={10} />{cfg.label}</span>
                                    {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                </div>
                            </button>

                            {expanded && (
                                <div className="border-t border-slate-100 p-4 space-y-3">
                                    <p className="text-xs text-slate-400 font-medium mb-2">明細（良品検収払い: (完了数 - 不良数) × 単価）</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[800px]">
                                            <thead className="text-[10px] text-slate-400 uppercase">
                                                <tr>
                                                    <th className="text-left py-1.5">ロット</th>
                                                    <th className="text-left py-1.5">工程</th>
                                                    <th className="text-right py-1.5">良品数</th>
                                                    <th className="text-right py-1.5">単価</th>
                                                    <th className="text-right py-1.5">金額</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {payment.items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="py-2 font-mono text-xs text-blue-600 font-bold">{item.lot}</td>
                                                        <td className="py-2">{item.process}</td>
                                                        <td className="py-2 text-right">{item.good}</td>
                                                        <td className="py-2 text-right">
                                                            ¥{item.unitPrice.toLocaleString()}
                                                            {item.override && <span className="ml-1 px-1 py-0 rounded text-[8px] font-bold bg-amber-100 text-amber-700">特値</span>}
                                                        </td>
                                                        <td className="py-2 text-right font-bold">¥{item.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-slate-200">
                                                    <td colSpan={4} className="py-2 text-right text-xs font-bold text-slate-500">合計</td>
                                                    <td className="py-2 text-right text-base font-bold">¥{payment.totalAmount.toLocaleString()}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Approval flow */}
                                    {payment.status === "draft" && (
                                        <div className="flex gap-2 mt-2">
                                            <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                                                <Send size={14} /> 承認申請へ提出
                                            </button>
                                        </div>
                                    )}
                                    {payment.status === "pending_approval" && (
                                        <div className="space-y-2 mt-2">
                                            <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                <span>提出者: {payment.submittedBy}（{payment.submittedAt}）— 管理者の最終承認を待っています</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">差し戻し</button>
                                                <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition">
                                                    <ShieldCheck size={14} /> 最終承認＆支払実行
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {payment.status === "paid" && (
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                                                <CheckCircle2 size={14} />
                                                <span>支払完了済み</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); exportPaymentPDF(payment.id); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 transition"
                                            >
                                                <FileText size={14} /> PDF明細出力
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function FilterBtn({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`px-3 py-1 rounded text-xs font-medium transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {children}
        </button>
    )
}
