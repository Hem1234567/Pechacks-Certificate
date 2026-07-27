import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, auth, type Project } from "@/integrations/firebase/client";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { toast } from "sonner";
import { Plus, LogOut, Folder, Layout, ArrowRight, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Projects — Admin Dashboard" }],
  }),
  component: ProjectsDashboard,
});

function ProjectsDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(list);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, "projects"), {
        name: newProjectName.trim(),
        createdAt: new Date().toISOString(),
      });
      toast.success("Project created successfully!");
      navigate({ to: "/project/$projectId", params: { projectId: docRef.id } });
    } catch (e: any) {
      toast.error(e.message);
      setCreating(false);
    }
  }

  function signOut() {
    auth.signOut().then(() => navigate({ to: "/" }));
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-serif text-xl font-semibold text-navy">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>
      
      <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-3xl text-navy">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage your event workspaces</p>
          </div>
          <button 
            onClick={() => { setNewProjectName(""); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-navy-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Create project
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* The default project fallback for legacy data */}
            <Link 
              to="/project/$projectId" 
              params={{ projectId: "default" }}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-navy hover:shadow-md"
            >
              <div>
                <div className="mb-4 inline-flex rounded-xl bg-accent p-3 text-foreground">
                  <Folder className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg text-foreground group-hover:text-navy transition-colors">Default Project</h3>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">Legacy certificates and templates that are not assigned to a project.</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs font-medium text-muted-foreground">Legacy Data</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
              </div>
            </Link>
            
            {projects.map((project) => (
              <Link 
                key={project.id}
                to="/project/$projectId" 
                params={{ projectId: project.id }}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-navy hover:shadow-md"
              >
                <div>
                  <div className="mb-4 inline-flex rounded-xl bg-accent p-3 text-foreground">
                    <Layout className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-navy transition-colors">{project.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Workspace for certificates and templates.</p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs font-medium text-muted-foreground">Created {new Date(project.createdAt).toLocaleDateString()}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-semibold text-lg">Create New Project</h3>
              <button onClick={() => setShowModal(false)} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="p-6">
                <label className="mb-1.5 block text-sm font-medium">Project Name *</label>
                <input
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="e.g. Hackathon 2026"
                  autoFocus
                />
              </div>
              <div className="border-t border-border bg-muted/30 px-6 py-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm hover:bg-accent font-medium">Cancel</button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm text-navy-foreground hover:opacity-90 font-medium disabled:opacity-50">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
