"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
    title: string;
    onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-4 md:px-10 shrink-0 z-[50]">
            <div className="flex items-center gap-3">
                <button
                    className="md:hidden p-2 text-slate-500 bg-slate-50 rounded-full active:bg-slate-100 transition"
                    onClick={onMenuClick}
                >
                    <Menu className="w-5 h-5" />
                </button>
                <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">
                    {title}
                </h2>
            </div>
        </header>
    );
}
