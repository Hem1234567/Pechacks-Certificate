import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  db,
  type Organisation,
  type Department,
  type OrgClass,
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
  GraduationCap,
  Loader2,
  Plus,
  X,
  Award,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/org/$orgId/dept/$deptId")({
  component: DeptDetailPage,
});

function DeptDetailPage() {
  const { orgId, deptId } = Route.useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organisation | null>(null);
  const [dept, setDept] = useState<Department | null>(null);
  const [classes, setClasses] = useState<OrgClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, [orgId, deptId]);

  async function loadAll() {
    setLoading(true);
    try {
      // Load org
      const orgSnap = await getDoc(doc(db, "organisations", orgId));
      if (orgSnap.exists()) setOrg({ id: orgSnap.id, ...orgSnap.data() } as Organisation);

      // Load dept
      const deptSnap = await getDoc(
        doc(db, "organisations", orgId, "departments", deptId)
      );
      if (!deptSnap.exists()) {
        toast.error("Department not found");
        navigate({ to: "/org/$orgId", params: { orgId } });
        return;
      }
      setDept({ id: deptSnap.id, orgId, ...deptSnap.data() } as Department);

      // Load classes
      const classSnap = await getDocs(
        query(
          collection(db, "organisations", orgId, "departments", deptId, "classes"),
          orderBy("createdAt", "desc")
        )
      );
      setClasses(
        classSnap.docs.map(
          (d) => ({ id: d.id, orgId, deptId, ...d.data() } as OrgClass)
        )
      );
    } catch (e: any) {
      toast.error("Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    try {
      // 1. Create a project doc (the certificate workspace)
      const projectRef = await addDoc(collection(db, "projects"), {
        name: `${dept?.name} — ${newClassName.trim()}`,
        createdAt: new Date().toISOString(),
        orgId,
        deptId,
      });

      // 2. Create class doc linking to project
      const classRef = await addDoc(
        collection(db, "organisations", orgId, "departments", deptId, "classes"),
        {
          name: newClassName.trim(),
          createdAt: new Date().toISOString(),
          projectId: projectRef.id,
        }
      );

      toast.success("Class created!");
      setShowModal(false);
      setNewClassName("");

      // Navigate straight to the class certificate dashboard
      navigate({
        to: "/project/$projectId",
        params: { projectId: projectRef.id },
      });
    } catch (e: any) {
      toast.error(e.message);
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
              onClick={() => navigate({ to: "/org/$orgId", params: { orgId } })}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            {/* Breadcrumb in header */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground hidden sm:inline">{org?.name}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:inline" />
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold text-navy leading-none">
                  {dept?.name}
                </h1>
                <p className="text-xs text-muted-foreground">Department</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => { setNewClassName(""); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#1e40af" }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Class</span>
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
          <span
            className="hover:text-foreground cursor-pointer transition-colors"
            onClick={() => navigate({ to: "/org/$orgId", params: { orgId } })}
          >
            {org?.name}
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{dept?.name}</span>
        </div>

        {/* Section title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-2xl text-navy">Classes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Click a class to open its certificate dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
              {classes.length} {classes.length === 1 ? "class" : "classes"}
            </span>
            <button
              onClick={() => { setNewClassName(""); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <GraduationCap className="h-7 w-7 text-blue-500" />
            </div>
            <h3 className="font-serif text-xl text-foreground">No classes yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Create a class to get a full certificate generation dashboard with templates and bulk tools.
            </p>
            <button
              onClick={() => { setNewClassName(""); setShowModal(true); }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#1e40af" }}
            >
              <Plus className="h-4 w-4" />
              Create First Class
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() =>
                  navigate({
                    to: "/project/$projectId",
                    params: { projectId: cls.projectId },
                  })
                }
                className="group flex flex-col items-start rounded-2xl border border-border bg-card p-6 shadow-sm text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                  <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-base text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {cls.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(cls.createdAt).toLocaleDateString()}
                </p>

                {/* Org shared templates badge */}
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Award className="h-3 w-3" />
                  Org templates shared
                </div>

                <div className="mt-4 flex w-full items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Open Dashboard</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Info card: org templates */}
        <div className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-5">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Organisation Templates are shared with all classes
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Templates created at the organisation level (in <strong>{org?.name}</strong>) are automatically available in every class's certificate dashboard.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Create Class Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Create Class</h3>
                  <p className="text-xs text-muted-foreground">under {dept?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateClass}>
              <div className="p-6">
                <label className="mb-1.5 block text-sm font-medium">
                  Class Name <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  autoFocus
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. CSE-A 2025"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  A certificate dashboard will be created automatically for this class.
                </p>
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
                  style={{ backgroundColor: "#1e40af" }}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
