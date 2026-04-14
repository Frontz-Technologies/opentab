"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  heading: string;
  headingPrefix?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  userName: string;
  userEmail: string;
}

export function PageHeader({
  heading,
  headingPrefix,
  onBack,
  actions,
  userName,
  userEmail,
}: PageHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 transition-all duration-300 ease-out",
        "bg-surface-dim/80 supports-[backdrop-filter]:bg-surface-dim/60 backdrop-blur-xl",
        "border-b",
        isScrolled
          ? "border-outline-variant/15 shadow-sm"
          : "border-transparent shadow-none",
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>

          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="size-8 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">
                arrow_back
              </span>
            </Button>
          )}

          <div className="flex min-w-0 items-center gap-3">
            {headingPrefix && (
              <>
                <span className="truncate font-headline text-sm font-semibold text-on-surface-variant">
                  {headingPrefix}
                </span>
                <div className="h-5 w-px bg-outline-variant/30" />
              </>
            )}
            <h1 className="truncate font-headline text-lg font-semibold text-on-surface">
              {heading}
            </h1>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {actions}

          <button className="flex size-9 items-center justify-center rounded-full text-on-surface/60 transition-colors hover:bg-surface-container-low hover:text-on-surface">
            <span className="material-symbols-outlined text-[22px] leading-none">
              notifications
            </span>
          </button>

          <UserMenu name={userName} email={userEmail} />
        </div>
      </div>
    </header>
  );
}
