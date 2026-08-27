import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import "./globals.css";
import "./premium-ui.css";
import { ThemeProvider } from "@/components/theme-provider";

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-inter",
});

const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair",
});

export const metadata: Metadata = {
    title: "MathSphere Writer",
    description: "Standalone scientific writing workspace extracted from the Mathematics monolith.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="uz" suppressHydrationWarning>
            <body className={`${manrope.variable} ${playfair.variable} min-h-screen`}>
                <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
