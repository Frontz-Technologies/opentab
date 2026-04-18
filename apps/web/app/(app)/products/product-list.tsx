"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Product } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ProductListProps {
  products: Product[];
}

const taxCategoryLabels: Record<string, string> = {
  standard: "taxStandard",
  reduced: "taxReduced",
  super_reduced: "taxSuperReduced",
  zero_rated: "taxZeroRated",
  exempt: "taxExempt",
  reverse_charge: "taxReverseCharge",
};

export function ProductList({ products }: ProductListProps) {
  const t = useTranslations("products");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = products.filter((p) => {
    const matchesSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesActive = showInactive || p.active;
    return matchesSearch && matchesActive;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm text-on-surface/60 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          {t("showInactive")}
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-on-surface/50">
          <span className="material-symbols-outlined text-4xl mb-2 block">
            inventory_2
          </span>
          <p className="font-label">{t("noProducts")}</p>
          <p className="text-sm mt-1">{t("noProductsDescription")}</p>
        </div>
      ) : (
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-on-surface/10">
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("name")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("unitPrice")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("unit")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("taxCategory")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${product.id}`}
                      className="text-on-surface hover:text-primary transition-colors font-medium"
                    >
                      {product.name}
                    </Link>
                    {product.description && (
                      <p className="text-xs text-on-surface/40 mt-0.5">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-on-surface font-label text-sm">
                    {product.unitPrice}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {product.unit}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {t(taxCategoryLabels[product.taxCategory] || "taxStandard")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        product.active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-highest text-on-surface/40"
                      }
                      variant="outline"
                    >
                      {product.active ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
