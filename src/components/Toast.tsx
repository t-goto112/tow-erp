"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning";

interface ToastMessage {
    id: number;
    type: ToastType;
    message: string;
}

let toastId = 0;
let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export function showToast(type: ToastType, message: string) {
    addToastFn?.(type, message);
}

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        addToastFn = (type, message) => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, type, message }]);
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
        };
        return () => { addToastFn = null; };
    }, []);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    };

    const colors = {
        success: "border-emerald-200 bg-emerald-50",
        error: "border-red-200 bg-red-50",
        warning: "border-amber-200 bg-amber-50",
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] space-y-3 pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl backdrop-blur-sm animate-in slide-in-from-right duration-300 ${colors[t.type]}`}
                >
                    {icons[t.type]}
                    <span className="text-sm font-bold text-slate-700">{t.message}</span>
                    <button
                        onClick={() => setToasts(prev => prev.filter(tt => tt.id !== t.id))}
                        className="ml-2 p-1 rounded-full hover:bg-white/50 transition"
                    >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                </div>
            ))}
        </div>
    );
}
