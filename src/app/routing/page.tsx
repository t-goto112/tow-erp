"use client";

import { useState } from "react";
import {
    Truck,
    CheckCircle,
    AlertTriangle,
} from "lucide-react";

/* ─── Types ─── */
interface LotOption {
    id: string;
    label: string;
}

interface ProcessOption {
    id: string;
    label: string;
}

/* ─── Sample Data ─── */
const sampleLots: LotOption[] = [
    { id: "lot1", label: "#240901-A | 牛刀 210mm" },
    { id: "lot2", label: "#240905-B | 三徳 165mm" },
    { id: "lot3", label: "#240910-C | ペティ 120mm" },
];

const sampleProcesses: ProcessOption[] = [
    { id: "p1", label: "鍛造 (自社)" },
    { id: "p2", label: "荒研ぎ (加藤研磨)" },
    { id: "p3", label: "熱処理 (関市熱処理)" },
    { id: "p4", label: "本研ぎ (加藤研磨)" },
    { id: "p5", label: "柄付け (自社)" },
];

/* ─── Main Page ─── */
export default function RoutingPage() {
    const [completeQty, setCompleteQty] = useState(195);
    const startingQty = 200;
    const remaining = Math.max(0, startingQty - completeQty);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
            <h3 className="text-2xl font-bold tracking-tight mb-8">
                工程実績の報告と納入
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── A. 納入報告 ── */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-blue-100 shadow-sm relative group overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition duration-500" />
                    <div className="flex items-center gap-3 mb-8 relative">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center">
                            <Truck className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-lg text-slate-800">納入報告</h4>
                    </div>

                    <form className="space-y-6 relative">
                        <Field label="対象ロット">
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition">
                                {sampleLots.map((l) => (
                                    <option key={l.id}>{l.label}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="納入工程 (自由に選択)">
                            <select className="w-full bg-blue-50/50 border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-bold">
                                {sampleProcesses.map((p) => (
                                    <option key={p.id}>{p.label}</option>
                                ))}
                            </select>
                        </Field>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    前処理工程 (鍛造) の未完了分
                                </span>
                            </div>
                            <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-amber-600">
                                残り 30 個
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="納入数">
                                <input
                                    type="number"
                                    defaultValue={120}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                                />
                            </Field>
                            <Field label="納品日">
                                <input
                                    type="date"
                                    defaultValue="2024-10-15"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                                />
                            </Field>
                        </div>

                        <Field label="工程完了予定日 (納期設定)" labelColor="text-blue-600">
                            <input
                                type="date"
                                defaultValue="2024-10-25"
                                className="w-full bg-blue-50/30 border-blue-200 text-blue-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-bold"
                            />
                        </Field>

                        <button
                            type="button"
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
                        >
                            納入報告を実行
                        </button>
                    </form>
                </div>

                {/* ── B. 完了報告 ── */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-slate-50 rounded-full group-hover:scale-110 transition duration-500" />
                    <div className="flex items-center gap-3 mb-8 relative">
                        <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-lg text-slate-800">完了報告</h4>
                    </div>

                    <form className="space-y-6 relative">
                        <Field label="報告ロット & 工程">
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition">
                                <option>#240905-B | 三徳165mm (荒研ぎ)</option>
                            </select>
                        </Field>

                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    工程開始時の数量
                                </span>
                                <span className="text-sm font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
                                    {startingQty}個
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-800 mb-2 uppercase">
                                        完了数量
                                    </label>
                                    <input
                                        type="number"
                                        value={completeQty}
                                        onChange={(e) =>
                                            setCompleteQty(
                                                Number(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-red-500 mb-2 uppercase leading-tight">
                                        未完了もしくは不良
                                    </label>
                                    <input
                                        type="number"
                                        value={remaining}
                                        readOnly
                                        className="w-full bg-red-50 text-red-600 border border-red-100 rounded-xl px-4 py-3 text-lg font-bold outline-none cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="搬出日 (実績終了日)">
                                <input
                                    type="date"
                                    defaultValue="2024-10-15"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                                />
                            </Field>
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-600 mb-2 uppercase tracking-widest leading-none">
                                    自動処理ステータス
                                </label>
                                <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl px-3 py-2 text-[9px] font-bold h-full flex flex-col justify-center leading-relaxed">
                                    報告完了後は次工程の納入待ちへ。
                                    <br />
                                    最終工程の場合、自動的に在庫計上されます。
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-800/20 hover:bg-slate-700 active:scale-[0.98] transition-all"
                        >
                            完了報告を実行
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function Field({
    label,
    labelColor,
    children,
}: {
    label: string;
    labelColor?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label
                className={`block text-[10px] font-bold mb-2 uppercase tracking-widest ${labelColor || "text-slate-500"
                    }`}
            >
                {label}
            </label>
            {children}
        </div>
    );
}
