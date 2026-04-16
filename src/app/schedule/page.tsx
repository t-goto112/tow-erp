"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, Loader2, ArrowUpDown, ArrowDown, ArrowUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { useSupabaseData } from "@/lib/useSupabaseData";

type SortKey = "lotNumber" | "productName" | "totalPayment";
type SortDir = "asc" | "desc";

interface ProcessSchedule {
    processName: string;
    sortOrder: number;
    estimatedStartDate: string;
    estimatedEndDate: string;
    avgDaysPerUnit: number;
    unitPrice: number;
    payment: number;
    canCalculate: boolean;
}

interface LotSchedule {
    lotId: string;
    lotNumber: string;
    productName: string;
    productId: string;
    quantity: number;
    createdAt: string;
    processes: ProcessSchedule[];
    totalPayment: number;
    canCalculate: boolean;
}

export default function SchedulePage() {
    const { lots, orders, processes, processRates, loading, profile } = useSupabaseData();
    const router = useRouter();

    const [sortKey, setSortKey] = useState<SortKey>("lotNumber");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // 閲覧権限チェック
    useEffect(() => {
        if (!loading && profile && profile.role !== 'admin' && (profile.permissions as any)?.schedule?.view === false) {
            router.replace("/");
        }
    }, [loading, profile, router]);

    if (!loading && profile && profile.role !== 'admin' && (profile.permissions as any)?.schedule?.view === false) {
        return null;
    }

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    // ━━━ 商品×工程ごとの平均リードタイム算出(直近5件、あるだけ使う) ━━━
    const avgLeadTimes = useMemo(() => {
        const map = new Map<string, { records: number[] }>();

        lots.forEach((lot: any) => {
            const productId = lot.product_id;
            (lot.lot_processes || []).forEach((lp: any) => {
                if (!lp.process_id) return;
                (lp.lot_process_deliveries || []).forEach((d: any) => {
                    if (!d.delivery_date || !d.completion_date || d.qty <= 0) return;
                    const start = new Date(d.delivery_date);
                    const end = new Date(d.completion_date);
                    const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const daysPerUnit = days / d.qty;

                    const key = `${productId}__${lp.process_id}`;
                    if (!map.has(key)) map.set(key, { records: [] });
                    map.get(key)!.records.push(daysPerUnit);
                });
            });
        });

        const result = new Map<string, { avgDaysPerUnit: number; dataCount: number }>();
        map.forEach((val, key) => {
            const recent = val.records.slice(-5); // 直近5件(5件未満ならあるだけ)
            const avg = recent.reduce((s, r) => s + r, 0) / recent.length;
            result.set(key, { avgDaysPerUnit: avg, dataCount: recent.length });
        });
        return result;
    }, [lots]);

    // ━━━ ロットごとのスケジュール予測 ━━━
    const schedules = useMemo<LotSchedule[]>(() => {
        // order_itemsからquantityを取得するためのマップ
        const orderItemMap = new Map<string, number>();
        orders.forEach((o: any) => {
            (o.order_items || []).forEach((oi: any) => {
                orderItemMap.set(oi.id, oi.quantity || 0);
            });
        });

        return lots
            .filter((lot: any) => lot.status !== "completed" && lot.status !== "cancelled")
            .map((lot: any) => {
                const productId = lot.product_id;
                const productName = lot.products?.name || "不明";
                // quantity: 全て新規受注登録(order_items)での数字を参照させる
                const orderItemQty = lot.order_item_id ? (orderItemMap.get(lot.order_item_id) || 0) : 0;
                const quantity = orderItemQty;
                const createdAt = lot.created_at ? lot.created_at.split("T")[0] : new Date().toISOString().split("T")[0];

                // 全工程テンプレートをgroup_index順、sort_order順に取得
                const templates = processes
                    .filter((p: any) => p.product_id === productId)
                    .sort((a: any, b: any) => {
                        if ((a.group_index || 0) !== (b.group_index || 0)) return (a.group_index || 0) - (b.group_index || 0);
                        return (a.sort_order || 0) - (b.sort_order || 0);
                    });

                let currentGroupIndex = -1;
                let currentDate = createdAt;
                let canCalculateAll = true;
                const processSchedules: ProcessSchedule[] = [];

                templates.forEach((tmpl: any) => {
                    const groupIndex = tmpl.group_index || 0;
                    if (currentGroupIndex !== groupIndex) {
                        currentGroupIndex = groupIndex;
                        currentDate = createdAt; // 各グループ(メイン/パーツ)の起点を受注登録日にリセット
                    }
                    const key = `${productId}__${tmpl.id}`;
                    const leadTime = avgLeadTimes.get(key);

                    // 単価: この工程の登録単価のうち最も高いものを採用
                    const rates = processRates.filter((r: any) => r.process_id === tmpl.id);
                    const unitPrice = rates.length > 0
                        ? Math.max(...rates.map((r: any) => r.unit_price || 0))
                        : 0;

                    if (!leadTime) {
                        // 実績0件 → 算出不可
                        canCalculateAll = false;
                        processSchedules.push({
                            processName: tmpl.name,
                            sortOrder: tmpl.sort_order || 0,
                            estimatedStartDate: currentDate,
                            estimatedEndDate: "",
                            avgDaysPerUnit: 0,
                            unitPrice,
                            payment: quantity * unitPrice,
                            canCalculate: false,
                        });
                        return; // 次工程の開始日は不明のまま
                    }

                    const totalDays = Math.max(1, Math.ceil(leadTime.avgDaysPerUnit * quantity));
                    const startDate = currentDate;
                    const endDt = new Date(startDate);
                    endDt.setDate(endDt.getDate() + totalDays);
                    const endDate = endDt.toISOString().split("T")[0];

                    processSchedules.push({
                        processName: tmpl.name,
                        sortOrder: tmpl.sort_order || 0,
                        estimatedStartDate: startDate,
                        estimatedEndDate: endDate,
                        avgDaysPerUnit: leadTime.avgDaysPerUnit,
                        unitPrice,
                        payment: quantity * unitPrice,
                        canCalculate: true,
                    });

                    currentDate = endDate;
                });

                const totalPayment = processSchedules.reduce((s, p) => s + p.payment, 0);

                return {
                    lotId: lot.id,
                    lotNumber: lot.lot_number,
                    productName,
                    productId,
                    quantity,
                    createdAt,
                    processes: processSchedules,
                    totalPayment,
                    canCalculate: canCalculateAll && processSchedules.length > 0,
                };
            });
    }, [lots, orders, processes, processRates, avgLeadTimes]);

    // 日付フィルタ（工程の完了目安日に基づく）
    const filtered = useMemo(() => {
        if (!dateFrom && !dateTo) return schedules;
        return schedules.filter(lot =>
            lot.processes.some(p => {
                if (!p.estimatedEndDate) return false;
                if (dateFrom && p.estimatedEndDate < dateFrom) return false;
                if (dateTo && p.estimatedEndDate > dateTo) return false;
                return true;
            })
        );
    }, [schedules, dateFrom, dateTo]);

    // ソート
    const sorted = useMemo(() => {
        const data = [...filtered];
        data.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortKey) {
                case "lotNumber": aVal = a.lotNumber; bVal = b.lotNumber; break;
                case "productName": aVal = a.productName; bVal = b.productName; break;
                case "totalPayment": aVal = a.totalPayment; bVal = b.totalPayment; break;
                default: aVal = a.lotNumber; bVal = b.lotNumber;
            }
            if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        });
        return data;
    }, [filtered, sortKey, sortDir]);

    // CSV出力
    const handleExportCSV = () => {
        const rows: string[] = [];
        const headers = ["ロット番号", "商品名", "数量", "工程名", "搬入目安日", "完了目安日", "単価", "支払予定額"];
        rows.push(headers.join(","));

        sorted.forEach(lot => {
            lot.processes.forEach(p => {
                rows.push(
                    [lot.lotNumber, lot.productName, lot.quantity, p.processName, p.estimatedStartDate, p.canCalculate ? p.estimatedEndDate : "算出不可", p.unitPrice, p.payment]
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
        <div className="space-y-4 animate-in fade-in duration-300">
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

            {/* 日付フィルタ */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold">完了目安日:</span>
                    <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    <span className="text-slate-400">〜</span>
                    <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs" />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] text-slate-400 hover:text-red-500 font-bold ml-1 transition">クリア</button>
                    )}
                </div>
                <span className="text-[10px] text-slate-400 font-bold ml-auto">{sorted.length}件</span>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("lotNumber")}>
                                    ロット / 商品<SortIcon col="lotNumber" />
                                </th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">数量</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">工程</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">搬入目安日</th>
                                <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">完了目安日</th>
                                <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort("totalPayment")}>
                                    支払予定額<SortIcon col="totalPayment" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-slate-300 font-bold">
                                        該当するロットがありません
                                    </td>
                                </tr>
                            )}
                            {sorted.map((lot) => (
                                <tr key={lot.lotId} className="hover:bg-slate-50/50 transition align-top">
                                    <td className="px-4 py-3" rowSpan={1}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-blue-600">{lot.lotNumber}</span>
                                            {lot.canCalculate ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            ) : (
                                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                            )}
                                        </div>
                                        <span className="text-[11px] text-slate-500">{lot.productName}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">{lot.quantity.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1.5">
                                            {lot.processes.map((p, i) => (
                                                <div key={i} className="text-[11px] font-bold text-slate-600 truncate" title={p.processName}>{p.processName}</div>
                                            ))}
                                            {lot.processes.length === 0 && <span className="text-[10px] text-slate-300 italic">工程マスタ未登録</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1.5">
                                            {lot.processes.map((p, i) => (
                                                <div key={i} className="text-[11px] text-slate-500">{p.estimatedStartDate}</div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1.5">
                                            {lot.processes.map((p, i) => (
                                                <div key={i} className="text-[11px]">
                                                    {p.canCalculate ? (
                                                        <span className="font-bold text-slate-700">{p.estimatedEndDate}</span>
                                                    ) : (
                                                        <span className="text-amber-500 font-bold">算出不可</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-1.5">
                                            {lot.processes.map((p, i) => (
                                                <div key={i} className="text-[11px] text-right font-bold text-slate-700">
                                                    ¥{p.payment.toLocaleString()}
                                                    <span className="text-[9px] text-slate-400 font-normal ml-1">(@¥{p.unitPrice.toLocaleString()})</span>
                                                </div>
                                            ))}
                                            {lot.processes.length > 1 && (
                                                <div className="text-[10px] text-right font-black text-blue-600 border-t border-slate-100 pt-1">
                                                    計 ¥{lot.totalPayment.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
