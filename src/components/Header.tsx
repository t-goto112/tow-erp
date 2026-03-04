"use client";

import { Menu } from "lucide-react";
import NotificationCenter from "./NotificationCenter";

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

            <div className="flex items-center gap-3">
                <NotificationCenter />
                <button className="md:hidden p-2 text-slate-500 bg-slate-50 rounded-full">
                    <Menu className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}

