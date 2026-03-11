"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, Check, X, Eye, Edit2 } from "lucide-react";
import { store, type UserPermission } from "@/lib/mockStore";
import { showToast } from "@/components/Toast";

const pageNames: Record<string, string> = {
    dashboard: "ダッシュボード",
    orders: "受注管理",
    inventory: "在庫管理",
    payments: "支払管理",
    routing: "工程実績",
    master: "マスタ管理",
    lots: "ロット管理",
    admin: "管理者設定",
};

export default function AdminPage() {
    const [users, setUsers] = useState<UserPermission[]>([]);

    const refresh = useCallback(() => setUsers([...store.users]), []);
    useEffect(() => { refresh(); return store.subscribe(refresh); }, [refresh]);

    const togglePermission = (userId: string, page: string, type: "view" | "edit") => {
        const user = users.find(u => u.userId === userId);
        if (!user) return;
        const current = user.permissions[page]?.[type] ?? false;
        store.updatePermission(userId, page, type, !current);
        showToast("success", "権限を更新しました");
    };

    const pages = Object.keys(pageNames);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl shadow-lg flex items-center justify-center">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800">管理者設定</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">User Permission Management</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ユーザー</th>
                                {pages.map(p => (
                                    <th key={p} colSpan={2} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider border-l border-slate-100">
                                        {pageNames[p]}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-slate-50/50">
                                <th></th>
                                {pages.map(p => (
                                    <th key={`${p}-sub`} colSpan={2} className="px-1 pb-2 border-l border-slate-100">
                                        <div className="flex justify-center gap-2">
                                            <span className="text-[8px] text-slate-300 flex items-center gap-0.5"><Eye size={8} /> 閲覧</span>
                                            <span className="text-[8px] text-slate-300 flex items-center gap-0.5"><Edit2 size={8} /> 編集</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(user => (
                                <tr key={user.userId} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3">
                                        <div>
                                            <span className="font-bold text-slate-700">{user.name}</span>
                                            <p className="text-[10px] text-slate-400">{user.email}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold ${user.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500"}`}>
                                                {user.role === "admin" ? "管理者" : "一般"}
                                            </span>
                                        </div>
                                    </td>
                                    {pages.map(page => {
                                        const perm = user.permissions[page] ?? { view: false, edit: false };
                                        const isAdmin = user.role === "admin";
                                        return (
                                            <td key={page} colSpan={2} className="px-1 py-3 border-l border-slate-100">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => !isAdmin && togglePermission(user.userId, page, "view")} disabled={isAdmin}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${perm.view ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-300"} ${isAdmin ? "cursor-not-allowed opacity-50" : "hover:opacity-80"}`}>
                                                        {perm.view ? <Check size={12} /> : <X size={12} />}
                                                    </button>
                                                    <button onClick={() => !isAdmin && togglePermission(user.userId, page, "edit")} disabled={isAdmin}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${perm.edit ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"} ${isAdmin ? "cursor-not-allowed opacity-50" : "hover:opacity-80"}`}>
                                                        {perm.edit ? <Check size={12} /> : <X size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs text-slate-400 font-bold">💡 管理者アカウントの権限は変更できません。一般ユーザーの閲覧・編集権限をチェックボックスで個別に設定できます。</p>
            </div>

            {/* サンドボックスツール */}
            <div className="bg-amber-50 rounded-3xl border border-amber-200 p-8 space-y-4">
                <div className="flex items-center gap-3 text-amber-700">
                    <Shield className="w-6 h-6" />
                    <h3 className="text-lg font-black uppercase tracking-tight">サンドボックスツール</h3>
                </div>
                <p className="text-sm text-amber-800/70 font-medium">
                    デモ利用やテストの後に、すべての実績データ（受注、ロット、在庫、支払履歴など）を初期のデモ状態にリセットできます。
                    <br />
                    <span className="text-amber-600 font-bold">※この操作は取り消せません。</span>
                </p>
                <button
                    onClick={() => {
                        if (confirm("すべての実績データを初期状態にリセットしますか？この操作は取り消せません。")) {
                            store.resetForSandbox();
                            showToast("success", "システムを初期デモ状態にリセットしました");
                        }
                    }}
                    className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-amber-600/20 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                    デモデータをリセットする
                </button>
            </div>
        </div>
    );
}
