"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    // ハイドレーションエラー防止
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (loginError) {
                setError("ログインに失敗しました。メールアドレスまたはパスワードを確認してください。");
                setLoading(false);
            } else {
                // auth-helpers を使用している場合、クッキーが設定されるまで僅かに待機が必要な場合があるため
                // window.location.href でトップへ強制遷移させるのが最も確実
                window.location.href = "/";
            }
        } catch (err) {
            setError("通信エラーが発生しました。");
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 antialiased overflow-hidden relative">
            {/* 背景の装飾 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/40 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md bg-white rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden border border-white/20 relative z-10 animate-in">
                <div className="p-10 md:p-12">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-2xl shadow-blue-600/30 transform -rotate-6 hover:rotate-0 transition-all duration-500 group">
                            <ShieldCheck size={40} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tighter">TOWMEI ERP</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-3 bg-slate-100 px-3 py-1 rounded-full">
                            Industrial OS V1.0
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">
                                メールアドレス
                            </label>
                            <div className="relative group">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full pl-12 pr-5 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all duration-300 text-sm font-bold text-slate-700"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">
                                パスワード
                            </label>
                            <div className="relative group">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-5 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all duration-300 text-sm font-bold text-slate-700"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in shadow-inner">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm shadow-2xl shadow-slate-900/20 hover:bg-black hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {loading ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <>システムへログイン <ArrowRight size={20} /></>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-slate-50/50 p-8 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                        © 2026 TOWMEI Manufacturing Solutions
                    </p>
                </div>
            </div>

            <div className="mt-12 flex gap-10 text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] relative z-10">
                <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            </div>

            <div className="mt-6 text-[10px] text-slate-300 font-medium">
                Version 5.8.2-stable
            </div>
        </div>
    );
}
