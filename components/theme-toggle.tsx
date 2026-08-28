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
    const nextThemeLabel = isDark ? "Light mode" : "Dark mode";

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="site-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
        >
            {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        </button>
    );
}
