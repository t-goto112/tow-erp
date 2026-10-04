"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, LogOut, Type } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import { useFontSize, FontSize } from "@/context/FontSizeContext";

export default function MyPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [profile, setProfile] = useState<{ id: string; name: string; email: string; fontSize: FontSize } | null>(null);
    const { fontSize: currentFontSize, setFontSize } = useFontSize();
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;
                if (user) {
                    const { data: pData, error } = await supabase
                        .from('profiles')
                        .select('full_name, font_size')
                        .eq('id', user.id)
                        .single();

                    if (error) console.error("MyPage: DB Fetch error", error);

                    const userFontSize = (pData?.font_size as FontSize) || currentFontSize || "small";

                    setProfile({
                        id: user.id,
                        name: pData?.full_name || user.user_metadata?.full_name || "未設定",
                        email: user.email || "",
                        fontSize: userFontSize
                    });
                }
            } catch (e) {
                console.error("MyPage catch error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        if (!profile) {
            console.error("MyPage: Profile is null, cannot save");
            return;
        }
        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ 
                    full_name: profile.name,
                    font_size: profile.fontSize
                })
                .eq('id', profile.id)
                .select();

            if (error) {
                console.error("MyPage: Supabase update error", error);
                throw error;
            }

            // コンテキストとLocalStorageに即時反映
            setFontSize(profile.fontSize);

            showToast("success", "プロフィールの更新が完了しました");
        } catch (err: any) {
            console.error("MyPage: Save attempt failed", err);
            showToast("error", "更新に失敗しました: " + (err.message || "Unknown error"));
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

            {/* Display Settings */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Type className="w-4 h-4 text-blue-500" />
                        表示設定（文字サイズ）
                    </h5>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-xs text-slate-500 font-medium">画面全体の文字の大きさを設定します（デフォルト: 小）。</p>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <button
                            type="button"
                            onClick={() => setProfile(prev => prev ? { ...prev, fontSize: "small" } : null)}
                            className={`p-4 rounded-2xl border-2 font-bold text-sm text-center transition-all ${
                                profile?.fontSize === "small"
                                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                            }`}
                        >
                            小
                        </button>
                        <button
                            type="button"
                            onClick={() => setProfile(prev => prev ? { ...prev, fontSize: "large" } : null)}
                            className={`p-4 rounded-2xl border-2 font-bold text-base text-center transition-all ${
                                profile?.fontSize === "large"
                                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                            }`}
                        >
                            大
                        </button>
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

            <button
                onClick={async () => {
                    setLoggingOut(true);
                    try {
                        await supabase.auth.signOut();
                        router.push("/login");
                    } catch (err) {
                        console.error("Logout error:", err);
                        showToast("error", "ログアウトに失敗しました");
                        setLoggingOut(false);
                    }
                }}
                disabled={loggingOut}
                className="w-full bg-white text-red-500 border border-red-200 font-bold py-4 rounded-2xl hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogOut className="w-4 h-4" /> ログアウト</>}
            </button>
        </div>
    );
}
