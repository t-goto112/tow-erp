"use client";

import { User, Lock, Palette, BellRing } from "lucide-react";

export default function MyPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
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
                                defaultValue="田中 義男"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                メールアドレス
                            </label>
                            <input
                                type="email"
                                defaultValue="tanaka@towmei.co.jp"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Password */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" />
                        パスワード変更
                    </h5>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                            現在のパスワード
                        </label>
                        <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                新しいパスワード
                            </label>
                            <input type="password" placeholder="最小8文字" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                                パスワード確認
                            </label>
                            <input type="password" placeholder="もう一度入力" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Design & Notification */}
            <section className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-emerald-500" />
                        デザイン・通知設定
                    </h5>
                </div>
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-700">
                                ダークモード
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                UIの配色を暗い背景に最適化します（ベータ版）
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                    </div>
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

            <button className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-800/20 hover:bg-slate-900 active:scale-[0.98] transition-all">
                設定内容を保存する
            </button>
        </div>
    );
}
