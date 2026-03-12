"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Check, Loader2, ChevronRight, ArrowUp, ArrowDown, X, Package, Copy } from "lucide-react";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
    fetchMasterProducts, createProduct, updateProduct, deleteProduct,
    processesToFormGroups,
    type MasterProduct, type FormGroup
} from "@/lib/services/masterService";

let _formUid = Date.now();
function formUid() { return `f${++_formUid}`; }

export default function MasterPage() {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<MasterProduct | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // 商品フォーム
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");

    // 工程グループ
    const [formGroups, setFormGroups] = useState<FormGroup[]>([]);

    const refresh = useCallback(async () => {
        try {
            setFetching(true);
            const data = await fetchMasterProducts();
            setProducts(data);
        } catch (e: any) {
            console.error(e);
            showToast("error", "商品データの取得に失敗しました");
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const resetForm = () => {
        setFormName(""); setFormCode("");
        setFormGroups([]);
        setStep(1); setEditProduct(null);
    };

    const openNew = () => { resetForm(); setIsModalOpen(true); };

    const openEdit = (p: MasterProduct) => {
        setEditProduct(p);
        setFormName(p.name); setFormCode(p.code);
        setFormGroups(processesToFormGroups(p.processes || []));
        setStep(1); setIsModalOpen(true);
    };

    const duplicateProduct = (p: MasterProduct) => {
        setEditProduct(null);
        setFormName(p.name + " (コピー)");
        setFormCode(p.code + "-COPY");
        const duplicatedGroups = processesToFormGroups(p.processes || []).map((g: any) => ({
            ...g,
            id: formUid(),
            templates: g.templates.map((t: any) => ({
                ...t,
                id: formUid()
            }))
        }));
        setFormGroups(duplicatedGroups);
        setStep(1); setIsModalOpen(true);
    };

    const handleNext = () => {
        if (!formName || !formCode) { showToast("error", "商品コードと商品名は必須です"); return; }
        if (formGroups.length === 0) {
            setFormGroups([{ id: formUid(), label: "工程登録1", templates: [{ id: formUid(), name: "", subcontractors: [{ name: "", unitPrice: 0 }], sortOrder: 1 }] }]);
        }
        setStep(2);
    };

    const addGroup = () => {
        const idx = formGroups.length + 1;
        setFormGroups(prev => [...prev, { id: formUid(), label: `工程登録${idx}`, templates: [{ id: formUid(), name: "", subcontractors: [{ name: "", unitPrice: 0 }], sortOrder: 1 }] }]);
    };

    const removeGroup = (gi: number) => {
        setFormGroups(prev => prev.filter((_: any, i: number) => i !== gi));
    };

    const addProcess = (gi: number) => {
        const arr = [...formGroups];
        arr[gi].templates.push({ id: formUid(), name: "", subcontractors: [{ name: "", unitPrice: 0 }], sortOrder: arr[gi].templates.length + 1 });
        setFormGroups(arr);
    };

    const removeProcess = (gi: number, pi: number) => {
        const arr = [...formGroups];
        arr[gi].templates = arr[gi].templates.filter((_: any, i: number) => i !== pi).map((p: any, i: number) => ({ ...p, sortOrder: i + 1 }));
        setFormGroups(arr);
    };

    const moveProcess = (gi: number, pi: number, dir: -1 | 1) => {
        const arr = [...formGroups];
        const tpl = arr[gi].templates;
        const ni = pi + dir;
        if (ni < 0 || ni >= tpl.length) return;
        [tpl[pi], tpl[ni]] = [tpl[ni], tpl[pi]];
        arr[gi].templates = tpl.map((p: any, i: number) => ({ ...p, sortOrder: i + 1 }));
        setFormGroups(arr);
    };

    const updateProcess = (gi: number, pi: number, field: string, value: any) => {
        const arr = [...formGroups];
        (arr[gi].templates[pi] as any)[field] = value;
        setFormGroups(arr);
    };

    const addSubcontractor = (gi: number, pi: number) => {
        const arr = [...formGroups];
        arr[gi].templates[pi].subcontractors.push({ name: "", unitPrice: 0 });
        setFormGroups(arr);
    };

    const updateSubcontractor = (gi: number, pi: number, si: number, field: "name" | "unitPrice", value: string | number) => {
        const arr = [...formGroups];
        (arr[gi].templates[pi].subcontractors[si] as unknown as Record<string, unknown>)[field] = value;
        setFormGroups(arr);
    };

    const removeSubcontractor = (gi: number, pi: number, si: number) => {
        const arr = [...formGroups];
        arr[gi].templates[pi].subcontractors = arr[gi].templates[pi].subcontractors.filter((_: any, i: number) => i !== si);
        setFormGroups(arr);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            if (editProduct) {
                await updateProduct(editProduct.id, formName, formCode, formGroups);
                showToast("success", `「${formName}」を更新しました`);
            } else {
                await createProduct(formName, formCode, formGroups);
                showToast("success", `「${formName}」を登録しました`);
            }
            setIsModalOpen(false); resetForm();
            await refresh();
        } catch (e: any) {
            console.error(e);
            showToast("error", e.message || "保存に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteProduct(deleteId);
            showToast("success", "削除しました");
            setDeleteId(null);
            await refresh();
        } catch (e: any) {
            console.error(e);
            showToast("error", e.message || "削除に失敗しました");
        }
    };

    // Convert processes to groups for display
    const getProductGroups = (product: MasterProduct) => {
        return processesToFormGroups(product.processes || []);
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">商品マスタ管理</h3>
                <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
                    <Plus size={16} /> 新規登録
                </button>
            </div>

            {/* 商品カード一覧 */}
            <div className="space-y-3">
                {fetching && products.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                        <p className="text-sm text-slate-400 mt-2">読み込み中...</p>
                    </div>
                )}
                {products.map((p: MasterProduct) => {
                    const groups = getProductGroups(p);
                    return (
                        <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs font-bold text-blue-600">{p.code}</span>
                                        <span className="font-bold text-slate-800">{p.name}</span>
                                    </div>
                                    <p className="text-xs text-slate-400">{groups.length}グループ | {groups.reduce((s: number, g: any) => s + g.templates.length, 0)}工程</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => duplicateProduct(p)} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition" title="複製"><Copy size={14} /></button>
                                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="編集"><Edit2 size={14} /></button>
                                    <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" title="削除"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {/* 工程グループ別フロー表示 */}
                            {groups.map((g: any, gi: number) => (
                                <div key={g.id || gi} className="mb-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{g.label}</p>
                                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                                        {g.templates.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((pt: any, i: number) => (
                                            <div key={pt.id || i} className="flex items-center gap-1 shrink-0">
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-center">
                                                    <p className="text-[10px] font-bold text-slate-600">{pt.name}</p>
                                                    <p className="text-[9px] text-slate-400">{pt.subcontractors.map((s: any) => s.name).join(", ")}</p>
                                                </div>
                                                {i < g.templates.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
                {!fetching && products.length === 0 && <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400">商品が登録されていません</p></div>}
            </div>

            {/* モーダル */}
            <Modal open={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editProduct ? "商品を編集" : "商品を新規登録"}
                subtitle={step === 1 ? "Step 1: 商品情報" : "Step 2: 工程登録"}
                width="max-w-4xl">
                <div className="space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${step === 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                            <Package size={12} /> 商品情報
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${step === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                            工程登録
                        </div>
                    </div>

                    {step === 1 && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">商品コード</label>
                                <input type="text" value={formCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormCode(e.target.value)} placeholder="GYU-210" className="input-base" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">商品名</label>
                                <input type="text" value={formName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)} placeholder="牛刀 210mm" className="input-base" />
                            </div>
                            <button onClick={handleNext} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                次へ：工程登録 <ArrowDown className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
                                {formGroups.map((group: any, gi: number) => (
                                    <div key={group.id} className="border-2 border-blue-100 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black text-blue-600 uppercase">{group.label}</span>
                                            {formGroups.length > 1 && (
                                                <button onClick={() => removeGroup(gi)} className="text-[10px] text-red-500 font-bold hover:underline">このグループを削除</button>
                                            )}
                                        </div>

                                        {group.templates.map((proc: any, pi: number) => (
                                            <div key={proc.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-3">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-black text-slate-500">工程 {pi + 1}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => moveProcess(gi, pi, -1)} disabled={pi === 0} className="p-1 rounded hover:bg-white text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                                                        <button onClick={() => moveProcess(gi, pi, 1)} disabled={pi === group.templates.length - 1} className="p-1 rounded hover:bg-white text-slate-400 hover:text-blue-600 disabled:opacity-30"><ArrowDown size={14} /></button>
                                                        <button onClick={() => removeProcess(gi, pi)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                                <div className="mb-3">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">工程名</label>
                                                    <input type="text" value={proc.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProcess(gi, pi, "name", e.target.value)} placeholder="鍛造" className="input-base text-sm" />
                                                </div>
                                                <div className="mb-3 flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                                    <input type="checkbox" id={`assembly-cb-${gi}-${pi}`} checked={!!proc.isAssemblyPoint}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProcess(gi, pi, "isAssemblyPoint", e.target.checked as any)}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                                                    <label htmlFor={`assembly-cb-${gi}-${pi}`} className="text-[10px] font-bold text-slate-600 cursor-pointer">
                                                        この工程で別グループのパーツを組み付ける（実績報告時に仕掛パーツ在庫を消費）
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">外注先・単価</label>
                                                    {proc.subcontractors.map((sub: any, si: number) => (
                                                        <div key={si} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                                                            <input type="text" value={sub.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubcontractor(gi, pi, si, "name", e.target.value)} placeholder="外注先名" className="input-base text-xs flex-1 w-full" />
                                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                                <input type="number" value={sub.unitPrice || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubcontractor(gi, pi, si, "unitPrice", Number(e.target.value))} placeholder="¥単価" className="input-base text-xs w-full sm:w-24" />
                                                                {proc.subcontractors.length > 1 && <button onClick={() => removeSubcontractor(gi, pi, si)} className="p-2 border border-red-100 rounded-xl hover:bg-red-50 text-red-500 shrink-0"><X size={14} /></button>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => addSubcontractor(gi, pi)} className="text-[10px] text-blue-600 font-bold hover:underline">+ 外注先を追加</button>
                                                </div>
                                            </div>
                                        ))}

                                        <button type="button" onClick={() => addProcess(gi)}
                                            className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:border-blue-400 hover:text-blue-600 transition text-xs">
                                            + 工程を追加
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={addGroup}
                                className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 font-bold rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition text-sm">
                                + 工程グループを追加（別パーツ）
                            </button>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition text-sm">← 商品情報に戻る</button>
                                <button onClick={handleSave} disabled={loading}
                                    className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> {editProduct ? "変更を保存" : "登録する"}</>}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
                title="商品を削除しますか？" message="この商品に紐づく工程データもすべて削除されます。" confirmLabel="削除する" danger />
        </div>
    );
}
