"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Contact } from "@opentab/db/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

interface ContactListProps {
  contacts: Contact[];
}

const typeColors: Record<string, string> = {
  client: "bg-primary text-on-primary",
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
        <AnimatedFilterBar
          items={[
            { value: "all", label: t("filterAll") },
            { value: "client", label: t("filterClients") },
            { value: "supplier", label: t("filterSuppliers") },
          ]}
          value={typeFilter}
          onValueChange={setTypeFilter}
        />
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
        <>
          <div className="hidden md:block">
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
          </div>

          <div className="block md:hidden space-y-3">
            {filtered.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="block bg-surface-container rounded-xl p-4 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-label text-lg font-bold text-on-surface">
                    {contact.displayName}
                  </span>
                  <Badge
                    className={typeColors[contact.type] || ""}
                    variant="outline"
                  >
                    {contact.type}
                  </Badge>
                </div>
                <p className="text-sm text-on-surface-variant mb-1">
                  {contact.email || "\u2014"}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {contact.phone || "\u2014"}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
