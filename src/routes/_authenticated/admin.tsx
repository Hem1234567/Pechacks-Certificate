import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db, auth, type Cert } from "@/integrations/firebase/client";
import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, writeBatch, getCountFromServer 
} from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Award, Search, Plus, LogOut, Download, Upload, Eye, Ban, RotateCcw,
  Trash2, Copy, X, FileSpreadsheet, Loader2, ShieldCheck, Link as LinkIcon,
  TableProperties,
} from "lucide-react";
import { newCertificateId, verifyUrl } from "@/lib/certificate-utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — PEC Hacks 4.0" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const ROLES = ["Participant", "Winner", "Runner-up", "Judge", "Mentor", "Volunteer", "Organiser"];
const TYPES = ["Participation", "Achievement", "Appreciation", "Excellence"];
const PAGE_SIZE = 20;

function AdminDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Cert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState({ total: 0, valid: 0, revoked: 0, today: 0 });
  const [editing, setEditing] = useState<Partial<Cert> | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [search, statusFilter, roleFilter, page]);

  useEffect(() => {
    loadStats();
  }, [rows.length]);

  async function loadStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const certsRef = collection(db, "certificates");
      const [totalSnap, validSnap, revokedSnap, todaySnap] = await Promise.all([
        getCountFromServer(query(certsRef)),
        getCountFromServer(query(certsRef, where("status", "==", "valid"))),
        getCountFromServer(query(certsRef, where("status", "==", "revoked"))),
        getCountFromServer(query(certsRef, where("issued_at", ">=", today.toISOString()))),
      ]);
      setStats({
        total: totalSnap.data().count,
        valid: validSnap.data().count,
        revoked: revokedSnap.data().count,
        today: todaySnap.data().count,
      });
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  }

  async function load() {
    setLoading(true);
    try {
      let q = query(collection(db, "certificates"), orderBy("issued_at", "desc"));
      
      const snap = await getDocs(q);
      let allData = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cert));

      if (statusFilter) allData = allData.filter((c) => c.status === statusFilter);
      if (roleFilter) allData = allData.filter((c) => c.role === roleFilter);
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        allData = allData.filter((c) => 
          c.certificate_id.toLowerCase().includes(s) ||
          c.participant_name.toLowerCase().includes(s) ||
          (c.team_name && c.team_name.toLowerCase().includes(s)) ||
          (c.college && c.college.toLowerCase().includes(s)) ||
          (c.project_name && c.project_name.toLowerCase().includes(s))
        );
      }

      setTotal(allData.length);
      setRows(allData.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function save(form: Partial<Cert>) {
    try {
      const certId = form.certificate_id?.trim() || newCertificateId();
      const payload: Cert = {
        id: certId,
        certificate_id: certId,
        participant_name: form.participant_name?.trim() ?? "",
        team_name: form.team_name?.trim() || null,
        project_name: form.project_name?.trim() || null,
        role: form.role || "Participant",
        college: form.college?.trim() || null,
        email: form.email?.trim() || null,
        certificate_type: form.certificate_type || "Participation",
        event_name: form.event_name?.trim() || "PEC Hacks 4.0",
        event_date: form.event_date?.trim() || null,
        status: form.status || "valid",
        issued_at: form.issued_at || new Date().toISOString(),
        scan_count: form.scan_count ?? 0,
      };
      if (!payload.participant_name) return toast.error("Participant name is required");
      
      await setDoc(doc(db, "certificates", certId), payload, { merge: true });
      
      toast.success(form.id ? "Certificate updated" : "Certificate created");
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function revokeCert(c: Cert) {
    try {
      const reason = prompt("Revocation reason (optional):") ?? null;
      await updateDoc(doc(db, "certificates", c.id), { status: "revoked", revoke_reason: reason });
      toast.success("Revoked");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function restore(c: Cert) {
    try {
      await updateDoc(doc(db, "certificates", c.id), { status: "valid", revoke_reason: null });
      toast.success("Restored");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(c: Cert) {
    if (!confirm(`Delete ${c.certificate_id}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "certificates", c.id));
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function importExcel(file: File) {
    try {
      setImporting(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
      if (!json.length) throw new Error("Empty spreadsheet");
      const rowsIn = json.map((r) => {
        const get = (k: string) =>
          r[k] ?? r[k.toLowerCase()] ?? r[k.replace(/ /g, "_")] ?? r[k.replace(/ /g, "_").toLowerCase()] ?? null;
        const cleanStr = (v: unknown) => (v == null || v === "" ? null : String(v).trim());
        const certId = (cleanStr(get("Certificate ID")) ?? newCertificateId()) as string;
        return {
          id: certId,
          certificate_id: certId,
          participant_name: cleanStr(get("Participant")) ?? cleanStr(get("Name")) ?? "",
          team_name: cleanStr(get("Team")),
          project_name: cleanStr(get("Project")),
          role: cleanStr(get("Role")) ?? "Participant",
          college: cleanStr(get("College")),
          email: cleanStr(get("Email")),
          certificate_type: cleanStr(get("Type")) ?? "Participation",
          event_name: cleanStr(get("Event")) ?? "PEC Hacks 4.0",
          event_date: cleanStr(get("Date")),
          status: (cleanStr(get("Status")) ?? "valid").toLowerCase() === "revoked" ? "revoked" : "valid",
          issued_at: new Date().toISOString(),
          scan_count: 0,
        } as Cert;
      }).filter((r) => r.participant_name);
      if (!rowsIn.length) throw new Error("No valid rows (need Participant/Name column)");

      for (let i = 0; i < rowsIn.length; i += 450) {
        const batch = writeBatch(db);
        rowsIn.slice(i, i + 450).forEach((item) => {
          const docRef = doc(db, "certificates", item.certificate_id);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
      }

      toast.success(`Imported ${rowsIn.length} certificates`);
      setPage(0);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function exportAll(fmt: "csv" | "xlsx") {
    try {
      const snap = await getDocs(query(collection(db, "certificates"), orderBy("issued_at", "desc")));
      const rows = snap.docs.map((d) => {
        const r = d.data() as Cert;
        return {
          "Certificate ID": r.certificate_id,
          Participant: r.participant_name,
          Team: r.team_name ?? "",
          Project: r.project_name ?? "",
          Role: r.role,
          College: r.college ?? "",
          Email: r.email ?? "",
          Type: r.certificate_type,
          Event: r.event_name,
          Date: r.event_date ?? "",
          Status: r.status,
          Issued: r.issued_at ? new Date(r.issued_at).toISOString() : new Date().toISOString(),
          Scans: r.scan_count || 0,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Certificates");
      XLSX.writeFile(wb, `pec-hacks-certificates.${fmt}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function downloadTemplate() {
    // ── Sample data sheet ────────────────────────────────────────────────
    const sampleRows = [
      {
        "Participant": "Aarav Sharma",
        "Team": "Team Alpha",
        "Project": "AI Crop Monitor",
        "Role": "Participant",
        "College": "PEC University of Technology",
        "Email": "aarav.sharma@example.com",
        "Type": "Participation",
        "Event": "PEC Hacks 4.0",
        "Date": "15 March 2026",
        "Status": "valid",
      },
      {
        "Participant": "Priya Nair",
        "Team": "Team Beta",
        "Project": "Smart Waste Sorter",
        "Role": "Winner",
        "College": "NIT Trichy",
        "Email": "priya.nair@example.com",
        "Type": "Achievement",
        "Event": "PEC Hacks 4.0",
        "Date": "15 March 2026",
        "Status": "valid",
      },
      {
        "Participant": "Rohan Mehta",
        "Team": "Team Gamma",
        "Project": "EduBot",
        "Role": "Runner-up",
        "College": "IIT Roorkee",
        "Email": "rohan.mehta@example.com",
        "Type": "Achievement",
        "Event": "PEC Hacks 4.0",
        "Date": "15 March 2026",
        "Status": "valid",
      },
    ];

    // ── Instructions sheet ───────────────────────────────────────────────
    const instructions = [
      { "Column": "Participant", "Required?": "YES", "Description": "Full name of the participant", "Allowed Values": "Any text" },
      { "Column": "Team",        "Required?": "No",  "Description": "Team name (leave blank if individual)", "Allowed Values": "Any text" },
      { "Column": "Project",     "Required?": "No",  "Description": "Project / hackathon submission name", "Allowed Values": "Any text" },
      { "Column": "Role",        "Required?": "No",  "Description": "Role of the participant", "Allowed Values": "Participant | Winner | Runner-up | Judge | Mentor | Volunteer | Organiser" },
      { "Column": "College",     "Required?": "No",  "Description": "Institution name", "Allowed Values": "Any text" },
      { "Column": "Email",       "Required?": "No",  "Description": "Participant email address", "Allowed Values": "Valid email" },
      { "Column": "Type",        "Required?": "No",  "Description": "Certificate type", "Allowed Values": "Participation | Achievement | Appreciation | Excellence" },
      { "Column": "Event",       "Required?": "No",  "Description": "Event name (defaults to PEC Hacks 4.0)", "Allowed Values": "Any text" },
      { "Column": "Date",        "Required?": "No",  "Description": "Event date shown on certificate", "Allowed Values": "e.g. 15 March 2026" },
      { "Column": "Status",      "Required?": "No",  "Description": "Certificate status (defaults to valid)", "Allowed Values": "valid | revoked" },
    ];

    const wb = XLSX.utils.book_new();

    // Sheet 1 – Participants template
    const ws1 = XLSX.utils.json_to_sheet(sampleRows);
    // Set column widths
    ws1["!cols"] = [
      { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 14 },
      { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Participants");

    // Sheet 2 – Instructions
    const ws2 = XLSX.utils.json_to_sheet(instructions);
    ws2["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 42 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

    XLSX.writeFile(wb, "pec-hacks-participant-template.xlsx");
    toast.success("Template downloaded!");
  }

  async function bulkGenerate() {
    const nStr = prompt("How many blank certificates to generate?", "10");
    const n = Math.min(450, Math.max(0, parseInt(nStr || "0", 10)));
    if (!n) return;
    
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < n; i++) {
        const certId = newCertificateId();
        const payload: Cert = {
          id: certId,
          certificate_id: certId,
          participant_name: `Participant ${i + 1}`,
          role: "Participant",
          certificate_type: "Participation",
          event_name: "PEC Hacks 4.0",
          team_name: null,
          project_name: null,
          college: null,
          email: null,
          event_date: null,
          status: "valid",
          revoke_reason: null,
          issued_at: new Date().toISOString(),
          scan_count: 0,
        };
        batch.set(doc(db, "certificates", certId), payload);
      }
      await batch.commit();
      toast.success(`Generated ${n} certificates`);
      setPage(0);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-12">
          <Link to="/" className="flex items-center">
            <img
              src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1784998453/uploads/media-converter/nkjufde8hggarqze8ejd.png"
              alt="Panimalar Engineering College"
              className="h-10 w-10 object-contain scale-[2.5] origin-left relative z-50"
            />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
              title="Download participant import template"
            >
              <TableProperties className="h-4 w-4" /> Template Excel
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total certificates" value={stats.total} />
          <StatCard label="Valid" value={stats.valid} tone="success" />
          <StatCard label="Revoked" value={stats.revoked} tone="warning" />
          <StatCard label="Issued today" value={stats.today} />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search ID, participant, team, college…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm"
          >
            <option value="">All status</option>
            <option value="valid">Valid</option>
            <option value="revoked">Revoked</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-accent">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importExcel(e.target.files[0])}
            />
          </label>
          <div className="relative group">
            <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-accent">
              <Download className="h-4 w-4" /> Export
            </button>
            <div className="absolute right-0 top-full z-10 mt-1 hidden min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-lg group-hover:block">
              <button onClick={() => exportAll("xlsx")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent">
                <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
              </button>
              <button onClick={() => exportAll("csv")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent">
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>
          <button onClick={bulkGenerate} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-accent">
            <ShieldCheck className="h-4 w-4" /> Bulk generate
          </button>
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 py-2.5 text-sm text-navy-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Team / Project</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No certificates found.</td></tr>
                ) : rows.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{c.certificate_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.participant_name}</div>
                      <div className="text-xs text-muted-foreground">{c.college ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{c.team_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.project_name ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">{c.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "valid" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="View" onClick={() => navigate({ to: "/certificate/$id", params: { id: c.certificate_id } })}>
                          <Eye className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn title="Copy verify link" onClick={() => {
                          navigator.clipboard.writeText(verifyUrl(c.certificate_id));
                          toast.success("Link copied");
                        }}>
                          <LinkIcon className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditing(c)}>
                          <Copy className="h-4 w-4" />
                        </IconBtn>
                        {c.status === "valid" ? (
                          <IconBtn title="Revoke" onClick={() => revokeCert(c)}>
                            <Ban className="h-4 w-4 text-warning" />
                          </IconBtn>
                        ) : (
                          <IconBtn title="Restore" onClick={() => restore(c)}>
                            <RotateCcw className="h-4 w-4 text-success" />
                          </IconBtn>
                        )}
                        <IconBtn title="Delete" onClick={() => remove(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>{total} results</div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
              >Prev</button>
              <span>Page {page + 1} of {pages}</span>
              <button
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        </div>
      </div>

      {editing && <EditModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded hover:bg-accent">
      {children}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 font-serif text-4xl ${
        tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "navy-text"
      }`}>{value}</p>
    </div>
  );
}

function EditModal({
  initial, onSave, onClose,
}: { initial: Partial<Cert>; onSave: (v: Partial<Cert>) => void; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Cert>>(initial);
  const isNew = !initial.id && !initial.certificate_id;
  const suggested = useMemo(() => initial.certificate_id ?? newCertificateId(), [initial.certificate_id]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl">{isNew ? "New certificate" : "Edit certificate"}</h2>
            <p className="text-xs text-muted-foreground">{isNew ? "Details will be issued immediately." : initial.certificate_id}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Certificate ID" hint={isNew ? "Auto-generated if empty" : undefined}>
            <input
              defaultValue={initial.certificate_id ?? ""}
              placeholder={suggested}
              onChange={(e) => setForm((f) => ({ ...f, certificate_id: e.target.value }))}
              className="input"
              disabled={!isNew}
            />
          </Field>
          <Field label="Participant name *">
            <input required defaultValue={initial.participant_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, participant_name: e.target.value }))} className="input" />
          </Field>
          <Field label="Role">
            <select defaultValue={initial.role ?? "Participant"} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Certificate type">
            <select defaultValue={initial.certificate_type ?? "Participation"} onChange={(e) => setForm((f) => ({ ...f, certificate_type: e.target.value }))} className="input">
              {TYPES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Team"><input defaultValue={initial.team_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))} className="input" /></Field>
          <Field label="Project"><input defaultValue={initial.project_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))} className="input" /></Field>
          <Field label="College"><input defaultValue={initial.college ?? ""} onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))} className="input" /></Field>
          <Field label="Email"><input type="email" defaultValue={initial.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" /></Field>
          <Field label="Event name"><input defaultValue={initial.event_name ?? "PEC Hacks 4.0"} onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))} className="input" /></Field>
          <Field label="Event date"><input defaultValue={initial.event_date ?? ""} placeholder="e.g. 15 March 2026" onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className="input" /></Field>
        </div>

        <style>{`.input{width:100%;border-radius:.5rem;border:1px solid var(--input);background:var(--background);padding:.5rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:var(--ring)}`}</style>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
          <button
            onClick={() => onSave({ ...initial, ...form })}
            className="rounded-lg bg-navy px-4 py-2 text-sm text-navy-foreground hover:opacity-90"
          >
            {isNew ? "Issue certificate" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
