"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSupabaseData } from "@/lib/useSupabaseData";

export type FontSize = "small" | "large";

interface FontSizeContextType {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType>({
    fontSize: "small",
    setFontSize: () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
    const { profile } = useSupabaseData();
    const [fontSize, setFontSizeState] = useState<FontSize>("small");

    // 初期化：localStorage または profile.font_size
    useEffect(() => {
        const saved = localStorage.getItem("towmei_font_size") as FontSize | null;
        if (saved === "large" || saved === "small") {
            setFontSizeState(saved);
        } else if (profile?.font_size === "large" || profile?.font_size === "small") {
            setFontSizeState(profile.font_size);
        }
    }, [profile?.font_size]);

    const setFontSize = (size: FontSize) => {
        setFontSizeState(size);
        localStorage.setItem("towmei_font_size", size);
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-font-size", size);
        }
    };

    // DOM要素属性の初期・変更同期
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("data-font-size", fontSize);
        }
    }, [fontSize]);

    return (
        <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
            {children}
        </FontSizeContext.Provider>
    );
}

export function useFontSize() {
    return useContext(FontSizeContext);
}
