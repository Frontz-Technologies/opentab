import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { UserMenu } from "@/components/layout/user-menu";

interface TopBarProps {
  breadcrumbs: { label: string; href?: string }[];
  userName: string;
  userEmail: string;
}

export function TopBar({ breadcrumbs, userName, userEmail }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center px-4 gap-3 bg-surface-dim/70 glass-effect border-b border-on-surface/10">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile sidebar trigger */}
        <div className="md:hidden">
          <SidebarTrigger />
        </div>

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={index} className="flex items-center gap-1.5">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage className="text-on-surface font-medium text-sm">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={crumb.href}
                        className="text-on-surface/60 hover:text-on-surface text-sm transition-colors"
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notifications placeholder */}
        <button className="size-9 flex items-center justify-center rounded-full text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-[22px] leading-none">
            notifications
          </span>
        </button>

        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}
