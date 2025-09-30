"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const ThemeToggle = forwardRef<HTMLButtonElement, { className?: string }>(
  ({ className, ...props }, ref) => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    const toggle = () => {
      setTheme(theme === "dark" ? "light" : "dark");
    };

    if (!mounted) {
      return null;
    }

    return (
      <Button
        ref={ref}
        {...props}
        aria-label="Toggle theme"
        title="Toggle theme"
        variant="ghost"
        size="icon"
        className={cn("size-7 rounded-md", className)}
        onClick={toggle}
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    );
  }
);

ThemeToggle.displayName = "ThemeToggle";