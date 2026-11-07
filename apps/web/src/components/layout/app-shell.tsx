import { Outlet, useLoaderData } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { Sidebar, MobileSidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { Button } from "../ui/button";
import { ToastProvider } from "../ui/toast";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const { user } = useUser();

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    // Use type assertion to ensure proper typing
    const themeValue = (saved === "light" || saved === "dark" || saved === "system")
      ? (saved as "light" | "dark" | "system")
      : null;
    if (themeValue) {
      setTheme(themeValue);
      applyTheme(themeValue);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, [theme]);

  const applyTheme = (themeValue: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (themeValue === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", themeValue);
    }
  };

  const handleThemeToggle = () => {
    const themes: readonly ["light", "dark", "system"] = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme);
    if (currentIndex === -1) return;
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  };

  const userData = user
    ? {
        // @ts-ignore - Clerk user object has fullName/firstName
        name: user.fullName ?? user.firstName ?? null,
        // @ts-ignore - Clerk user object has primaryEmailAddress
        email: user.primaryEmailAddress?.emailAddress ?? null,
        // @ts-ignore - Clerk user object has imageUrl
        image: user.imageUrl ?? null,
        initials: user.fullName
          ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
          : user.firstName
          ? user.firstName[0].toUpperCase()
          : "U",
      }
    : undefined;

  // @ts-ignore - Clerk user object has fullName/firstName properties
  const _userTypeCheck = user;

  return (
    <ToastProvider position="top-right">
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Mobile sidebar overlay */}
        <MobileSidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          user={userData}
          onSignOut={() => {}}
        />

        {/* Desktop sidebar */}
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          user={userData}
          onSignOut={() => {}}
        />

        {/* Top bar */}
        <TopBar
          onMenuClick={() => setMobileSidebarOpen(true)}
          user={userData}
          onSignOut={() => {}}
          onThemeToggle={handleThemeToggle}
          theme={theme}
        />

        {/* Main content */}
        <main
          id="main-content"
          className={`
            min-h-screen pt-16 lg:pt-0
            transition-all duration-normal ease-out
            ${sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[256px]"}
          `}
          tabIndex={-1}
        >
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>

        {/* Skip link for accessibility */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
      </div>
    </ToastProvider>
  );
}