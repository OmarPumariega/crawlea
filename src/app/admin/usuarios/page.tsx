import { listAdminUsers } from "@/lib/admin/users";
import PageHeader from "@/components/app/PageHeader";
import UsersTable from "@/components/admin/UsersTable";

export default async function AdminUsuariosPage() {
  const users = await listAdminUsers();
  const dto = users.map((u) => ({
    ...u,
    lastUsageAt: u.lastUsageAt ? u.lastUsageAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Usuarios"
        description={`${users.length} ${users.length === 1 ? "cuenta" : "cuentas"} en la plataforma.`}
      />
      <UsersTable users={dto} />
    </div>
  );
}
