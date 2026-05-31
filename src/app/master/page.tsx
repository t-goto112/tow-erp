"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, Check, Loader2, ChevronRight, ArrowUp, ArrowDown, X, Package, Copy, Database, GripVertical, ChevronDown } from "lucide-react";
import { showToast } from "@/components/Toast";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
    fetchMasterProducts, createProduct, updateProduct, deleteProduct,
    processesToFormGroups,
    createProductGroup, updateProductGroup, deleteProductGroup, reorderProductGroups,
    moveProductToGroup, reorderProductsInGroup,
    type MasterProduct, type FormGroup
} from "@/lib/services/masterService";
import { useSupabaseData } from "@/lib/useSupabaseData";
import { supabase } from "@/lib/supabase";

let _formUid = Date.now();
function formUid() { return `f${++_formUid}`; }

export default function MasterPage() {
    const [products, setProducts] = useState<MasterProduct[]>([]);
    const [productGroups, setProductGroups] = useState<{ id: string; name: string; sort_order: number }[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<MasterProduct | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const { profile, loading: authLoading } = useSupabaseData();
    const router = useRouter();

    // Group-related States
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editGroup, setEditGroup] = useState<{ id: string; name: string } | null>(null);
    const [groupFormName, setGroupFormName] = useState("");
    const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Drag and Drop States
    const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
    const [draggingProductId, setDraggingProductId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
    const canEdit = profile?.role === 'admin' || (profile?.permissions?.master?.edit === true);

    // 閲覧権限がない場合はアクセスブロック
    useEffect(() => {
        if (!authLoading && profile && profile.role !== 'admin' && profile.permissions?.master?.view === false) {
            router.replace("/");
        }
    }, [authLoading, profile, router]);

    if (!authLoading && profile && profile.role !== 'admin' && profile.permissions?.master?.view === false) {
        return null;
    }

    const [fetching, setFetching] = useState(true);

    // 商品フォーム
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");

    // 工程グループ
    const [formGroups, setFormGroups] = useState<FormGroup[]>([]);

    const refresh = useCallback(async () => {
        try {
            setFetching(true);
            const [prodData, groupData] = await Promise.all([
                fetchMasterProducts(),
                supabase.from('product_groups').select('*').order('sort_order', { ascending: true })
            ]);
            setProducts(prodData);
            setProductGroups(groupData.data || []);
        } catch (e: any) {
            console.error(e);
            showToast("error", "商品データの取得に失敗しました");
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const handleSaveGroup = async () => {
        if (!groupFormName) {
            showToast("error", "グループ名を入力してください");
            return;
        }
        setLoading(true);
        try {
            if (editGroup) {
                await updateProductGroup(editGroup.id, groupFormName);
                showToast("success", `グループ「${groupFormName}」を更新しました`);
            } else {
                await createProductGroup(groupFormName);
                showToast("success", `グループ「${groupFormName}」を作成しました`);
            }
            setIsGroupModalOpen(false);
            setGroupFormName("");
            await refresh();
        } catch (e: any) {
            console.error(e);
            showToast("error", e.message || "グループの保存に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!deleteGroupId) return;
        try {
            await deleteProductGroup(deleteGroupId);
            showToast("success", "グループと中の商品を削除しました");
            setDeleteGroupId(null);
            await refresh();
        } catch (e: any) {
            console.error(e);
            showToast("error", e.message || "グループの削除に失敗しました");
        }
    };

    const resetForm = () => {
        setFormName(""); setFormCode("");
        setFormGroups([]);
        setStep(1); setEditProduct(null);
    };

    const openNew = () => { if (!canEdit) return; resetForm(); setIsModalOpen(true); };

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

    const updateGroupPartLabel = (gi: number, value: string) => {
        const arr = [...formGroups];
        arr[gi].partLabel = value;
        setFormGroups(arr);
    };

    const toggleTargetGroup = (gi: number, pi: number, targetGi: number) => {
        const arr = [...formGroups];
        const proc = arr[gi].templates[pi];
        const indexes = proc.targetGroupIndexes ? [...proc.targetGroupIndexes] : [];
        const idx = indexes.indexOf(targetGi);
        if (idx >= 0) indexes.splice(idx, 1); else indexes.push(targetGi);
        proc.targetGroupIndexes = indexes;
        proc.isAssemblyPoint = indexes.length > 0;
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
                {canEdit && (
                    <div className="flex gap-2">
                        <button onClick={() => { setEditGroup(null); setGroupFormName(""); setIsGroupModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold active:scale-[0.98] transition-all">
                            <Plus size={16} /> グループ作成
                        </button>
                        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
                            <Plus size={16} /> 新規登録
                        </button>
                    </div>
                )}
            </div>

            {/* 商品カード一覧（グループ化） */}
            <div className="space-y-6">
                {fetching && products.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                        <p className="text-sm text-slate-400 mt-2">読み込み中...</p>
                    </div>
                )}
                
                {/* 各グループの表示 */}
                {productGroups.map((g) => {
                    const groupProducts = products.filter(p => p.group_id === g.id);
                    const isCollapsed = collapsedGroups[g.id];
                    const isDragOver = dragOverGroupId === g.id;

                    return (
                        <div 
                            key={g.id}
                            className={`bg-slate-50 border-2 rounded-2xl p-4 transition-all ${
                                isDragOver ? "border-blue-400 bg-blue-50/30" : "border-slate-200"
                            }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (draggingGroupId !== g.id) {
                                    setDragOverGroupId(g.id);
                                }
                            }}
                            onDragLeave={() => {
                                setDragOverGroupId(null);
                            }}
                            onDrop={async (e) => {
                                e.preventDefault();
                                setDragOverGroupId(null);
                                const data = e.dataTransfer.getData("text/plain");
                                if (data.startsWith("group:")) {
                                    const droppedGroupId = data.split(":")[1];
                                    if (droppedGroupId === g.id) return;
                                    
                                    const groupIds = productGroups.map(pg => pg.id);
                                    const fromIndex = groupIds.indexOf(droppedGroupId);
                                    const toIndex = groupIds.indexOf(g.id);
                                    
                                    const newGroupIds = [...groupIds];
                                    newGroupIds.splice(fromIndex, 1);
                                    newGroupIds.splice(toIndex, 0, droppedGroupId);
                                    
                                    const reordered = newGroupIds.map((id, index) => {
                                        const group = productGroups.find(pg => pg.id === id)!;
                                        return { ...group, sort_order: index };
                                    });
                                    setProductGroups(reordered);
                                    
                                    try {
                                        await reorderProductGroups(newGroupIds);
                                        showToast("success", "グループの並び順を更新しました");
                                    } catch (err) {
                                        showToast("error", "グループの並び替えに失敗しました");
                                        refresh();
                                    }
                                } else if (data.startsWith("product:")) {
                                    const droppedProductId = data.split(":")[1];
                                    try {
                                        const nextSortOrder = groupProducts.length;
                                        setProducts(prev => prev.map(p => 
                                            p.id === droppedProductId 
                                                ? { ...p, group_id: g.id, sort_order: nextSortOrder }
                                                : p
                                        ));
                                        await moveProductToGroup(droppedProductId, g.id, nextSortOrder);
                                        showToast("success", "商品を移動しました");
                                    } catch (err) {
                                        showToast("error", "商品の移動に失敗しました");
                                        refresh();
                                    }
                                }
                            }}
                        >
                            {/* グループヘッダー */}
                            <div 
                                className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 cursor-pointer select-none"
                                onClick={() => toggleGroupCollapse(g.id)}
                            >
                                <div className="flex items-center gap-2">
                                    {canEdit && (
                                        <div 
                                            draggable="true"
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                e.dataTransfer.setData("text/plain", `group:${g.id}`);
                                                setDraggingGroupId(g.id);
                                            }}
                                            onDragEnd={() => {
                                                setDraggingGroupId(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/50"
                                        >
                                            <GripVertical size={16} />
                                        </div>
                                    )}
                                    <ChevronDown 
                                        size={16} 
                                        className={`text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} 
                                    />
                                    <span className="font-black text-slate-700 text-sm">{g.name}</span>
                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{groupProducts.length}</span>
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {canEdit && (
                                        <>
                                            <button 
                                                onClick={() => { setEditGroup(g); setGroupFormName(g.name); setIsGroupModalOpen(true); }}
                                                className="p-1.5 rounded-md hover:bg-slate-200/50 text-slate-400 hover:text-blue-600 transition"
                                                title="グループ名を編集"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => setDeleteGroupId(g.id)}
                                                className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                                                title="グループを削除（中の商品も削除）"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* グループ内の商品リスト */}
                            {!isCollapsed && (
                                <div className="space-y-3">
                                    {groupProducts.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 bg-white rounded-xl">
                                            このグループには商品がありません。商品をドラッグ＆ドロップして追加できます。
                                        </div>
                                    ) : (
                                        groupProducts.map((p) => {
                                            const groups = getProductGroups(p);
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    draggable={canEdit ? "true" : "false"}
                                                    onDragStart={(e) => {
                                                        if (!canEdit) return;
                                                        e.stopPropagation();
                                                        e.dataTransfer.setData("text/plain", `product:${p.id}`);
                                                        setDraggingProductId(p.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggingProductId(null);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                    }}
                                                    onDrop={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const data = e.dataTransfer.getData("text/plain");
                                                        if (data.startsWith("product:")) {
                                                            const droppedProductId = data.split(":")[1];
                                                            if (droppedProductId === p.id) return;

                                                            const targetGroupId = p.group_id || null;
                                                            const groupProducts = products.filter(item => item.group_id === targetGroupId && item.id !== droppedProductId);
                                                            const targetIndex = groupProducts.findIndex(item => item.id === p.id);

                                                            const reorderedProducts = [...groupProducts];
                                                            reorderedProducts.splice(targetIndex, 0, products.find(item => item.id === droppedProductId)!);

                                                            const orderedIds = reorderedProducts.map(item => item.id);

                                                            setProducts(prev => {
                                                                const otherGroupProducts = prev.filter(item => item.group_id !== targetGroupId && item.id !== droppedProductId);
                                                                const updatedGroupProducts = reorderedProducts.map((item, index) => ({
                                                                    ...item,
                                                                    group_id: targetGroupId,
                                                                    sort_order: index
                                                                }));
                                                                return [...otherGroupProducts, ...updatedGroupProducts].sort((a, b) => {
                                                                    if (a.group_id === b.group_id) {
                                                                        return (a.sort_order || 0) - (b.sort_order || 0);
                                                                    }
                                                                    const aGroup = productGroups.find(pg => pg.id === a.group_id);
                                                                    const bGroup = productGroups.find(pg => pg.id === b.group_id);
                                                                    const aOrder = aGroup ? aGroup.sort_order : 9999;
                                                                    const bOrder = bGroup ? bGroup.sort_order : 9999;
                                                                    return aOrder - bOrder;
                                                                });
                                                            });

                                                            try {
                                                                await reorderProductsInGroup(targetGroupId, orderedIds);
                                                                showToast("success", "商品の並び順を更新しました");
                                                            } catch (err) {
                                                                showToast("error", "商品の並び替えに失敗しました");
                                                                refresh();
                                                            }
                                                        }
                                                    }}
                                                    className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition ${
                                                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1 min-w-0">
                                                                {canEdit && <GripVertical size={14} className="text-slate-300 shrink-0" />}
                                                                <span className="font-mono text-xs font-bold text-blue-600 shrink-0">{p.code}</span>
                                                                <span className="font-bold text-slate-800 truncate">{p.name}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-400">{groups.length}グループ | {groups.reduce((s: number, g: any) => s + g.templates.length, 0)}工程</p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {canEdit && <button onClick={() => duplicateProduct(p)} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition" title="複製"><Copy size={14} /></button>}
                                                            {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="編集"><Edit2 size={14} /></button>}
                                                            {canEdit && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" title="削除"><Trash2 size={14} /></button>}
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
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* 未分類の商品の表示 */}
                {(() => {
                    const unclassifiedProducts = products.filter(p => !p.group_id);
                    const isDragOver = dragOverGroupId === "unclassified";
                    const isCollapsed = collapsedGroups["unclassified"];

                    return (
                        <div 
                            className={`bg-slate-50 border-2 border-dashed rounded-2xl p-4 transition-all ${
                                isDragOver ? "border-blue-400 bg-blue-50/30" : "border-slate-300"
                            }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverGroupId("unclassified");
                            }}
                            onDragLeave={() => {
                                setDragOverGroupId(null);
                            }}
                            onDrop={async (e) => {
                                e.preventDefault();
                                setDragOverGroupId(null);
                                const data = e.dataTransfer.getData("text/plain");
                                if (data.startsWith("product:")) {
                                    const droppedProductId = data.split(":")[1];
                                    try {
                                        const nextSortOrder = unclassifiedProducts.length;
                                        setProducts(prev => prev.map(p => 
                                            p.id === droppedProductId 
                                                ? { ...p, group_id: null, sort_order: nextSortOrder }
                                                : p
                                        ));
                                        await moveProductToGroup(droppedProductId, null, nextSortOrder);
                                        showToast("success", "商品を未分類に移動しました");
                                    } catch (err) {
                                        showToast("error", "商品の移動に失敗しました");
                                        refresh();
                                    }
                                }
                            }}
                        >
                            {/* 未分類ヘッダー */}
                            <div 
                                className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 cursor-pointer select-none"
                                onClick={() => toggleGroupCollapse("unclassified")}
                            >
                                <div className="flex items-center gap-2">
                                    <ChevronDown 
                                        size={16} 
                                        className={`text-slate-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} 
                                    />
                                    <span className="font-black text-slate-700 text-sm">未分類</span>
                                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{unclassifiedProducts.length}</span>
                                </div>
                            </div>

                            {/* 未分類の商品リスト */}
                            {!isCollapsed && (
                                <div className="space-y-3">
                                    {unclassifiedProducts.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 bg-white rounded-xl">
                                            未分類商品は存在しません。商品をここにドラッグ＆ドロップして未分類にできます。
                                        </div>
                                    ) : (
                                        unclassifiedProducts.map((p) => {
                                            const groups = getProductGroups(p);
                                            return (
                                                <div 
                                                    key={p.id} 
                                                    draggable={canEdit ? "true" : "false"}
                                                    onDragStart={(e) => {
                                                        if (!canEdit) return;
                                                        e.stopPropagation();
                                                        e.dataTransfer.setData("text/plain", `product:${p.id}`);
                                                        setDraggingProductId(p.id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggingProductId(null);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                    }}
                                                    onDrop={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const data = e.dataTransfer.getData("text/plain");
                                                        if (data.startsWith("product:")) {
                                                            const droppedProductId = data.split(":")[1];
                                                            if (droppedProductId === p.id) return;

                                                            const targetGroupId = null;
                                                            const groupProducts = products.filter(item => item.group_id === targetGroupId && item.id !== droppedProductId);
                                                            const targetIndex = groupProducts.findIndex(item => item.id === p.id);

                                                            const reorderedProducts = [...groupProducts];
                                                            reorderedProducts.splice(targetIndex, 0, products.find(item => item.id === droppedProductId)!);

                                                            const orderedIds = reorderedProducts.map(item => item.id);

                                                            setProducts(prev => {
                                                                const otherGroupProducts = prev.filter(item => item.group_id !== targetGroupId && item.id !== droppedProductId);
                                                                const updatedGroupProducts = reorderedProducts.map((item, index) => ({
                                                                    ...item,
                                                                    group_id: targetGroupId,
                                                                    sort_order: index
                                                                }));
                                                                return [...otherGroupProducts, ...updatedGroupProducts].sort((a, b) => {
                                                                    if (a.group_id === b.group_id) {
                                                                        return (a.sort_order || 0) - (b.sort_order || 0);
                                                                    }
                                                                    const aGroup = productGroups.find(pg => pg.id === a.group_id);
                                                                    const bGroup = productGroups.find(pg => pg.id === b.group_id);
                                                                    const aOrder = aGroup ? aGroup.sort_order : 9999;
                                                                    const bOrder = bGroup ? bGroup.sort_order : 9999;
                                                                    return aOrder - bOrder;
                                                                });
                                                            });

                                                            try {
                                                                await reorderProductsInGroup(targetGroupId, orderedIds);
                                                                showToast("success", "商品の並び順を更新しました");
                                                            } catch (err) {
                                                                showToast("error", "商品の並び替えに失敗しました");
                                                                refresh();
                                                            }
                                                        }
                                                    }}
                                                    className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition ${
                                                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1 min-w-0">
                                                                {canEdit && <GripVertical size={14} className="text-slate-300 shrink-0" />}
                                                                <span className="font-mono text-xs font-bold text-blue-600 shrink-0">{p.code}</span>
                                                                <span className="font-bold text-slate-800 truncate">{p.name}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-400">{groups.length}グループ | {groups.reduce((s: number, g: any) => s + g.templates.length, 0)}工程</p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {canEdit && <button onClick={() => duplicateProduct(p)} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition" title="複製"><Copy size={14} /></button>}
                                                            {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition" title="編集"><Edit2 size={14} /></button>}
                                                            {canEdit && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition" title="削除"><Trash2 size={14} /></button>}
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
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}
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
                                        {gi > 0 && (
                                            <div className="mb-3">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">パーツ名</label>
                                                <input type="text" value={group.partLabel || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGroupPartLabel(gi, e.target.value)} placeholder="例: 柄パーツ、鍔パーツ" className="input-base text-sm" />
                                            </div>
                                        )}

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
                                                {gi === 0 && formGroups.length > 1 && (
                                                    <div className="mb-3 bg-white p-2 rounded-lg border border-slate-200">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">パーツ組付け設定（この工程で消費するパーツ）</p>
                                                        {formGroups.filter((_: any, fgi: number) => fgi > 0).map((_: any, idx: number) => {
                                                            const targetGi = idx + 1;
                                                            const targetGroup = formGroups[targetGi];
                                                            const isChecked = (proc.targetGroupIndexes || []).includes(targetGi);
                                                            const targetLabel = targetGroup?.partLabel || targetGroup?.label || `工程登録${targetGi + 1}`;
                                                            return (
                                                                <div key={targetGi} className="flex items-center gap-2 py-0.5">
                                                                    <input type="checkbox" id={`target-cb-${gi}-${pi}-${targetGi}`} checked={isChecked}
                                                                        onChange={() => toggleTargetGroup(gi, pi, targetGi)}
                                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                                                                    <label htmlFor={`target-cb-${gi}-${pi}-${targetGi}`} className="text-[10px] font-bold text-slate-600 cursor-pointer">
                                                                        {targetLabel} を組み付ける
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
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

            {/* グループ作成・編集モーダル */}
            <Modal 
                open={isGroupModalOpen} 
                onClose={() => { setIsGroupModalOpen(false); setGroupFormName(""); setEditGroup(null); }}
                title={editGroup ? "グループを編集" : "グループを作成"}
                width="max-w-md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">グループ名</label>
                        <input 
                            type="text" 
                            value={groupFormName} 
                            onChange={(e) => setGroupFormName(e.target.value)} 
                            placeholder="例: 牛刀シリーズ" 
                            className="input-base" 
                        />
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setIsGroupModalOpen(false); setGroupFormName(""); setEditGroup(null); }} 
                            className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition text-sm"
                        >
                            キャンセル
                        </button>
                        <button 
                            onClick={handleSaveGroup} 
                            disabled={loading}
                            className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:bg-slate-300 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "保存する"}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
                title="商品を削除しますか？" message="この商品に紐づく工程データもすべて削除されます。" confirmLabel="削除する" danger />

            {/* グループ削除の警告ダイアログ */}
            <ConfirmDialog 
                open={!!deleteGroupId} 
                onClose={() => setDeleteGroupId(null)} 
                onConfirm={handleDeleteGroup}
                title="グループを削除しますか？" 
                message="グループを削除すると、そのグループに含まれるすべての商品も削除されます。よろしいですか？" 
                confirmLabel="削除する" 
                danger 
            />
        </div>
    );
}
