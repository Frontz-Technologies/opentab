"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Package, Plus, X } from "lucide-react";
import type { Product } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateLineTotal } from "@/lib/invoicing/calculations";
import { cn } from "@/lib/utils";

export interface LineItem {
  id: string;
  productId: string;
  sortOrder: number;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  taxCategory: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

interface LineItemsBuilderProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products?: Product[];
  defaultTaxRate: string;
  usesInclusiveTax: boolean;
  /** Line-item IDs currently in receipt-extraction preview state. */
  previewIds?: Set<string>;
  /** Fires the first time a previewed row's cell is edited. */
  onItemEdit?: (id: string) => void;
}

function createEmptyItem(sortOrder: number, defaultTaxRate: string): LineItem {
  return {
    id: crypto.randomUUID(),
    productId: "",
    sortOrder,
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "0.00",
    unit: "",
    taxCategory: "standard",
    taxRate: defaultTaxRate,
    taxAmount: "0.00",
    lineTotal: "0.00",
  };
}

function recalcItem(item: LineItem, usesInclusiveTax: boolean): LineItem {
  const result = calculateLineTotal({
    quantity: item.quantity || "0",
    unitPrice: item.unitPrice || "0",
    taxRate: item.taxRate || "0",
    usesInclusiveTax,
  });
  return { ...item, taxAmount: result.taxAmount, lineTotal: result.lineTotal };
}

export function LineItemsBuilder({
  items,
  onChange,
  products,
  defaultTaxRate,
  usesInclusiveTax,
  previewIds,
  onItemEdit,
}: LineItemsBuilderProps) {
  const t = useTranslations("invoices");

  const updateItem = useCallback(
    (index: number, field: keyof LineItem, value: string) => {
      const updated = [...items];
      const target = updated[index];
      if (target && previewIds?.has(target.id)) {
        onItemEdit?.(target.id);
      }
      updated[index] = { ...target, [field]: value };
      updated[index] = recalcItem(updated[index], usesInclusiveTax);
      onChange(updated);
    },
    [items, onChange, usesInclusiveTax, previewIds, onItemEdit],
  );

  const addItem = useCallback(() => {
    const newItem = createEmptyItem(items.length, defaultTaxRate);
    onChange([...items, newItem]);
  }, [items, onChange, defaultTaxRate]);

  const addFromProduct = useCallback(
    (product: Product) => {
      const newItem: LineItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        sortOrder: items.length,
        name: product.name,
        description: product.description ?? "",
        quantity: "1",
        unitPrice: product.unitPrice,
        unit: product.unit,
        taxCategory: product.taxCategory,
        taxRate: product.vatRate ?? defaultTaxRate,
        taxAmount: "0.00",
        lineTotal: "0.00",
      };
      const recalced = recalcItem(newItem, usesInclusiveTax);
      onChange([...items, recalced]);
    },
    [items, onChange, defaultTaxRate, usesInclusiveTax],
  );

  const removeItem = useCallback(
    (index: number) => {
      const updated = items.filter((_, i) => i !== index);
      updated.forEach((item, i) => (item.sortOrder = i));
      onChange(updated);
    },
    [items, onChange],
  );

  const moveItem = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= items.length) return;
      const updated = [...items];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      updated.forEach((item, i) => (item.sortOrder = i));
      onChange(updated);
    },
    [items, onChange],
  );

  const [showProductPicker, setShowProductPicker] = useState(false);

  // When the inclusive-tax toggle flips, recompute taxAmount/lineTotal for
  // every existing row. Without this, rows added before the flip keep stale
  // values until the user manually edits them.
  useEffect(() => {
    let dirty = false;
    const updated = items.map((item) => {
      const recalced = recalcItem(item, usesInclusiveTax);
      if (
        recalced.taxAmount !== item.taxAmount ||
        recalced.lineTotal !== item.lineTotal
      ) {
        dirty = true;
        return recalced;
      }
      return item;
    });
    if (dirty) onChange(updated);
    // We intentionally only depend on the toggle. Including `items` would
    // make every normal edit re-trigger this effect (and recalcItem already
    // runs inside updateItem/addFromProduct for the row being edited).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usesInclusiveTax]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const net = usesInclusiveTax
      ? parseFloat(item.lineTotal || "0") - parseFloat(item.taxAmount || "0")
      : parseFloat(item.quantity || "0") * parseFloat(item.unitPrice || "0");
    return sum + net;
  }, 0);
  const totalTax = items.reduce(
    (sum, item) => sum + parseFloat(item.taxAmount || "0"),
    0,
  );
  const total = subtotal + totalTax;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {products && products.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowProductPicker(!showProductPicker)}
          >
            <Package className="h-4 w-4 mr-1" />
            {t("addFromCatalogue")}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" />
          {t("addItem")}
        </Button>
      </div>

      {showProductPicker && products && (
        <div className="bg-surface-container-low rounded-lg p-3 space-y-1">
          {products
            .filter((p) => p.active)
            .map((product) => (
              <button
                key={product.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded hover:bg-surface-container transition-colors text-sm"
                onClick={() => {
                  addFromProduct(product);
                  setShowProductPicker(false);
                }}
              >
                <span className="font-medium text-on-surface">
                  {product.name}
                </span>
                <span className="text-on-surface/50 ml-2">
                  {product.unitPrice} / {product.unit}
                </span>
              </button>
            ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 text-on-surface/50 text-sm">
          {t("noLineItems", { action: t("addItem") })}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_100px_80px_100px_100px_40px] gap-2 px-2 text-xs font-label text-on-surface/60">
            <span>{t("itemName")}</span>
            <span>{t("quantity")}</span>
            <span>{t("unitPrice")}</span>
            <span>{t("taxRate")}</span>
            <span>{t("taxAmount")}</span>
            <span className="text-right">{t("lineTotal")}</span>
            <span />
          </div>

          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "grid grid-cols-[1fr_80px_100px_80px_100px_100px_40px] gap-2 items-center bg-surface-container rounded-lg p-2",
                previewIds?.has(item.id) &&
                  "bg-primary/10 outline outline-1 outline-primary/15 outline-offset-0 transition-colors duration-200",
              )}
            >
              <div className="space-y-1">
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder={t("itemName")}
                  className="h-8 text-sm"
                />
                <Input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, "description", e.target.value)
                  }
                  placeholder={t("itemDescription")}
                  className="h-7 text-xs text-on-surface/60"
                />
              </div>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                className="h-8 text-sm text-right font-mono"
                min="0"
                step="0.01"
              />
              <Input
                type="number"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                className="h-8 text-sm text-right font-mono"
                min="0"
                step="0.01"
              />
              <Input
                type="number"
                value={item.taxRate}
                onChange={(e) => updateItem(index, "taxRate", e.target.value)}
                className="h-8 text-sm text-right font-mono"
                min="0"
                step="0.01"
              />
              <span className="text-sm text-on-surface/60 font-mono text-right px-2">
                {item.taxAmount}
              </span>
              <span className="text-sm text-on-surface font-mono text-right font-medium px-2">
                {item.lineTotal}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  className="text-on-surface/40 hover:text-on-surface text-xs leading-none"
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-tertiary/60 hover:text-tertiary text-xs leading-none"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  className="text-on-surface/40 hover:text-on-surface text-xs leading-none"
                  disabled={index === items.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-on-surface/60">
              <span>{t("subtotal")}</span>
              <span className="font-mono">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-on-surface/60">
              <span>{t("taxAmount")}</span>
              <span className="font-mono">{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-on-surface font-semibold border-t border-on-surface/10 pt-1">
              <span>{t("totalAmount")}</span>
              <span className="font-mono">{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
