"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "実行する", danger = false }: ConfirmDialogProps) {
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!open || !mounted) return null;

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm();
        setLoading(false);
        onClose();
    };

    const dialogContent = (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${danger ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"}`}>
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
                    <div className="flex gap-3 w-full mt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition text-sm"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className={`flex-1 py-3 text-white font-bold rounded-2xl shadow-lg transition text-sm flex items-center justify-center gap-2 ${danger
                                ? "bg-red-500 shadow-red-500/20 hover:bg-red-600"
                                : "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600"
                                } disabled:bg-slate-300`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot) return null;

    return createPortal(dialogContent, modalRoot);
}
