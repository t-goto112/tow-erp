"use client";

import { useState } from "react";
import {
    AlertTriangle,
    CalendarDays,
    Clock,
    List,
    Wallet,
    X,
    Layers,
    Box,
} from "lucide-react";

/* ─── Dashboard Page (Phase 11) ─── */
export default function Dashboard() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="space-y-8 animate-in mt-4">
            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard label="受注残高" value="¥1,248,000" />
                <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm transition hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                            仕掛品累計
                        </p>
                        <span className="text-xl font-bold tracking-tight">
                            452{" "}
                            <span className="text-xs font-medium text-slate-500 ml-0.5">
                                個
                            </span>
                        </span>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-2 space-y-1">
                        <div className="flex justify-between">
                            <span>牛刀 210mm (#240901)</span>
                            <span>120個</span>
                        </div>
                        <div className="flex justify-between">
                            <span>三徳 165mm (#240905)</span>
                            <span>200個</span>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-600/20 text-white hover:bg-blue-700 transition">
                    <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest mb-1">
                        今月の支払確定額
                    </p>
                    <h3 className="text-3xl font-bold tracking-tight">
                        ¥428,500
                    </h3>
                </div>
            </div>

            {/* ── Gantt Chart ── */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-blue-500" />
                        生産ガントチャート
                    </h4>
                    <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                        <button className="px-3 py-1.5 bg-white shadow-sm rounded-lg text-slate-800">
                            今月
                        </button>
                        <button className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition">
                            前後1ヶ月
                        </button>
                        <button className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition">
                            範囲入力
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto bg-white">
                    <GanttChart />
                </div>
            </div>

            {/* ── WIP Table ── */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                    <List className="w-5 h-5 text-slate-400" />
                    工程別仕掛一覧
                    <span className="text-[10px] font-normal text-slate-400 ml-2">
                        行クリックでカード編集画面へ
                    </span>
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[500px]">
                        <thead>
                            <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                                <th className="py-3 px-2">製品</th>
                                <th className="py-3">ロット</th>
                                <th className="py-3 text-right">数</th>
                                <th className="py-3 pl-8">現工程</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50/50 text-slate-700">
                            <WipRow
                                name="牛刀 210mm"
                                lot="#240901-A"
                                qty={120}
                                process="本研ぎ"
                                onClick={() => setModalOpen(true)}
                            />
                            <WipRow
                                name="三徳 165mm"
                                lot="#240905-B"
                                qty={200}
                                process="荒研ぎ"
                                onClick={() => setModalOpen(true)}
                            />
                            <WipRow
                                name="ペティ 120mm"
                                lot="#240910-C"
                                qty={80}
                                process="柄付け"
                                onClick={() => setModalOpen(true)}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Alerts ── */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                <h4 className="font-bold mb-6 flex items-center gap-2 text-red-600 uppercase tracking-widest text-xs">
                    <AlertTriangle className="w-4 h-4" /> 納期アラート
                </h4>
                <div className="space-y-3">
                    <AlertItem
                        lot="#240910-C (柄付)"
                        message="完了予定日: 10月12日 (超過中)"
                        overdue
                    />
                    <AlertItem
                        lot="#240901-A (熱処理)"
                        message="明日が完了予定日です (10月16日)"
                    />
                </div>
            </div>

            {/* ── Lot Detail Modal ── */}
            {modalOpen && <LotDetailModal onClose={() => setModalOpen(false)} />}
        </div>
    );
}

/* ─── Sub-Components ─── */

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                {label}
            </p>
            <h3 className="text-3xl font-bold tracking-tight text-slate-800">{value}</h3>
        </div>
    );
}

function WipRow({
    name,
    lot,
    qty,
    process,
    onClick,
}: {
    name: string;
    lot: string;
    qty: number;
    process: string;
    onClick: () => void;
}) {
    return (
        <tr
            className="hover:bg-blue-50/50 transition cursor-pointer"
            onClick={onClick}
        >
            <td className="py-4 px-2 font-bold text-slate-700">{name}</td>
            <td className="py-4 text-xs font-mono text-slate-500">{lot}</td>
            <td className="py-4 text-right font-bold">
                {qty}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                    個
                </span>
            </td>
            <td className="py-4 pl-8">
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-md">
                    {process}
                </span>
            </td>
        </tr>
    );
}

function AlertItem({
    lot,
    message,
    overdue,
}: {
    lot: string;
    message: string;
    overdue?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-4 p-4 rounded-2xl border transition ${overdue
                ? "bg-red-50/50 border-red-100"
                : "bg-amber-50/50 border-amber-100"
                }`}
        >
            <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${overdue ? "bg-red-500" : "bg-amber-500"
                    }`}
            >
                <Clock className="w-5 h-5" />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-800">
                    {lot}
                    {overdue && (
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full ml-2 text-[10px] font-black uppercase">
                            超過
                        </span>
                    )}
                </p>
                <p
                    className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${overdue ? "text-red-600" : "text-amber-600"
                        }`}
                >
                    {message}
                </p>
            </div>
        </div>
    );
}

function GanttChart() {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const today = 15;

    const lots = [
        {
            name: "牛刀 210mm",
            lot: "#240901-A",
            start: 2,
            end: 12,
            label: "熱処理",
            overdue: true,
        },
        {
            name: "三徳 165mm",
            lot: "#240905-B",
            start: 8,
            end: 25,
            label: "荒研ぎ",
            overdue: false,
        },
        {
            name: "ペティ 120mm",
            lot: "#240910-C",
            start: 18,
            end: 30,
            label: "柄付け",
            overdue: false,
        },
    ];

    return (
        <div className="min-w-[1200px]">
            {/* Header Row */}
            <div
                className="grid border-b border-slate-100 bg-slate-50"
                style={{
                    gridTemplateColumns: `minmax(180px, 1fr) repeat(31, minmax(34px, 1fr))`,
                }}
            >
                <div className="p-4 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
                    製品 / ロット
                </div>
                {days.map((d) => (
                    <div
                        key={d}
                        className={`text-center py-3 text-[10px] font-bold border-r border-dashed border-slate-100 ${d === today
                            ? "bg-blue-50 text-blue-600"
                            : "text-slate-400"
                            }`}
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* Data Rows */}
            {lots.map((item) => (
                <div
                    key={item.lot}
                    className="grid h-16 border-b border-slate-50 hover:bg-slate-50/30 transition group"
                    style={{
                        gridTemplateColumns: `minmax(180px, 1fr) repeat(31, minmax(34px, 1fr))`,
                    }}
                >
                    <div className="flex flex-col justify-center px-4">
                        <span className="font-bold text-xs text-slate-700">
                            {item.name}
                        </span>
                        <span className="font-mono text-[9px] text-blue-500 font-bold mt-0.5">
                            {item.lot}
                        </span>
                    </div>
                    {days.map((d) => (
                        <div
                            key={d}
                            className={`relative border-r border-dashed border-slate-100 transition ${d === today ? 'bg-blue-50/20' : ''}`}
                        >
                            {d === item.start && (
                                <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-xl flex items-center px-3 text-[10px] font-black text-white whitespace-nowrap z-10 shadow-lg group-hover:scale-[1.02] transition-all cursor-default ${item.overdue
                                        ? "bg-gradient-to-r from-red-500 to-red-600 border border-red-700"
                                        : "bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-700"
                                        }`}
                                    style={{
                                        width: `${(item.end - item.start + 1) * 100}%`,
                                    }}
                                >
                                    {item.label} (
                                    {item.overdue ? "超過" : `${item.end}日締切`}
                                    )
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function LotDetailModal({ onClose }: { onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 bg-slate-900/60 z-50 flex justify-end backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-8 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-slate-800">ロット詳細情報</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                Lot Tracking & Editing System
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:bg-slate-100 rounded-full transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                    {/* Basic Info */}
                    <div className="border-b border-slate-100 pb-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                                    製品名
                                </span>
                                <h4 className="text-2xl font-black text-slate-800 leading-tight">
                                    牛刀 210mm <br />
                                    <span className="text-blue-600">ステンレス三層鋼 (VG10)</span>
                                </h4>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                                    ロット番号
                                </span>
                                <p className="text-sm font-mono font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                    #240901-A
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <EditableField label="発注日" value="2024年09月01日" />
                            <EditableField label="受注総数" value="120個" />
                        </div>
                    </div>

                    {/* Process Cards */}
                    <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Layers className="w-5 h-5 text-blue-500" />
                            工程別 進捗ステータス
                        </h5>
                        <div className="space-y-8">
                            <ProcessCard
                                title="本研ぎ"
                                qty={100}
                                deliveryDate="2024/10/10"
                                dueDate="2024/10/15"
                                overdue
                                completedProcesses={[
                                    "鍛造 (自社)",
                                    "荒研ぎ (加藤研磨)",
                                    "熱処理 (関市熱処理)",
                                ]}
                                highlight
                            />
                            <ProcessCard
                                title="再熱処理 (不良分修正)"
                                qty={20}
                                deliveryDate="2024/10/12"
                                dueDate="2024/10/22"
                                completedProcesses={["鍛造 (自社)", "荒研ぎ (加藤研磨)"]}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                    <button className="flex-1 py-4 bg-blue-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        設定内容を保存
                    </button>
                    <button
                        onClick={onClose}
                        className="py-4 px-8 bg-white text-slate-600 font-bold text-sm rounded-2xl border border-slate-200 hover:bg-slate-100 transition"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditableField({ label, value }: { label: string; value: string }) {
    return (
        <div className="group">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">
                {label}
            </span>
            <p className="text-sm font-black text-slate-700 group-hover:text-blue-600 border-b-2 border-transparent group-hover:border-blue-500/30 pb-1 cursor-pointer transition-all inline-block">
                {value}
            </p>
        </div>
    );
}

function ProcessCard({
    title,
    qty,
    deliveryDate,
    dueDate,
    overdue,
    completedProcesses,
    highlight,
}: {
    title: string;
    qty: number;
    deliveryDate: string;
    dueDate: string;
    overdue?: boolean;
    completedProcesses: string[];
    highlight?: boolean;
}) {
    return (
        <div
            className={`rounded-2xl overflow-hidden shadow-sm transition hover:shadow-md ${highlight
                ? "border-2 border-amber-300"
                : "border border-slate-200"
                }`}
        >
            <div
                className={`px-5 py-3 border-b flex justify-between items-center ${highlight
                    ? "bg-amber-100/50 border-amber-200"
                    : "bg-slate-50 border-slate-200"
                    }`}
            >
                <h6
                    className={`font-black text-sm flex items-center gap-2 ${highlight ? "text-amber-900" : "text-slate-800"
                        }`}
                >
                    <span
                        className={`w-2.5 h-2.5 rounded-full ${highlight ? "bg-amber-500 shadow-sm shadow-amber-500/50" : "bg-blue-500"
                            }`}
                    />
                    {title}
                </h6>
                <span
                    className={`px-3 py-1 text-white text-[10px] font-black rounded-lg ${highlight ? "bg-amber-600" : "bg-slate-800"
                        }`}
                >
                    {qty} 個
                </span>
            </div>
            <div className="p-6 space-y-5 text-sm bg-white">
                <div className="grid grid-cols-2 gap-6">
                    <EditableField label="納入実績" value={deliveryDate} />
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-2 uppercase tracking-widest">
                            完了納期
                        </span>
                        <p
                            className={`font-black text-sm ${overdue ? "text-red-600" : "text-blue-600"
                                }`}
                        >
                            {dueDate}
                            {overdue && " (納期超過)"}
                        </p>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-50">
                    <span className="text-[10px] text-slate-400 font-bold block mb-3 uppercase tracking-widest">
                        完了済ステータス
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {completedProcesses.map((p) => (
                            <span
                                key={p}
                                className="px-2.5 py-1.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100"
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
