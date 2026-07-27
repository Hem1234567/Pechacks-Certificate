import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, auth, type Project, type Organisation } from "@/integrations/firebase/client";
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { toast } from "sonner";
import {
  Plus,
  LogOut,
  Folder,
  Layout,
  ArrowRight,
  Loader2,
  X,
  Home,
  Building2,
  FolderKanban,
  Shield,
  ChevronRight,
  LayoutDashboard,
  TrendingUp,
  Users,
  Award,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin Dashboard — Panimalar Engineering College" }],
  }),
  component: AdminDashboard,
});

type Section = "home" | "organisation" | "projects";

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  // Organisation state — real Firestore
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  useEffect(() => {
    if (activeSection === "projects") loadProjects();
    if (activeSection === "organisation") loadOrgs();
  }, [activeSection]);

  async function loadProjects() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "projects"), orderBy("createdAt", "desc"))
      );
      // Only show standalone projects (not class-linked ones)
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Project))
        .filter((p) => !p.orgId);
      setProjects(list);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrgs() {
    setOrgsLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "organisations"), orderBy("createdAt", "desc"))
      );
      setOrganisations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Organisation)));
    } catch (e) {
      console.error("Failed to load orgs", e);
    } finally {
      setOrgsLoading(false);
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

  const navItems: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "home", label: "Home", icon: <Home className="h-5 w-5" /> },
    { key: "organisation", label: "Organisation", icon: <Building2 className="h-5 w-5" /> },
    { key: "projects", label: "Projects", icon: <FolderKanban className="h-5 w-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          transition-all duration-300 ease-in-out shadow-2xl
          ${sidebarOpen ? "w-64" : "w-16"}
        `}
        style={{ backgroundColor: "#111111", borderRight: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <Shield className="h-4 w-4" style={{ color: "oklch(0.78 0.14 85)" }} />
              </div>
              <span className="text-sm font-semibold tracking-tight truncate" style={{ color: "#ffffff" }}>
                Admin Panel
              </span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "#ffffff" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map(({ key, label, icon }) => {
              const active = activeSection === key;
              return (
                <li key={key}>
                  <button
                    onClick={() => setActiveSection(key)}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                    style={{
                      backgroundColor: active ? "rgba(255,255,255,0.10)" : "transparent",
                      color: active ? "#ffffff" : "rgba(255,255,255,0.65)",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; if (!active) e.currentTarget.style.color = "#ffffff"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                    title={!sidebarOpen ? label : undefined}
                  >
                    <span style={{ color: active ? "oklch(0.78 0.14 85)" : "rgba(255,255,255,0.65)" }} className="shrink-0">
                      {icon}
                    </span>
                    {sidebarOpen && (
                      <>
                        <span className="flex-1 truncate">{label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5" style={{ color: "oklch(0.78 0.14 85)" }} />}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Theme toggle */}
          <div className={`flex items-center ${sidebarOpen ? "gap-3 px-3 py-2" : "justify-center py-2"}`}>
            {sidebarOpen && <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Theme</span>}
            <ThemeToggle
              className={`border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 ${sidebarOpen ? "" : "w-full justify-center"}`}
              style={{ color: "#ffffff" }}
            />
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "rgb(239,68,68)"; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            title={!sidebarOpen ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-16"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1785113095/uploads/media-converter/rpgoiz586azlmezzgfwu.png"
              alt="PEC"
              className="h-8 w-auto object-contain"
            />
            <div>
              <h1 className="font-serif text-lg font-semibold text-navy leading-none">
                Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeSection === "home" && "Welcome back"}
                {activeSection === "organisation" && "Organisation Management"}
                {activeSection === "projects" && "Project Workspaces"}
              </p>
            </div>
          </div>
          {/* Breadcrumb */}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span className="capitalize text-foreground font-medium">{activeSection}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">

          {/* ── HOME SECTION ──────────────────────────────────────── */}
          {activeSection === "home" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Welcome Banner */}
              <div
                className="relative mb-8 overflow-hidden rounded-2xl p-8"
                style={{
                  background: "linear-gradient(135deg, oklch(0.24 0.06 260) 0%, oklch(0.34 0.08 260) 100%)",
                }}
              >
                <div className="relative z-10">
                  <p className="text-sm font-medium text-white/60 uppercase tracking-widest mb-1">
                    Admin Dashboard
                  </p>
                  <h2 className="font-serif text-3xl lg:text-4xl text-white mb-2">
                    Welcome Back! 👋
                  </h2>
                  <p className="text-white/70 text-sm max-w-lg">
                    Manage your certificate projects, organisations, and track all issued certificates from one central place.
                  </p>
                </div>
                {/* decorative */}
                <div
                  className="absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-10"
                  style={{ background: "oklch(0.78 0.14 85)" }}
                />
                <div
                  className="absolute right-24 bottom-0 h-24 w-24 rounded-full opacity-10"
                  style={{ background: "oklch(0.78 0.14 85)" }}
                />
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {[
                  { label: "Total Projects", value: "—", icon: <FolderKanban className="h-5 w-5" />, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "Organisations", value: "1", icon: <Building2 className="h-5 w-5" />, color: "text-purple-500", bg: "bg-purple-50" },
                  { label: "Certificates Issued", value: "—", icon: <Award className="h-5 w-5" />, color: "text-gold", bg: "bg-amber-50" },
                  { label: "Active Users", value: "—", icon: <Users className="h-5 w-5" />, color: "text-emerald-500", bg: "bg-emerald-50" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {stat.label}
                      </span>
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
                        {stat.icon}
                      </span>
                    </div>
                    <p className="font-serif text-3xl text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mb-8">
                <h3 className="font-serif text-xl text-navy mb-4">Quick Actions</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <button
                    onClick={() => setActiveSection("projects")}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-navy hover:shadow-md transition-all text-left"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy group-hover:bg-navy group-hover:text-white transition-colors">
                      <FolderKanban className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-navy transition-colors">
                        View Projects
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manage workspaces
                      </p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
                  </button>

                  <button
                    onClick={() => setActiveSection("organisation")}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-navy hover:shadow-md transition-all text-left"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-navy transition-colors">
                        Organisation
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manage org settings
                      </p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
                  </button>

                  <Link
                    to="/"
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-navy hover:shadow-md transition-all"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-navy transition-colors">
                        Public Portal
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        View live site
                      </p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
                  </Link>
                </div>
              </div>

              {/* Info Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <LayoutDashboard className="h-5 w-5 text-navy" />
                  <h3 className="font-serif text-lg text-navy">About This Dashboard</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                    Use the <strong className="text-foreground">Projects</strong> section to create and manage certificate workspaces for each event.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                    Use the <strong className="text-foreground">Organisation</strong> section to manage your college/institution details.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                    Click any project card to manage its certificates, templates, and bulk operations.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── ORGANISATION SECTION ──────────────────────────────── */}
          {activeSection === "organisation" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Title */}
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl text-navy">Organisations</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage institutions — each with departments and classes
                  </p>
                </div>
                <button
                  onClick={() => { setNewOrgName(""); setShowOrgModal(true); }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
                  style={{ backgroundColor: "#1e40af", color: "#ffffff" }}
                >
                  <Plus className="h-4 w-4" />
                  Create Organisation
                </button>
              </div>

              {orgsLoading ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : organisations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-900/20">
                    <Building2 className="h-7 w-7 text-purple-500" />
                  </div>
                  <h3 className="font-serif text-xl text-foreground">No organisations yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Create an organisation to start managing departments, classes, and shared certificate templates.
                  </p>
                  <button
                    onClick={() => { setNewOrgName(""); setShowOrgModal(true); }}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: "#1e40af", color: "#ffffff" }}
                  >
                    <Plus className="h-4 w-4" />
                    Create First Organisation
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {organisations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => navigate({ to: "/org/$orgId", params: { orgId: org.id } })}
                      className="group flex flex-col items-start rounded-2xl border border-border bg-card p-6 shadow-sm text-left hover:border-purple-400 hover:shadow-md transition-all"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20 group-hover:bg-purple-100 transition-colors">
                        <Building2 className="h-6 w-6 text-purple-600" />
                      </div>
                      <h4 className="font-semibold text-lg text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                        {org.name}
                      </h4>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Created {new Date(org.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-4 flex w-full items-center justify-between border-t border-border pt-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          View Departments
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-purple-600 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ── PROJECTS SECTION ──────────────────────────────────── */}
          {activeSection === "projects" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Title */}
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl text-navy">Projects</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage your event workspaces
                  </p>
                </div>
                <button
                  onClick={() => { setNewProjectName(""); setShowModal(true); }}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
                  style={{ backgroundColor: "#1e40af", color: "#ffffff" }}
                >
                  <Plus className="h-4 w-4" />
                  Create Project
                </button>
              </div>

              {loading ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Default legacy project */}
                  <Link
                    to="/project/$projectId"
                    params={{ projectId: "default" }}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-navy hover:shadow-md"
                  >
                    <div>
                      <div className="mb-4 inline-flex rounded-xl bg-accent p-3 text-foreground">
                        <Folder className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-navy transition-colors">
                        Default Project
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        Legacy certificates and templates not assigned to a project.
                      </p>
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
                        <h3 className="font-semibold text-lg text-foreground group-hover:text-navy transition-colors">
                          {project.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Workspace for certificates and templates.
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-navy" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Create Project Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-semibold text-lg">Create New Project</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
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
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm hover:bg-accent font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#1e40af", color: "#ffffff" }}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Organisation Modal ─────────────────────────────────────── */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Building2 className="h-4 w-4 text-purple-600" />
                </div>
                <h3 className="font-semibold text-lg">Create Organisation</h3>
              </div>
              <button
                onClick={() => setShowOrgModal(false)}
                className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newOrgName.trim()) return;
                setCreatingOrg(true);
                try {
                  const ref = await addDoc(collection(db, "organisations"), {
                    name: newOrgName.trim(),
                    createdAt: new Date().toISOString(),
                  });
                  toast.success("Organisation created!");
                  setShowOrgModal(false);
                  setNewOrgName("");
                  // Navigate immediately into the new org
                  navigate({ to: "/org/$orgId", params: { orgId: ref.id } });
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setCreatingOrg(false);
                }
              }}
            >
              <div className="p-6">
                <label className="mb-1.5 block text-sm font-medium">
                  Organisation Name <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  autoFocus
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                  placeholder="e.g. Panimalar Engineering College"
                />
              </div>
              <div className="border-t border-border bg-muted/30 px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="rounded-xl px-4 py-2 text-sm hover:bg-accent font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: "#1e40af", color: "#ffffff" }}
                >
                  {creatingOrg && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Organisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
