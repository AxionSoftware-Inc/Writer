"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const activeTheme = mounted ? resolvedTheme ?? theme : "dark";
    const isDark = activeTheme === "dark";

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="site-toggle inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted"
            aria-label="Toggle theme"
        >
            {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
            <span>{isDark ? "Light" : "Dark"}</span>
        </button>
    );
}
