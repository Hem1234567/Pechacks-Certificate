import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  db,
  type Organisation,
  type Department,
} from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FolderOpen,
  Loader2,
  Plus,
  X,
  Users,
  Layout,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/org/$orgId/")({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organisation | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, [orgId]);

  async function loadAll() {
    setLoading(true);
    try {
      // Load org
      const orgSnap = await getDoc(doc(db, "organisations", orgId));
      if (!orgSnap.exists()) {
        toast.error("Organisation not found");
        navigate({ to: "/admin" });
        return;
      }
      setOrg({ id: orgSnap.id, ...orgSnap.data() } as Organisation);

      // Load departments
      const deptSnap = await getDocs(
        query(
          collection(db, "organisations", orgId, "departments"),
          orderBy("createdAt", "desc")
        )
      );
      setDepartments(
        deptSnap.docs.map((d) => ({ id: d.id, orgId, ...d.data() } as Department))
      );
    } catch (e: any) {
      toast.error("Failed to load organisation: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDept(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setCreating(true);
    try {
      const ref = await addDoc(
        collection(db, "organisations", orgId, "departments"),
        { name: newDeptName.trim(), createdAt: new Date().toISOString() }
      );
      toast.success("Department created!");
      setShowModal(false);
      setNewDeptName("");
      setDepartments((prev) => [
        { id: ref.id, orgId, name: newDeptName.trim(), createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/admin" })}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold text-navy leading-none">
                  {org?.name}
                </h1>
                <p className="text-xs text-muted-foreground">Organisation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => { setNewDeptName(""); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Department</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="hover:text-foreground cursor-pointer transition-colors"
            onClick={() => navigate({ to: "/admin" })}
          >
            Dashboard
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{org?.name}</span>
        </div>

        {/* Stats row */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {[
            {
              label: "Departments",
              value: departments.length,
              icon: <FolderOpen className="h-5 w-5" />,
              color: "text-purple-600",
              bg: "bg-purple-50 dark:bg-purple-900/20",
            },
            {
              label: "Total Classes",
              value: "—",
              icon: <Users className="h-5 w-5" />,
              color: "text-blue-600",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              label: "Shared Templates",
              value: "—",
              icon: <Layout className="h-5 w-5" />,
              color: "text-amber-600",
              bg: "bg-amber-50 dark:bg-amber-900/20",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </span>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
                  {s.icon}
                </span>
              </div>
              <p className="font-serif text-3xl text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Section title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="font-serif text-2xl text-navy">Departments</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Select a department to manage its classes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: "/org/$orgId/templates", params: { orgId } })}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-100 transition-colors dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/40"
            >
              <Layout className="h-4 w-4" />
              Manage Templates
            </button>
            <button
              onClick={() => { setNewDeptName(""); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>
        </div>

        {departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20">
              <FolderOpen className="h-7 w-7 text-purple-500" />
            </div>
            <h3 className="font-serif text-xl text-foreground">No departments yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Create your first department to start organising classes and certificates.
            </p>
            <button
              onClick={() => { setNewDeptName(""); setShowModal(true); }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              <Plus className="h-4 w-4" />
              Create First Department
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                onClick={() =>
                  navigate({
                    to: "/org/$orgId/dept/$deptId",
                    params: { orgId, deptId: dept.id },
                  })
                }
                className="group flex flex-col items-start rounded-2xl border border-border bg-card p-6 shadow-sm text-left hover:border-purple-400 hover:shadow-md transition-all"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
                  <FolderOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-base text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                  {dept.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(dept.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-4 flex w-full items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">View Classes</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ── Create Department Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <FolderOpen className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-base">Create Department</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDept}>
              <div className="p-6">
                <label className="mb-1.5 block text-sm font-medium">
                  Department Name <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  autoFocus
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: "#1e3a5f" }}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
