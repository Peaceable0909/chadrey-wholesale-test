import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { Badge, Card, EmptyState, Notice, SearchField, SelectInput } from "@/components/ios";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Avatar } from "@/components/layout/Avatar";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate } from "@/lib/format";
import { getSupabaseClient } from "@/lib/supabase";
import { errorMessage } from "@/lib/supabaseCompat";

type UserRole = "admin" | "user";
type ManagedUser = { id: string; email: string | null; name: string | null; role: UserRole; created_at: string; last_signed_in: string | null };

const COLUMNS = "id,email,name,role,created_at,last_signed_in";
const displayName = (user: ManagedUser) => user.name?.trim() || user.email || "Unnamed account";

async function fetchUsers(): Promise<ManagedUser[]> {
  const { data, error } = await getSupabaseClient().from("profiles").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ManagedUser[];
}

export default function AdminUsers() {
  usePageTitle("Users");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers, enabled: user?.role === "admin", staleTime: 15_000 });
  const [search, setSearch] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ tone: "red" | "green"; text: string } | null>(null);
  // The change waiting for confirmation. It is kept after the sheet closes so its text does not blank out mid-animation.
  const [proposal, setProposal] = React.useState<{ target: ManagedUser; role: UserRole } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function proposeRole(target: ManagedUser, role: UserRole) {
    if (role === target.role) return;
    setMessage(null);
    setProposal({ target, role });
    setConfirmOpen(true);
  }

  async function changeRole(target: ManagedUser, role: UserRole) {
    setMessage(null);
    if (target.id === user?.uid && role !== "admin") {
      setMessage({ tone: "red", text: "You cannot remove your own administrator access from this screen." });
      return;
    }
    setSavingId(target.id);
    const { data, error } = await getSupabaseClient().from("profiles").update({ role }).eq("id", target.id).select(COLUMNS).single();
    setSavingId(null);
    if (error) {
      setMessage({ tone: "red", text: errorMessage(error) });
      return;
    }
    queryClient.setQueryData<ManagedUser[]>(["admin-users"], current => (current ?? []).map(item => (item.id === target.id ? (data as ManagedUser) : item)));
    setMessage({ tone: "green", text: `${displayName(target)} is now ${role === "admin" ? "an administrator" : "a customer"}.` });
  }

  const term = search.trim().toLowerCase();
  const visible = (users.data ?? []).filter(item => !term || `${item.name ?? ""} ${item.email ?? ""}`.toLowerCase().includes(term));

  return (
    <AdminLayout title="Users" subtitle="Everyone with an account, and who can open the admin area." width="form">
      <div className="space-y-4">
        <SearchField value={search} onValueChange={setSearch} placeholder="Search by name or email" />
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        {users.isError && <Notice tone="red">{errorMessage(users.error, "We could not load the users.")}</Notice>}

        {users.isPending ? (
          <p className="py-10 text-center text-subhead text-label-2">Loading users…</p>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState icon={Users} title={term ? "No matching users" : "No registered users yet"} description={term ? "Try a different name or email." : "New accounts appear here automatically."} />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {visible.map(item => {
                const isSelf = item.id === user?.uid;
                return (
                  // On phones the role picker drops under the details so names and emails are never cut short.
                  <li key={item.id} className="row-separator flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 [--sep-inset:68px]">
                    <Avatar name={item.name} email={item.email} className="size-10" />
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="flex items-center gap-2 text-body font-semibold">
                        <span className="truncate">{displayName(item)}</span>
                        {isSelf && <Badge tone="blue">You</Badge>}
                      </p>
                      <p className="truncate text-subhead text-label-2">{item.email || "No email"}</p>
                      <p className="flex flex-wrap gap-x-1.5 text-footnote text-label-2">
                        <span className="whitespace-nowrap">Joined {formatDate(item.created_at)}</span>
                        <span aria-hidden>·</span>
                        <span className="whitespace-nowrap">{item.last_signed_in ? `Active ${formatDate(item.last_signed_in)}` : "Never signed in"}</span>
                      </p>
                    </div>
                    <div className="w-full pl-[52px] sm:w-auto sm:pl-0">
                      <div className="w-44">
                        <SelectInput
                          value={item.role}
                          disabled={savingId === item.id || isSelf}
                          onChange={event => proposeRole(item, event.target.value as UserRole)}
                          aria-label={`Access level for ${displayName(item)}`}
                          className="h-10 text-subhead">
                          <option value="user">Customer</option>
                          <option value="admin">Admin</option>
                        </SelectInput>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <p className="flex items-center justify-center gap-1.5 text-footnote text-label-2">
          <ShieldCheck className="size-4" aria-hidden /> Role changes are enforced by the database, not just this screen.
        </p>
      </div>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={proposal?.role === "admin" ? "Make administrator?" : "Remove admin access?"}
        description={
          proposal?.role === "admin"
            ? `${proposal ? displayName(proposal.target) : "This person"} will be able to open the admin area, read every quote request and edit products.`
            : `${proposal ? displayName(proposal.target) : "This person"} will become a customer and lose access to the admin area.`
        }
        confirmLabel={proposal?.role === "admin" ? "Make administrator" : "Make customer"}
        destructive={proposal?.role !== "admin"}
        loading={proposal !== null && savingId === proposal.target.id}
        onConfirm={async () => {
          if (proposal) await changeRole(proposal.target, proposal.role);
          setConfirmOpen(false);
        }}
      />
    </AdminLayout>
  );
}
