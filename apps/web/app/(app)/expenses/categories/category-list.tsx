"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ExpenseCategory, ExpenseGroup } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleCategory, deleteCategory } from "./actions";

interface CategoryListProps {
  groups: ExpenseGroup[];
  categories: ExpenseCategory[];
}

export function CategoryList({ groups, categories }: CategoryListProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleCategory(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("deleteCategoryConfirm"))) return;
    startTransition(async () => {
      await deleteCategory(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const groupCategories = categories.filter(
          (c) => c.groupCode === group.code,
        );
        if (groupCategories.length === 0) return null;

        return (
          <div key={group.code} className="bg-surface-container rounded-xl p-6">
            <h2 className="font-headline text-lg font-semibold text-on-surface mb-4">
              {group.nameEn}
            </h2>
            <div className="space-y-2">
              {groupCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low"
                >
                  <div className="flex items-center gap-3">
                    {cat.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="text-on-surface text-sm font-medium">
                      {cat.name}
                    </span>
                    <span className="text-on-surface/40 text-xs font-mono">
                      {cat.code}
                    </span>
                    {cat.isDefault && (
                      <Badge
                        className="bg-secondary-container/30 text-secondary"
                        variant="outline"
                      >
                        {t("default")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(cat.id)}
                      disabled={isPending}
                    >
                      {cat.active ? t("disable") : t("enable")}
                    </Button>
                    {!cat.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(cat.id)}
                        disabled={isPending}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          delete
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
