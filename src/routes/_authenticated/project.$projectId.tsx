import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ArrowLeft, Layout as LayoutIcon, Eye, Menu, X, Download } from "lucide-react";
import { auth, db, type Project } from "@/integrations/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

const LOGO_URL =
  "https://res.cloudinary.com/dzf0ggbrg/image/upload/v1785113095/uploads/media-converter/rpgoiz586azlmezzgfwu.png";

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        if (projectId === "default") {
          setProject({ id: "default", name: "Default Project (Legacy)", createdAt: "" });
          return;
        }
        const docRef = doc(db, "projects", projectId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProject({ id: snap.id, ...snap.data() } as Project);
        } else {
          console.warn("Project not found, redirecting to /admin");
          navigate({ to: "/admin" });
        }
      } catch (err: any) {
        console.error("Error loading project:", err);
        setError(err.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [projectId, navigate]);

  function signOut() {
    auth.signOut().then(() => navigate({ to: "/" }));
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-muted/20 text-navy">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent"></div>
          <p className="text-sm font-medium">Loading project workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-muted/20 text-destructive">
        <div className="flex flex-col items-center gap-4 text-center max-w-md p-6 bg-card rounded-lg shadow-sm border border-border">
          <p className="font-semibold text-lg">Error loading project</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="mt-4 px-4 py-2 bg-navy text-white rounded-md text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            Go back to Admin
          </button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const navLinks = [
    { to: "/project/$projectId" as const, label: "Dashboard", icon: LayoutIcon, exact: true },
    { to: "/project/$projectId/templates" as const, label: "Templates", icon: LayoutIcon, exact: false },
    { to: "/project/$projectId/bulk-preview" as const, label: "Bulk Preview", icon: Eye, exact: false },
  ];

  function downloadTemplateCSV() {
    const headers = ["Name", "Role", "Team", "Project", "College", "Event", "Date", "Certificate ID", "Type", "registration_no", "department", "start_date", "end_date"];
    const row = ["John Doe", "Participant", "Team Alpha", "Project X", "PEC University", "PEC Hacks 4.0", "15 March 2026", "CERT-001", "Participation", "REG-1234", "Computer Science", "13 March 2026", "15 March 2026"];
    
    const csvContent = headers.join(",") + "\n" + row.join(",");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "certificate_data_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* ── Top Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Left: back + logo + project name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              to="/admin"
              className="rounded-full p-1.5 sm:p-2 hover:bg-accent text-muted-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            <img
              src={LOGO_URL}
              alt="PEC Hacks 4.0"
              className="h-6 w-auto sm:h-8 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-serif text-base sm:text-xl font-semibold text-navy truncate max-w-[140px] sm:max-w-xs">
                {project.name}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Project Workspace</p>
            </div>
          </div>

          {/* Right: desktop nav + sign out + mobile hamburger */}
          <div className="flex items-center gap-2">
            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {navLinks.map(({ to, label, icon: Icon, exact }) => (
                <Link
                  key={label}
                  to={to}
                  params={{ projectId }}
                  activeProps={{ className: "bg-navy text-white hover:bg-navy/90" }}
                  inactiveProps={{ className: "bg-accent/50 hover:bg-accent text-foreground" }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                  activeOptions={{ exact }}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              ))}
            </nav>
            <button
              onClick={downloadTemplateCSV}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Download className="h-4 w-4" /> Template CSV
            </button>
            <div className="h-6 w-px bg-border hidden md:block" />
            <button
              onClick={signOut}
              className="hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden rounded-lg p-2 hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
            {navLinks.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={label}
                to={to}
                params={{ projectId }}
                activeProps={{ className: "bg-navy text-white" }}
                inactiveProps={{ className: "text-foreground hover:bg-accent" }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                activeOptions={{ exact }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" /> {label}
              </Link>
            ))}
            <button
              onClick={() => {
                downloadTemplateCSV();
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Download className="h-4 w-4 shrink-0" /> Template CSV
            </button>
            <div className="border-t border-border pt-2 mt-2">
              <button
                onClick={() => { setMobileMenuOpen(false); signOut(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>
    </div>
  );
}
