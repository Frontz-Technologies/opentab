import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { IMPORTERS } from "@/lib/import/importers";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ entity: string }>;
}) {
  const { entity } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner" && session.role !== "admin") {
    redirect(`/${entity}`);
  }
  const importer = IMPORTERS[entity];
  if (!importer) notFound();

  return (
    <div className="p-6">
      <ImportWizard
        entityKey={entity}
        entityLabel={importer.label}
        fields={importer.fields.map((f) => ({
          name: f.name,
          required: f.required,
        }))}
      />
    </div>
  );
}
