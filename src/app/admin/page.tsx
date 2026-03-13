"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, Check, X, Eye, Edit2, Loader2 } from "lucide-react";
import { showToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";

const pageNames: Record<string, string> = {
    dashboard: "ダッシュボード",
    orders: "受注管理",
    inventory: "在庫管理",
    payments: "支払管理",
    routing: "工程実績",
    master: "マスタ管理",
    admin: "管理者設定",
};

interface UserProfile {
    id: string;
    full_name: string;
    role: string;
    email?: string;
    permissions?: Record<string, { view: boolean; edit: boolean }>;
}

export default function AdminPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role, permissions')
                .order('created_at', { ascending: true });
            if (error) throw error;
            setUsers(data || []);
        } catch (e: any) {
            console.error(e);
            showToast("error", "ユーザー情報の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const pages = Object.keys(pageNames);

    const handleSandboxReset = async () => {
        if (!confirm("すべての実績データを初期状態にリセットしますか？この操作は取り消せません。")) return;
        setResetting(true);
        try {
            // Delete transactional data in dependency order
            const tables = [
                'payment_items',
                'payments',
                'lot_process_deliveries',
                'lot_process_history',
                'lot_processes',
                'lots',
                'order_items',
                'orders',
                'inventory_history',
                'inventory',
            ];
            for (const table of tables) {
                const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) {
                    console.warn(`Failed to clear ${table}:`, error.message);
                }
            }
            showToast("success", "システムを初期状態にリセットしました");
        } catch (e: any) {
            console.error(e);
            showToast("error", e.message || "リセットに失敗しました");
        } finally {
            setResetting(false);
        }
    };

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
                                {pages.map((p: string) => (
                                    <th key={p} colSpan={2} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider border-l border-slate-100">
                                        {pageNames[p]}
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-slate-50/50">
                                <th></th>
                                {pages.map((p: string) => (
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
                            {loading && (
                                <tr><td colSpan={1 + pages.length * 2} className="text-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                                </td></tr>
                            )}
                            {users.map((user: UserProfile) => {
                                const isAdmin = user.role === "admin";
                                // Parse permissions from JSONB, defaulting to true for admin and false for users
                                const userPerms = user.permissions || {};

                                const toggleRole = async () => {
                                    if (isAdmin && user.id === (await supabase.auth.getUser()).data.user?.id) {
                                        showToast("error", "自分自身の管理者権限は解除できません");
                                        return;
                                    }
                                    const newRole = isAdmin ? 'user' : 'admin';
                                    const { error } = await supabase
                                        .from('profiles')
                                        .update({ role: newRole })
                                        .eq('id', user.id);

                                    if (error) {
                                        showToast("error", "権限の更新に失敗しました");
                                    } else {
                                        showToast("success", `${user.full_name} を ${newRole === 'admin' ? '管理者' : '一般ユーザー'} に変更しました`);
                                        refresh();
                                    }
                                };

                                const togglePermission = async (page: string, type: 'view' | 'edit') => {
                                    if (isAdmin) return; // Admins have all perms hardcoded/fixed in UI logic usually, or just don't allow changing

                                    const newPerms = {
                                        ...userPerms,
                                        [page]: {
                                            ...(userPerms[page] || { view: true, edit: false }),
                                            [type]: !(userPerms[page]?.[type] ?? (type === 'view'))
                                        }
                                    };

                                    const { error } = await supabase
                                        .from('profiles')
                                        .update({ permissions: newPerms })
                                        .eq('id', user.id);

                                    if (error) {
                                        showToast("error", "権限の更新に失敗しました");
                                    } else {
                                        refresh();
                                    }
                                };

                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-bold text-slate-700">{user.full_name}</span>
                                                    <p className="text-[10px] text-slate-400">{user.email || user.id.slice(0, 8)}</p>
                                                </div>
                                                <button
                                                    onClick={toggleRole}
                                                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition hover:opacity-80 ${isAdmin ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500"}`}
                                                >
                                                    {isAdmin ? "管理者" : "一般"}
                                                </button>
                                            </div>
                                        </td>
                                        {pages.map((page: string) => {
                                            // Admin users have full access (true); regular users use their recorded permissions
                                            const hasView = isAdmin || (userPerms[page]?.view ?? true);
                                            const hasEdit = isAdmin || (userPerms[page]?.edit ?? false);

                                            return (
                                                <td key={page} colSpan={2} className="px-1 py-3 border-l border-slate-100">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => togglePermission(page, 'view')}
                                                            disabled={isAdmin}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${hasView ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-300"} ${isAdmin ? "cursor-not-allowed opacity-50" : "hover:scale-110 active:scale-95"}`}>
                                                            {hasView ? <Check size={12} /> : <X size={12} />}
                                                        </button>
                                                        <button
                                                            onClick={() => togglePermission(page, 'edit')}
                                                            disabled={isAdmin}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${hasEdit ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"} ${isAdmin ? "cursor-not-allowed opacity-50" : "hover:scale-110 active:scale-95"}`}>
                                                            {hasEdit ? <Check size={12} /> : <X size={12} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
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
                    デモ利用やテストの後に、すべての実績データ（受注、ロット、在庫、支払履歴など）を初期状態にリセットできます。
                    <br />
                    <span className="text-amber-600 font-bold">※この操作は取り消せません。マスタデータ（商品・工程・外注先）は維持されます。</span>
                </p>
                <button
                    onClick={handleSandboxReset}
                    disabled={resetting}
                    className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-amber-600/20 hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {resetting ? "リセット中..." : "実績データをリセットする"}
                </button>
            </div>
        </div>
    );
}
