"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, Loader2, ArrowUpDown, ArrowDown, ArrowUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useSupabaseData } from "@/lib/useSupabaseData";

type SortKey = "lotNumber" | "productName" | "lastCompletionDate" | "totalPayment";
type SortDir = "asc" | "desc";

interface ProcessSchedule {
    processName: string;
    sortOrder: number;
    estimatedStartDate: string;
    estimatedEndDate: string;
    avgDaysPerUnit: number;
    unitPrice: number;
    payment: number;
    dataCount: number; // 直近何件の実績から算出したか
}

interface LotSchedule {
    lotId: string;
    lotNumber: string;
    productName: string;
    productId: string;
    quantity: number;
    createdAt: string;
    processes: ProcessSchedule[];
    lastCompletionDate: string;
    totalPayment: number;
    hasData: boolean; // 実績データが存在するか
}

export default function SchedulePage() {
    const { lots, processes, processRates, loading, profile } = useSupabaseData();
    const router = useRouter();

    const [sortKey, setSortKey] = useState<SortKey>("lastCompletionDate");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // 閲覧権限がない場合はアクセスブロック
    useEffect(() => {
        if (!loading && profile && profile.role !== 'admin' && profile.permissions?.schedule?.view === false) {
            router.replace("/");
        }
    }, [loading, profile, router]);

    if (!loading && profile && profile.role !== 'admin' && profile.permissions?.schedule?.view === false) {
        return null;
    }

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir(key === "lastCompletionDate" ? "asc" : "desc"); }
    };

    // ━━━━━━━━━━━━ 商品×工程ごとの平均リードタイム算出(直近5件) ━━━━━━━━━━━━
    const avgLeadTimes = useMemo(() => {
        // key: `${product_id}__${process_id}` => { totalDays, totalQty, count, records[] }
        const map = new Map<string, { records: { daysPerUnit: number }[] }>();

        lots.forEach((lot: any) => {
            const productId = lot.product_id;
            (lot.lot_processes || []).forEach((lp: any) => {
                if (!lp.process_id) return;
                const deliveries = lp.lot_process_deliveries || [];
                deliveries.forEach((d: any) => {
                    if (!d.delivery_date || !d.completion_date || d.qty <= 0) return;
                    const start = new Date(d.delivery_date);
                    const end = new Date(d.completion_date);
                    const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const daysPerUnit = days / d.qty;

                    const key = `${productId}__${lp.process_id}`;
                    if (!map.has(key)) map.set(key, { records: [] });
                    map.get(key)!.records.push({ daysPerUnit });
                });
            });
        });

        // 直近5件のみ使用
        const result = new Map<string, { avgDaysPerUnit: number; dataCount: number }>();
        map.forEach((val, key) => {
            const recent = val.records.slice(-5);
            const avg = recent.reduce((s, r) => s + r.daysPerUnit, 0) / recent.length;
            result.set(key, { avgDaysPerUnit: avg, dataCount: recent.length });
        });
        return result;
    }, [lots]);

    // ━━━━━━━━━━━━ ロットごとのスケジュール予測 ━━━━━━━━━━━━
    const schedules = useMemo<LotSchedule[]>(() => {
        return lots
            .filter((lot: any) => lot.status !== "completed" && lot.status !== "cancelled")
            .map((lot: any) => {
                const productId = lot.product_id;
                const productName = lot.products?.name || "不明";
                const quantity = lot.quantity || 0;
                const createdAt = lot.created_at ? lot.created_at.split("T")[0] : new Date().toISOString().split("T")[0];

                // この商品のメイン工程テンプレート(group_index=0)をsort_order順に取得
                const templates = processes
                    .filter((p: any) => p.product_id === productId && (p.group_index || 0) === 0)
                    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

                let currentDate = createdAt;
                let hasData = false;
                const processSchedules: ProcessSchedule[] = [];

                templates.forEach((tmpl: any) => {
                    const key = `${productId}__${tmpl.id}`;
                    const leadTime = avgLeadTimes.get(key);

                    // 登録単価を取得(process_subcontractor_ratesから最初に見つかった単価)
                    const rate = processRates.find((r: any) => r.process_id === tmpl.id);
                    const unitPrice = rate?.unit_price || 0;

                    let avgDays: number;
                    let dataCount = 0;
                    if (leadTime) {
                        avgDays = leadTime.avgDaysPerUnit;
                        dataCount = leadTime.dataCount;
                        hasData = true;
                    } else {
                        // 実績データなし → デフォルト: 1本あたり0.5日（仮値）
                        avgDays = 0.5;
                    }

                    const totalDays = Math.max(1, Math.ceil(avgDays * quantity));
                    const startDate = currentDate;

                    // 完了予定日を計算（土日考慮なし）
                    const endDt = new Date(startDate);
                    endDt.setDate(endDt.getDate() + totalDays);
                    const endDate = endDt.toISOString().split("T")[0];

                    processSchedules.push({
                        processName: tmpl.name,
                        sortOrder: tmpl.sort_order || 0,
                        estimatedStartDate: startDate,
                        estimatedEndDate: endDate,
                        avgDaysPerUnit: avgDays,
                        unitPrice,
                        payment: quantity * unitPrice,
                        dataCount,
                    });

                    // 次の工程の開始日 = この工程の完了日
                    currentDate = endDate;
                });

                const lastDate = processSchedules.length > 0
                    ? processSchedules[processSchedules.length - 1].estimatedEndDate
                    : createdAt;

                const totalPayment = processSchedules.reduce((s, p) => s + p.payment, 0);

                return {
                    lotId: lot.id,
                    lotNumber: lot.lot_number,
                    productName,
                    productId,
                    quantity,
                    createdAt,
                    processes: processSchedules,
                    lastCompletionDate: lastDate,
                    totalPayment,
                    hasData,
                };
            });
    }, [lots, processes, processRates, avgLeadTimes]);

    // ソート
    const sorted = useMemo(() => {
        const data = [...schedules];
        data.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "lotNumber": aVal = a.lotNumber; bVal = b.lotNumber; break;
                case "productName": aVal = a.productName; bVal = b.productName; break;
                case "lastCompletionDate": aVal = a.lastCompletionDate; bVal = b.lastCompletionDate; break;
                case "totalPayment": aVal = a.totalPayment; bVal = b.totalPayment; break;
                default: aVal = a.lastCompletionDate; bVal = b.lastCompletionDate;
            }
            if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        });
        return data;
    }, [schedules, sortKey, sortDir]);

    // CSV出力
    const handleExportCSV = () => {
        const rows: string[] = [];
        const headers = ["ロット番号", "商品名", "数量", "工程名", "搬入目安日", "完了目安日", "単価", "支払予定額", "実績件数"];
        rows.push(headers.join(","));

        sorted.forEach(lot => {
            lot.processes.forEach(p => {
                rows.push(
                    [lot.lotNumber, lot.productName, lot.quantity, p.processName, p.estimatedStartDate, p.estimatedEndDate, p.unitPrice, p.payment, p.dataCount > 0 ? `直近${p.dataCount}件` : "仮値"]
                        .map(v => `"${v}"`)
                        .join(",")
                );
            });
        });

        const csvContent = rows.join("\n");
        const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schedule_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("success", "CSVをダウンロードしました");
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 inline ml-1" />;
        return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-500 inline ml-1" /> : <ArrowDown className="w-3 h-3 text-blue-500 inline ml-1" />;
    };

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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl shadow-lg flex items-center justify-center">
                        <CalendarClock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800">日程予測</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Schedule Forecast</p>
                    </div>
                </div>
                <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">
                    <Download size={14} /> CSV出力
                </button>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniCard label="対象ロット" value={`${sorted.length}件`} />
                <MiniCard label="実績あり" value={`${sorted.filter(s => s.hasData).length}件`} />
                <MiniCard label="支払予定合計" value={`¥${sorted.reduce((s, l) => s + l.totalPayment, 0).toLocaleString()}`} />
                <MiniCard label="最遠完了予定" value={sorted.length > 0 ? sorted.reduce((max, l) => l.lastCompletionDate > max ? l.lastCompletionDate : max, "0000-00-00") : "-"} />
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("lotNumber")}>
                                    ロット<SortIcon col="lotNumber" />
                                </th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("productName")}>
                                    商品<SortIcon col="productName" />
                                </th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">数量</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">工程スケジュール</th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalPayment")}>
                                    支払予定額<SortIcon col="totalPayment" />
                                </th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("lastCompletionDate")}>
                                    完了目安日<SortIcon col="lastCompletionDate" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-slate-300 font-bold">
                                        進行中のロットがありません
                                    </td>
                                </tr>
                            )}
                            {sorted.map((lot) => (
                                <tr key={lot.lotId} className="hover:bg-slate-50/50 transition align-top">
                                    <td className="px-4 py-3">
                                        <span className="font-mono text-xs font-bold text-blue-600">{lot.lotNumber}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold text-slate-700">{lot.productName}</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            {lot.hasData ? (
                                                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />実績ベース</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />仮値</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">{lot.quantity.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1">
                                            {lot.processes.map((p, i) => (
                                                <div key={i} className="flex items-center gap-2 text-[11px]">
                                                    <span className="w-20 shrink-0 font-bold text-slate-600 truncate" title={p.processName}>{p.processName}</span>
                                                    <span className="text-slate-400">{p.estimatedStartDate}</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="text-slate-700 font-bold">{p.estimatedEndDate}</span>
                                                    <span className="text-[9px] text-slate-300 ml-1">
                                                        (¥{p.payment.toLocaleString()})
                                                    </span>
                                                    {p.dataCount > 0 && (
                                                        <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 rounded font-bold">
                                                            {p.dataCount}件
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {lot.processes.length === 0 && (
                                                <span className="text-[10px] text-slate-300 italic">工程マスタ未登録</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-700">¥{lot.totalPayment.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-black text-slate-800">{lot.lastCompletionDate}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 凡例 */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs text-slate-400 font-bold">📊 日程予測の計算方法</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <span className="font-black text-slate-700">所要日数</span>: 直近5件の「(完了日−納入日)÷本数」の平均 × 受注本数
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <span className="font-black text-slate-700">支払予定額</span>: 受注本数 × 登録単価（工程ごと）
                    </div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> 実績ベース: 過去の実績データから算出</span>
                    <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3 h-3" /> 仮値: 実績がないため仮の値 (0.5日/本) で計算</span>
                </div>
            </div>
        </div>
    );
}

function MiniCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-lg font-black text-slate-700">{value}</p>
        </div>
    );
}
