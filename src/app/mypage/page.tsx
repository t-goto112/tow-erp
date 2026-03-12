"use client";

import React, { useState, useEffect } from "react";
import { User, Lock, Palette, BellRing, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

export default function MyPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<{ id: string; name: string; email: string } | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: pData, error } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (error) console.error("MyPage fetch error:", error);

                    setProfile({
                        id: user.id,
                        name: pData?.full_name || "",
                        email: user.email || ""
                    });
                }
            } catch (e) {
                console.error("MyPage load error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: profile.name })
                .eq('id', profile.id);

            if (error) throw error;
            showToast("success", "プロフィールの更新が完了しました");
        } catch (err: any) {
            showToast("error", "更新に失敗しました: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300 pb-20">
            <h3 className="text-2xl font-bold tracking-tight text-slate-800">マイページ設定</h3>

            {/* Account Info */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        アカウント情報
                    </h5>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                ユーザー名
                            </label>
                            <input
                                type="text"
                                value={profile?.name || ""}
                                onChange={(e) => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-bold text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                value={profile?.email || ""}
                                disabled
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Password */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden opacity-50">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        パスワード変更 (将来のアップデートで有効化)
                    </h5>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                            現在のパスワード
                        </label>
                        <input type="password" placeholder="••••••••" disabled className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                新しいパスワード
                            </label>
                            <input type="password" placeholder="最小8文字" disabled className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                パスワード確認
                            </label>
                            <input type="password" placeholder="もう一度入力" disabled className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Notification */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-emerald-500" />
                        通知設定
                    </h5>
                </div>
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BellRing className="w-4 h-4 text-indigo-400" />
                                納期アラート通知
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                受注納期が近づいた際にメールで通知を受け取ります
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                defaultChecked
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                    </div>
                </div>
            </section>

            <button
                onClick={handleSave}
                disabled={saving || !profile}
                className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-800/20 hover:bg-slate-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "設定内容を保存する"}
            </button>
        </div>
    );
}
