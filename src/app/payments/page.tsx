"use client";

import React, { useState, useMemo } from "react";
import { CheckCircle2, Clock, AlertCircle, ShieldCheck, Download, Edit2, X, Check, Undo2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSupabaseData } from "@/lib/useSupabaseData";
import { advancePayment, revertPayment, updatePaymentItem } from "@/lib/services/paymentService";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    wip: { label: "仕掛中", color: "bg-slate-100 text-slate-600", icon: Clock },
    pre_payment: { label: "支払前", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
    paid: { label: "支払済", color: "bg-blue-50 text-blue-700", icon: ShieldCheck },
    confirmed: { label: "支払確認済", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
};

type StatusFilter = "wip" | "pre_payment" | "paid" | "confirmed";

export default function PaymentsPage() {
    const { paymentItems, loading, refresh } = useSupabaseData();
    const [actionLoading, setActionLoading] = useState(false);

    // Map Supabase objects to flat list for UI
    const lines = useMemo(() => {
        return paymentItems.map((pi: any) => ({
            id: pi.id,
            paymentId: pi.payment_id,
            lotNumber: pi.lot_processes?.lots?.lot_number || "不明",
            processName: pi.lot_processes?.processes?.name || "不明",
            subcontractor: pi.payments?.subcontractors?.name || "不明",
            qty: pi.good_quantity,
            unitPrice: pi.unit_price,
            unitPriceOverride: pi.lot_processes?.unit_price_override || null,
            amount: pi.amount,
            completionDate: pi.created_at.split('T')[0],
            status: (pi.payments?.status as any) || "wip"
        }));
    }, [paymentItems]);

    const [statusFilters, setStatusFilters] = useState<StatusFilter[]>(["wip", "pre_payment", "paid"]);
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
    const [dateTo, setDateTo] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().split("T")[0]; });
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [confirmAction, setConfirmAction] = useState<{ id: string; paymentId: string; type: "advance" | "revert" } | null>(null);
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

    const toggleFilter = (f: StatusFilter) => setStatusFilters(prev => prev.includes(f) ? prev.filter((x: any) => x !== f) : [...prev, f]);

    // 範囲フィルタ適用
    const filtered = useMemo(() => {
        let res = lines;
        if (dateFrom) res = res.filter((pl: any) => pl.completionDate >= dateFrom);
        if (dateTo) res = res.filter((pl: any) => pl.completionDate <= dateTo);
        if (statusFilters.length > 0) res = res.filter((pl: any) => statusFilters.includes(pl.status));
        return res;
    }, [lines, dateFrom, dateTo, statusFilters]);

    // サマリー計算 (フィルタ適用前ではなくFilteredに対して行うか、全体か？要件によるがFilteredで計算する)
    const summary = useMemo(() => {
        const s = { wip: { count: 0, total: 0 }, pre_payment: { count: 0, total: 0 }, paid: { count: 0, total: 0 }, confirmed: { count: 0, total: 0 } };
        filtered.forEach((pl: any) => {
            if (s[pl.status as keyof typeof s]) {
                s[pl.status as keyof typeof s].count += 1;
                s[pl.status as keyof typeof s].total += pl.amount;
            }
        });
        return s;
    }, [filtered]);

    // 外注先グループ
    const groupedBySub = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filtered.forEach((pl: any) => {
            if (!groups[pl.subcontractor]) groups[pl.subcontractor] = [];
            groups[pl.subcontractor].push(pl);
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filtered]);

    // 初期展開
    useEffect(() => { setExpandedSubs(new Set(groupedBySub.map(([sub]) => sub))); }, [groupedBySub]);

    const toggleSub = (sub: string) => {
        setExpandedSubs(prev => { const n = new Set(prev); if (n.has(sub)) n.delete(sub); else n.add(sub); return n; });
    };

    const handleAdvance = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            await advancePayment(confirmAction.paymentId);
            showToast("success", "ステータスを進めました");
            setConfirmAction(null);
            refresh();
        } catch (e: any) {
            showToast("error", "エラーが発生しました");
        } finally {
            setActionLoading(false);
        }
    };
    const handleRevert = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            await revertPayment(confirmAction.paymentId);
            showToast("warning", "ステータスを取り消しました");
            setConfirmAction(null);
            refresh();
        } catch (e: any) {
            showToast("error", "エラーが発生しました");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveEdit = async (id: string, paymentId: string) => {
        setActionLoading(true);
        try {
            await updatePaymentItem(id, paymentId, Number(editQty), editPrice ? Number(editPrice) : null);
            showToast("success", "支払情報を更新しました");
            setEditId(null);
            refresh();
        } catch (e: any) {
            showToast("error", "エラーが発生しました");
        } finally {
            setActionLoading(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ["外注先", "ロット番号", "工程", "数量", "単価", "金額", "完了日", "状態"];
        const rows = filtered.map((pl: any) =>
            [pl.subcontractor, pl.lotNumber, pl.processName, pl.qty, pl.unitPriceOverride !== null ? pl.unitPriceOverride : pl.unitPrice, pl.amount, pl.completionDate, statusConfig[pl.status]?.label || ""]
                .map(v => `"${v}"`)
                .join(",")
        ); const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `payments_${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url);
        showToast("success", "CSVをダウンロードしました");
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300 relative">
            {(loading || actionLoading) && (
                <div className="fixed inset-0 bg-slate-50/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            )}
            {/* サマリー (範囲連動) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(statusConfig) as StatusFilter[]).map(s => {
                    const cfg = statusConfig[s];
                    const Icon = cfg.icon;
                    const isActive = statusFilters.includes(s);
                    return (
                        <button key={s} onClick={() => toggleFilter(s)}
                            className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all ${isActive ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200 opacity-50"}`}>
                            <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-widest">{cfg.label}</span></div>
                            <p className="text-xl font-black text-slate-800">{summary[s].count}<span className="text-xs text-slate-400 ml-1">件</span></p>
                            <p className="text-xs text-slate-400 font-bold">¥{summary[s].total.toLocaleString()}</p>
                        </button>
                    );
                })}
            </div>

            {/* フィルタ (検索窓なし) */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">完了日:</span>
                    <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    <span className="text-slate-400">〜</span>
                    <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                </div>
                <button onClick={handleExportCSV} className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">
                    <Download size={14} /> CSV出力
                </button>
            </div>

            {/* 外注先グループ表示 */}
            {groupedBySub.map(([sub, items]) => {
                const isOpen = expandedSubs.has(sub);
                const subTotal = items.reduce((s, pl) => s + pl.amount, 0);
                return (
                    <div key={sub} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <button onClick={() => toggleSub(sub)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition">
                            <div className="flex items-center gap-3">
                                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                <span className="font-bold text-slate-700">{sub}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{items.length}件</span>
                            </div>
                            <span className="text-sm font-black text-slate-600">¥{subTotal.toLocaleString()}</span>
                        </button>
                        {isOpen && (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                    <tr>
                                        <th className="px-4 py-2 text-left">ロット</th>
                                        <th className="px-4 py-2 text-left">工程</th>
                                        <th className="px-4 py-2 text-right">数量</th>
                                        <th className="px-4 py-2 text-right">単価</th>
                                        <th className="px-4 py-2 text-right">金額</th>
                                        <th className="px-4 py-2 text-left">完了日</th>
                                        <th className="px-4 py-2 text-center">状態</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/60">
                                    {items.map((pl: any) => {
                                        const st = statusConfig[pl.status];
                                        const isEditing = editId === pl.id;
                                        const canEdit = pl.status === "wip" || pl.status === "pre_payment";
                                        return (
                                            <tr key={pl.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-4 py-2 font-mono text-xs font-bold text-blue-600">{pl.lotNumber}</td>
                                                <td className="px-4 py-2 text-slate-600">{pl.processName}</td>
                                                <td className="px-4 py-2 text-right">
                                                    {isEditing ? <input type="number" value={editQty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditQty(e.target.value)} className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" /> : <span className="font-bold">{pl.qty}</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {isEditing ? <input type="number" value={editPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPrice(e.target.value)} placeholder={String(pl.unitPrice)} className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" /> : <span className={pl.unitPriceOverride !== null ? "text-amber-600 font-bold" : "text-slate-500"}>¥{(pl.unitPriceOverride !== null ? pl.unitPriceOverride : pl.unitPrice).toLocaleString()}</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold">¥{pl.amount.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-xs text-slate-400">{pl.completionDate}</td>
                                                <td className="px-4 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span></td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {isEditing ? (
                                                            <>
                                                                <button onClick={() => handleSaveEdit(pl.id, pl.paymentId)} className="p-1 bg-blue-600 text-white rounded text-xs"><Check size={12} /></button>
                                                                <button onClick={() => setEditId(null)} className="p-1 bg-slate-200 rounded text-xs"><X size={12} /></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {canEdit && <button onClick={() => { setEditId(pl.id); setEditQty(String(pl.qty)); setEditPrice(pl.unitPriceOverride !== null ? String(pl.unitPriceOverride) : ""); }} title="編集" className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>}
                                                                {(pl.status === "wip" || pl.status === "pre_payment") && <button onClick={() => setConfirmAction({ id: pl.id, paymentId: pl.paymentId, type: "advance" })} title={pl.status === "wip" ? "完了(支払前)へ" : "支払済へ"} className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"><CheckCircle2 size={14} /></button>}
                                                                {pl.status === "paid" && <button onClick={() => setConfirmAction({ id: pl.id, paymentId: pl.paymentId, type: "advance" })} title="確認済へ" className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"><ShieldCheck size={14} /></button>}
                                                                {(pl.status === "pre_payment" || pl.status === "paid" || pl.status === "confirmed") && <button onClick={() => setConfirmAction({ id: pl.id, paymentId: pl.paymentId, type: "revert" })} title="取消" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Undo2 size={14} /></button>}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                );
            })}
            {groupedBySub.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">該当データなし</p></div>}

            <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)}
                onConfirm={confirmAction?.type === "advance" ? handleAdvance : handleRevert}
                title={confirmAction?.type === "advance" ? "ステータスを進めますか？" : "ステータスを取り消しますか？"}
                message={confirmAction?.type === "advance" ? "次のステータスへ進めます。" : "前のステータスに戻します。"}
                confirmLabel={confirmAction?.type === "advance" ? "進める" : "取り消す"}
                danger={confirmAction?.type === "revert"} />
        </div>
    );
}
