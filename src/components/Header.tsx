"use client";

import { Search, SlidersHorizontal, Bell, Menu } from "lucide-react";

interface HeaderProps {
    title: string;
}

export default function Header({ title }: HeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-6 md:px-10 shrink-0 z-0">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                    {title}
                </h2>
            </div>

            {/* Search & Filter */}
            <div className="hidden md:flex flex-1 max-w-md mx-6 items-center bg-slate-100 rounded-full px-4 py-1.5 border border-slate-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white transition shadow-sm">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                    type="text"
                    placeholder="ロット番号・製品名で検索..."
                    className="bg-transparent text-sm w-full outline-none text-slate-700 placeholder:text-slate-400 font-medium"
                />
                <button className="ml-2 pl-3 border-l border-slate-300 text-slate-500 hover:text-blue-600 transition flex items-center gap-1.5 shrink-0">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">絞り込み</span>
                </button>
            </div>

            <div className="flex items-center gap-3">
                <button className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full" />
                </button>
                <button className="md:hidden p-2 text-slate-500 bg-slate-50 rounded-full">
                    <Menu className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
