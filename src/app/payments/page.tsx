"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    DollarSign,
    ChevronDown,
    ChevronRight,
    ShieldCheck,
    Download,
    Loader2,
} from "lucide-react";
import { store, type MockPayment } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";

const statusConfig = {
    draft: { label: "下書き", color: "bg-slate-100 text-slate-600", icon: Clock },
    pending_approval: { label: "承認待ち", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
    approved: { label: "承認済み", color: "bg-blue-50 text-blue-700", icon: ShieldCheck },
    paid: { label: "支払済", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
};

export default function PaymentsPage() {
    const [payments, setPayments] = useState<MockPayment[]>([]);
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [approveId, setApproveId] = useState<string | null>(null);
    const [detailPayment, setDetailPayment] = useState<MockPayment | null>(null);

    const refreshData = useCallback(() => {
        setPayments([...store.payments]);
    }, []);

    useEffect(() => {
        refreshData();
        const unsub = store.subscribe(refreshData);
        return unsub;
    }, [refreshData]);

    const handleApprove = async () => {
        if (!approveId) return;
        store.approvePayment(approveId);
        showToast("success", "支払を承認しました");
        setApproveId(null);
    };

    const handleExportCSV = (payment: MockPayment) => {
        const headers = "ロット,工程,良品数,単価,金額,特値\n";
        const rows = payment.items.map(i => `${i.lot},${i.process},${i.good},${i.unitPrice},${i.amount},${i.override ? "○" : ""}`).join("\n");
        const csv = headers + rows;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payment_${payment.subcontractor}_${payment.periodEnd}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("success", "CSVをダウンロードしました");
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="外注先名で検索..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition" />
                </div>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["draft", "pending_approval", "approved", "paid"] as const).map(s => {
                    const cfg = statusConfig[s];
                    const count = payments.filter(p => p.status === s).length;
                    const total = payments.filter(p => p.status === s).reduce((sum, p) => sum + p.totalAmount, 0);
                    const Icon = cfg.icon;
                    return (
                        <div key={s} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className="w-4 h-4" />
                                <span className={`text-[10px] font-bold uppercase tracking-widest`}>{cfg.label}</span>
                            </div>
                            <p className="text-xl font-black text-slate-800">{count}<span className="text-xs text-slate-400 ml-1">件</span></p>
                            <p className="text-xs text-slate-400 font-bold">¥{total.toLocaleString()}</p>
                        </div>
                    );
                })}
            </div>

            {/* 支払カード一覧 */}
            <div className="space-y-3">
                {payments.filter(p => p.subcontractor.includes(search)).map(payment => {
                    const st = statusConfig[payment.status];
                    const SIcon = st.icon;
                    const isExpanded = expandedId === payment.id;

                    return (
                        <div key={payment.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 cursor-pointer hover:bg-slate-50/50 transition"
                                onClick={() => setExpandedId(isExpanded ? null : payment.id)}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-slate-800">{payment.subcontractor}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color} flex items-center gap-1`}>
                                                <SIcon size={10} />{st.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400">{payment.periodStart} 〜 {payment.periodEnd}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-xl font-black text-slate-800">¥{payment.totalAmount.toLocaleString()}</p>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="border-t border-slate-100 p-4 bg-slate-50/30 space-y-3 animate-in fade-in duration-200">
                                    <table className="w-full text-xs">
                                        <thead className="text-[9px] text-slate-400 uppercase tracking-widest">
                                            <tr><th className="text-left pb-2">ロット</th><th className="text-left pb-2">工程</th><th className="text-right pb-2">良品数</th><th className="text-right pb-2">単価</th><th className="text-right pb-2">金額</th><th className="text-center pb-2">特値</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payment.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="py-2 font-mono font-bold text-blue-600">{item.lot}</td>
                                                    <td className="py-2 text-slate-600">{item.process}</td>
                                                    <td className="py-2 text-right font-bold">{item.good}</td>
                                                    <td className="py-2 text-right text-slate-500">¥{item.unitPrice.toLocaleString()}</td>
                                                    <td className="py-2 text-right font-bold">¥{item.amount.toLocaleString()}</td>
                                                    <td className="py-2 text-center">{item.override ? <span className="text-amber-600 font-bold">⚡</span> : ""}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="flex gap-2 pt-2">
                                        {payment.status === "pending_approval" && (
                                            <button onClick={() => setApproveId(payment.id)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
                                                <ShieldCheck size={14} /> 承認する
                                            </button>
                                        )}
                                        <button onClick={() => handleExportCSV(payment)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all">
                                            <Download size={14} /> CSV出力
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog open={!!approveId} onClose={() => setApproveId(null)} onConfirm={handleApprove}
                title="支払を承認しますか？" message="承認後は支払処理に進みます。明細内容を確認してから承認してください。" confirmLabel="承認する" />
        </div>
    );
}
