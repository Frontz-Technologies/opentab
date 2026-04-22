"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // When search / filter changes and we are past page 1, reset to
  // page 1. Otherwise the current URL `?page=N` keeps the server slice
  // anchored on the wrong window (e.g. filtering to "Suppliers" from
  // page 2 shows an empty page because suppliers are on page 1). Does
  // not fully fix server-side-filtering correctness — that's tracked
  // separately — but it eliminates the confusing empty-page case.
  const resetPageIfNeeded = () => {
    const current = searchParams.get("page");
    if (current && current !== "1") {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `/contacts?${qs}` : "/contacts", { scroll: false });
    }
  };

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
          onChange={(e) => {
            setSearch(e.target.value);
            resetPageIfNeeded();
          }}
          className="max-w-sm"
        />
        <AnimatedFilterBar
          items={[
            { value: "all", label: t("filterAll") },
            { value: "client", label: t("filterClients") },
            { value: "supplier", label: t("filterSuppliers") },
          ]}
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            resetPageIfNeeded();
          }}
        />
      </div>

      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
              contacts
            </span>
            <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
              {t("noContacts")}
            </h3>
            <p className="text-sm text-on-surface-variant max-w-sm mb-6">
              {t("noContactsDescription")}
            </p>
            <Link
              href="/contacts/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("addContact")}
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              search_off
            </span>
            <p className="text-sm">{t("noResultsMatch")}</p>
          </div>
        )
      ) : (
        <>
          <div className="hidden md:block">
            <div className="bg-surface-container rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-on-surface/10">
                    <th className="text-left px-4 py-3 font-label text-sm text-on-surface/60">
                      {t("company")} / {t("contactName")}
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
                          {t(
                            `type${contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}`,
                          )}
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
