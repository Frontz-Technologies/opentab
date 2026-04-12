"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Contact } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContactListProps {
  contacts: Contact[];
}

const typeColors: Record<string, string> = {
  client: "bg-emerald-500/20 text-emerald-400",
  supplier: "bg-amber-500/20 text-amber-400",
  both: "bg-blue-500/20 text-blue-400",
};

export function ContactList({ contacts }: ContactListProps) {
  const t = useTranslations("contacts");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.vatNumber?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || c.type === typeFilter;

    return matchesSearch && matchesType;
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
        <div className="flex gap-1">
          {["all", "client", "supplier"].map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type)}
            >
              {type === "all"
                ? t("filterAll")
                : type === "client"
                  ? t("filterClients")
                  : t("filterSuppliers")}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-on-surface/50">
          <span className="material-symbols-outlined text-4xl mb-2 block">
            contacts
          </span>
          <p className="font-label">{t("noContacts")}</p>
          <p className="text-sm mt-1">{t("noContactsDescription")}</p>
        </div>
      ) : (
        <div className="bg-surface-container rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-on-surface/10">
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("company")} / Name
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("type")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("email")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("phone")}
                </th>
                <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                  {t("vatNumber")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-on-surface/5 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="text-on-surface hover:text-primary transition-colors font-medium"
                    >
                      {contact.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={typeColors[contact.type] || ""}
                      variant="outline"
                    >
                      {contact.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {contact.email || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm">
                    {contact.phone || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-on-surface/60 text-sm font-mono">
                    {contact.vatNumber || "\u2014"}
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
