import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ArrowLeft, Layout as LayoutIcon, FileSpreadsheet, Eye, FolderArchive } from "lucide-react";
import { auth, db, type Project } from "@/integrations/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    async function loadProject() {
      // Allow the fallback "default" project for existing records
      if (projectId === "default") {
        setProject({ id: "default", name: "Default Project (Legacy)", createdAt: "" });
        return;
      }
      
      const docRef = doc(db, "projects", projectId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() } as Project);
      } else {
        navigate({ to: "/admin" }); // Project not found
      }
    }
    loadProject();
  }, [projectId, navigate]);

  function signOut() {
    auth.signOut().then(() => navigate({ to: "/" }));
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="rounded-full p-2 hover:bg-accent text-muted-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-serif text-xl font-semibold text-navy">{project.name}</h1>
              <p className="text-xs text-muted-foreground">Project Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-2 md:flex">
              <Link 
                to="/project/$projectId" 
                params={{ projectId }} 
                activeProps={{ className: "bg-navy text-white hover:bg-navy/90" }}
                inactiveProps={{ className: "bg-accent/50 hover:bg-accent text-foreground" }}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                activeOptions={{ exact: true }}
              >
                <LayoutIcon className="h-4 w-4" /> Dashboard
              </Link>
              <Link 
                to="/project/$projectId/templates" 
                params={{ projectId }}
                activeProps={{ className: "bg-navy text-white hover:bg-navy/90" }}
                inactiveProps={{ className: "bg-accent/50 hover:bg-accent text-foreground" }}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <LayoutIcon className="h-4 w-4" /> Templates
              </Link>
              <Link 
                to="/project/$projectId/bulk-preview" 
                params={{ projectId }}
                activeProps={{ className: "bg-navy text-white hover:bg-navy/90" }}
                inactiveProps={{ className: "bg-accent/50 hover:bg-accent text-foreground" }}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                <Eye className="h-4 w-4" /> Bulk preview
              </Link>
            </nav>
            <div className="h-6 w-px bg-border hidden md:block" />
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
      
      <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}
