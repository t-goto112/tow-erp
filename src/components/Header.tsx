"use client";

import { Menu, RefreshCw } from "lucide-react";
import NotificationCenter from "./NotificationCenter";
import { store } from "@/lib/mockStore";

interface HeaderProps {
    title: string;
}

export default function Header({ title }: HeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-6 md:px-10 shrink-0 z-[50]">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                    {title}
                </h2>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => { if (confirm("初期状態にリセットしますか？")) store.clearStorage(); }}
                    className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-full transition-colors"
                    title="データをリセット"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <NotificationCenter />
                <button className="md:hidden p-2 text-slate-500 bg-slate-50 rounded-full">
                    <Menu className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}

