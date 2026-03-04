"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle2, Clock, AlertCircle, ShieldCheck, ChevronDown, ChevronRight, Download, Loader2, Edit2, X, Check, Undo2 } from "lucide-react";
import { store, type PaymentLine } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const statusConfig = {
    wip: { label: "仕掛中", color: "bg-slate-100 text-slate-600", icon: Clock },
    pre_payment: { label: "支払前", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
    paid: { label: "支払済", color: "bg-blue-50 text-blue-700", icon: ShieldCheck },
    confirmed: { label: "支払確認済", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
};

type StatusFilter = "wip" | "pre_payment" | "paid" | "confirmed";

export default function PaymentsPage() {
    const [lines, setLines] = useState<PaymentLine[]>([]);
    const [statusFilters, setStatusFilters] = useState<StatusFilter[]>(["wip", "pre_payment", "paid"]);
    const [productFilter, setProductFilter] = useState("");
    const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
    const [dateTo, setDateTo] = useState("");
    const [editId, setEditId] = useState<string | null>(null);
    const [editQty, setEditQty] = useState("");
    const [editPrice, setEditPrice] = useState("");
    const [confirmAction, setConfirmAction] = useState<{ id: string; type: "advance" | "revert" } | null>(null);

    const refresh = useCallback(() => setLines([...store.paymentLines]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const toggleFilter = (f: StatusFilter) => {
        setStatusFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
    };

    const filtered = useMemo(() => {
        return lines.filter(pl => {
            if (!statusFilters.includes(pl.status)) return false;
            if (productFilter) {
                const lot = store.lots.find(l => l.lotNumber === pl.lotNumber);
                if (lot && !lot.product.includes(productFilter)) return false;
            }
            if (dateFrom && pl.completionDate && pl.completionDate < dateFrom) return false;
            if (dateTo && pl.completionDate && pl.completionDate > dateTo) return false;
            return true;
        });
    }, [lines, statusFilters, productFilter, dateFrom, dateTo]);

    // 集計
    const summary = useMemo(() => {
        const s: Record<string, { count: number; total: number }> = { wip: { count: 0, total: 0 }, pre_payment: { count: 0, total: 0 }, paid: { count: 0, total: 0 }, confirmed: { count: 0, total: 0 } };
        lines.forEach(pl => { s[pl.status].count++; s[pl.status].total += pl.amount; });
        return s;
    }, [lines]);

    const handleAdvance = () => {
        if (!confirmAction) return;
        store.advancePayment(confirmAction.id);
        showToast("success", "ステータスを進めました");
        setConfirmAction(null);
    };

    const handleRevert = () => {
        if (!confirmAction) return;
        store.revertPayment(confirmAction.id);
        showToast("warning", "ステータスを取り消しました");
        setConfirmAction(null);
    };

    const handleSaveEdit = (id: string) => {
        store.updatePaymentLine(id, Number(editQty), editPrice ? Number(editPrice) : null);
        showToast("success", "支払情報を更新しました");
        setEditId(null);
    };

    const handleExportCSV = () => {
        const headers = "ロット,工程,外注先,数量,単価,特値,金額,完了日,ステータス\n";
        const rows = filtered.map(pl => `${pl.lotNumber},${pl.processName},${pl.subcontractor},${pl.qty},${pl.unitPrice},${pl.unitPriceOverride || ""},${pl.amount},${pl.completionDate},${statusConfig[pl.status].label}`).join("\n");
        const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `payments_${new Date().toISOString().split("T")[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
        showToast("success", "CSVをダウンロードしました");
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* サマリー */}
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

            {/* フィルタ */}
            <div className="flex flex-wrap items-center gap-3">
                <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white">
                    <option value="">全製品</option>
                    {store.products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">完了日:</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    <span className="text-slate-400">〜</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                </div>
                <button onClick={handleExportCSV} className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">
                    <Download size={14} /> CSV出力
                </button>
            </div>

            {/* 支払一覧 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        <tr>
                            <th className="px-4 py-3 text-left">ロット</th>
                            <th className="px-4 py-3 text-left">工程</th>
                            <th className="px-4 py-3 text-left">外注先</th>
                            <th className="px-4 py-3 text-right">数量</th>
                            <th className="px-4 py-3 text-right">単価</th>
                            <th className="px-4 py-3 text-right">金額</th>
                            <th className="px-4 py-3 text-left">完了日</th>
                            <th className="px-4 py-3 text-center">状態</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/60">
                        {filtered.map(pl => {
                            const st = statusConfig[pl.status];
                            const isEditing = editId === pl.id;
                            const canEdit = pl.status === "wip" || pl.status === "pre_payment";

                            return (
                                <tr key={pl.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{pl.lotNumber}</td>
                                    <td className="px-4 py-3 text-slate-600">{pl.processName}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{pl.subcontractor}</td>
                                    <td className="px-4 py-3 text-right">
                                        {isEditing ? <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" />
                                            : <span className="font-bold">{pl.qty}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isEditing ? <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder={String(pl.unitPrice)} className="w-16 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" />
                                            : <span className={pl.unitPriceOverride ? "text-amber-600 font-bold" : "text-slate-500"}>¥{(pl.unitPriceOverride || pl.unitPrice).toLocaleString()}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">¥{pl.amount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{pl.completionDate}</td>
                                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${st.color}`}>{st.label}</span></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={() => handleSaveEdit(pl.id)} className="p-1 bg-blue-600 text-white rounded text-xs"><Check size={12} /></button>
                                                    <button onClick={() => setEditId(null)} className="p-1 bg-slate-200 rounded text-xs"><X size={12} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    {canEdit && <button onClick={() => { setEditId(pl.id); setEditQty(String(pl.qty)); setEditPrice(pl.unitPriceOverride ? String(pl.unitPriceOverride) : ""); }} title="編集" className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>}
                                                    {pl.status === "pre_payment" && <button onClick={() => setConfirmAction({ id: pl.id, type: "advance" })} title="支払済へ" className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"><CheckCircle2 size={14} /></button>}
                                                    {pl.status === "paid" && <button onClick={() => setConfirmAction({ id: pl.id, type: "advance" })} title="確認済へ" className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"><ShieldCheck size={14} /></button>}
                                                    {(pl.status === "paid" || pl.status === "confirmed") && <button onClick={() => setConfirmAction({ id: pl.id, type: "revert" })} title="取消" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Undo2 size={14} /></button>}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">該当データなし</td></tr>}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog open={!!confirmAction} onClose={() => setConfirmAction(null)}
                onConfirm={confirmAction?.type === "advance" ? handleAdvance : handleRevert}
                title={confirmAction?.type === "advance" ? "ステータスを進めますか？" : "ステータスを取り消しますか？"}
                message={confirmAction?.type === "advance" ? "次のステータスへ進めます。" : "前のステータスに戻します。"}
                confirmLabel={confirmAction?.type === "advance" ? "進める" : "取り消す"}
                danger={confirmAction?.type === "revert"} />
        </div>
    );
}
