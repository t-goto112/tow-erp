import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    width?: string;
}

export default function Modal({ open, onClose, title, subtitle, children, width = "max-w-lg" }: ModalProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        if (open) document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[990] flex items-center justify-center p-2 md:p-4 overflow-y-auto animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`${width} w-full bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-300 flex flex-col max-h-[98vh] md:max-h-[96vh]`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">{title}</h3>
                        {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
}
