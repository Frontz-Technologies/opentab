"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ExpenseCategory } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory } from "./actions";

interface CategoryTreeProps {
  categories: ExpenseCategory[];
  orgId: string;
}

export function CategoryTree({ categories, orgId }: CategoryTreeProps) {
  const t = useTranslations("expenseCategories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [newColor, setNewColor] = useState("#6B7280");

  const rootCategories = categories
    .filter((c) => c.depth === 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function getChildren(parentId: string) {
    return categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function handleAdd() {
    const formData = new FormData();
    formData.set("code", newCode);
    formData.set("nameEn", newName);
    formData.set("parentId", newParentId);
    formData.set("color", newColor);

    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.success) {
        setShowAdd(false);
        setNewCode("");
        setNewName("");
        setNewParentId("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      await deleteCategory(id);
      router.refresh();
    });
  }

  function renderCategory(cat: ExpenseCategory, indent: number) {
    const children = getChildren(cat.id);
    const isSystem = cat.orgId === null;

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors rounded-lg"
          style={{ paddingLeft: `${16 + indent * 24}px` }}
        >
          {cat.color && (
            <div
              className="size-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color }}
            />
          )}
          {cat.icon && (
            <span className="material-symbols-outlined text-[18px] text-on-surface/40">
              {cat.icon}
            </span>
          )}
          <span className="text-on-surface text-sm font-medium flex-1">
            {cat.nameEn}
          </span>
          <span className="text-on-surface/30 text-xs font-mono">
            {cat.code}
          </span>
          {isSystem ? (
            <Badge
              className="bg-surface-container-low text-on-surface/40"
              variant="outline"
            >
              <span className="material-symbols-outlined text-[12px] mr-0.5">
                lock
              </span>
              {t("systemCategory")}
            </Badge>
          ) : (
            <button
              onClick={() => handleDelete(cat.id)}
              className="text-on-surface/30 hover:text-red-400 transition-colors"
              disabled={isPending}
            >
              <span className="material-symbols-outlined text-[16px]">
                delete
              </span>
            </button>
          )}
        </div>
        {children.map((child) => renderCategory(child, indent + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container rounded-xl overflow-hidden py-2">
        {rootCategories.map((cat) => renderCategory(cat, 0))}
        {rootCategories.length === 0 && (
          <p className="text-center py-8 text-on-surface/50 text-sm">
            {t("noCategories")}
          </p>
        )}
      </div>

      {showAdd ? (
        <div className="bg-surface-container rounded-xl p-6 space-y-4">
          <h3 className="font-headline text-lg font-semibold text-on-surface">
            {t("addCategory")}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-label text-sm text-on-surface/60">
                {t("code")}
              </label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. operating.custom"
              />
            </div>
            <div className="space-y-2">
              <label className="font-label text-sm text-on-surface/60">
                {t("nameEn")}
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-label text-sm text-on-surface/60">
                {t("parent")}
              </label>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface text-sm"
              >
                <option value="">{t("noParent")}</option>
                {categories
                  .filter((c) => c.depth < 2)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {"  ".repeat(c.depth)}
                      {c.nameEn}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-sm text-on-surface/60">
                {t("color")}
              </label>
              <Input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 p-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAdd}
              disabled={isPending || !newCode || !newName}
            >
              {t("addCategory")}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)}>
          <span className="material-symbols-outlined text-[16px] mr-1">
            add
          </span>
          {t("addCategory")}
        </Button>
      )}
    </div>
  );
}
