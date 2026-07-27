import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db, auth, type Cert, type CertificateTemplate } from "@/integrations/firebase/client";
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, writeBatch, getCountFromServer 
} from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Search, Plus, LogOut, Download, Upload, Eye, Ban, RotateCcw,
  Trash2, Copy, X, FileSpreadsheet, Loader2, ShieldCheck, Link as LinkIcon,
  TableProperties, Layout, Users, CheckCircle2, Layout as LayoutIcon, FolderArchive,
} from "lucide-react";
import { newCertificateId, verifyUrl, styledQrDataUrl, DEFAULT_QR_CONFIG } from "@/lib/certificate-utils";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CertificateSheet, DynamicCertificateSheet } from "@/components/CertificateRenderer";

export const Route = createFileRoute("/_authenticated/project/$projectId/")({
  head: () => ({
    meta: [
      { title: "Project Dashboard — PEC Hacks 4.0" },
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
  const { projectId } = Route.useParams();
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
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkZipName, setBulkZipName] = useState("Certificates");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [renderQueue, setRenderQueue] = useState<{ cert: Cert; template: CertificateTemplate | null; qr: string } | null>(null);

  useEffect(() => { loadTemplates(); }, [projectId]);

  async function loadTemplates() {
    try {
      // 1. Load class-specific templates
      const classQ = query(
        collection(db, "certificate_templates"),
        where("projectId", "==", projectId === "default" ? null : projectId),
        orderBy("updatedAt", "desc")
      );
      const classSnap = await getDocs(classQ);
      const classTemplates = classSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CertificateTemplate)
      );

      // 2. Look up the project's orgId to fetch shared org templates
      let orgTemplates: CertificateTemplate[] = [];
      if (projectId !== "default") {
        try {
          const projSnap = await getDoc(doc(db, "projects", projectId));
          const orgId = projSnap.data()?.orgId as string | undefined;
          if (orgId) {
            const orgQ = query(
              collection(db, "certificate_templates"),
              where("orgId", "==", orgId),
              where("projectId", "==", null),
              orderBy("updatedAt", "desc")
            );
            const orgSnap = await getDocs(orgQ);
            orgTemplates = orgSnap.docs.map(
              (d) => ({ id: d.id, isShared: true, ...d.data() } as CertificateTemplate & { isShared?: boolean })
            );
          }
        } catch (_) {
          // orgId lookup failure is non-fatal
        }
      }

      // 3. Merge — class-specific first, then shared org templates
      const merged = [
        ...classTemplates,
        // exclude org templates already present as class copies
        ...orgTemplates.filter((o) => !classTemplates.some((c) => c.id === o.id)),
      ];
      setTemplates(merged);
      // Auto-select first if only one
      if (merged.length === 1) setSelectedTemplateId(merged[0].id);
    } catch (e) {
      console.error("Failed to load templates", e);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [search, statusFilter, roleFilter, page, projectId]);

  useEffect(() => {
    loadStats();
  }, [rows.length]);

  async function loadStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const certsRef = collection(db, "certificates");
      const baseQuery = query(certsRef, where("projectId", "==", projectId === "default" ? null : projectId));
      
      const [totalSnap, validSnap, revokedSnap] = await Promise.all([
        getCountFromServer(baseQuery),
        getCountFromServer(query(baseQuery, where("status", "==", "valid"))),
        getCountFromServer(query(baseQuery, where("status", "==", "revoked"))),
      ]);
      
      let todayCount = 0;
      try {
        const todaySnap = await getCountFromServer(query(baseQuery, where("issued_at", ">=", today.toISOString())));
        todayCount = todaySnap.data().count;
      } catch (e: any) {
        if (e.message?.includes("index")) {
          console.warn("Index missing for 'today' stat. It will show 0 until created.", e.message);
        }
      }

      setStats({
        total: totalSnap.data().count,
        valid: validSnap.data().count,
        revoked: revokedSnap.data().count,
        today: todayCount,
      });
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  }

  async function load() {
    setLoading(true);
    try {
      let q = query(
        collection(db, "certificates"),
        where("projectId", "==", projectId === "default" ? null : projectId),
        orderBy("issued_at", "desc")
      );
      
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
        revoke_reason: form.revoke_reason ?? null,
        issued_at: form.issued_at || new Date().toISOString(),
        scan_count: form.scan_count ?? 0,
        templateId: form.templateId ?? selectedTemplateId ?? null,
        projectId: projectId === "default" ? null : projectId,
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
      toast.error("Failed to restore");
    }
  }

  async function performBulkDownload() {
    if (!bulkZipName.trim()) return toast.error("Please enter a zip file name");
    setShowBulkModal(false);
    setBulkDownloading(true);
    
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const zip = new JSZip();
      
      setBulkProgress({ current: 0, total: rows.length });
      
      for (let i = 0; i < rows.length; i++) {
        const cert = rows[i];
        
        const matched = cert.templateId 
          ? templates.find(t => t.id === cert.templateId) 
          : templates.find(t => (t.applyToRoles.length === 0 || t.applyToRoles.includes(cert.role)) && (t.applyToTypes.length === 0 || t.applyToTypes.includes(cert.certificate_type))) ?? null;
          
        const qrConfig = matched?.qrConfig ?? DEFAULT_QR_CONFIG;
        const qrData = await styledQrDataUrl(verifyUrl(cert.certificate_id), { ...qrConfig, size: 512 });
        
        setRenderQueue({ cert, template: matched || null, qr: qrData });
        
        await new Promise(res => setTimeout(res, 350));
        
        const el = document.getElementById("bulk-render-sheet");
        if (el) {
          const canvas = await html2canvas(el, { scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false });
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
          pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, "FAST");
          
          const safeName = `${cert.participant_name.replace(/[^a-z0-9]/gi, '_')}_${cert.certificate_id}.pdf`;
          zip.file(safeName, pdf.output("blob"));
        }
        
        setBulkProgress({ current: i + 1, total: rows.length });
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${bulkZipName}.zip`);
      toast.success(`Downloaded ${rows.length} certificates!`);
      
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBulkDownloading(false);
      setRenderQueue(null);
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
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
      if (!json.length) throw new Error("Empty spreadsheet");
      const rowsIn = json.map((r) => {
        const get = (k: string) =>
          r[k] ?? r[k.toLowerCase()] ?? r[k.replace(/ /g, "_")] ?? r[k.replace(/ /g, "_").toLowerCase()] ?? null;
        const cleanStr = (v: unknown) => (v == null || v === "" ? null : String(v).trim());
        const certId = (cleanStr(get("Certificate ID")) ?? newCertificateId()) as string;
        
        const knownKeys = ["Certificate ID", "Participant", "Name", "Team", "Project", "Role", "College", "Email", "Type", "Event", "Date", "Status"];
        const customData: Record<string, string> = {};
        for (const k in r) {
          const lowerK = k.toLowerCase();
          const isKnown = knownKeys.some(
            (kn) => lowerK === kn.toLowerCase() || lowerK === kn.replace(/ /g, "_").toLowerCase()
          );
          if (!isKnown) {
            const val = cleanStr(r[k]);
            if (val !== null) customData[k] = val;
          }
        }

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
          templateId: selectedTemplateId ?? null,
          projectId: projectId === "default" ? null : projectId,
          customData,
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

      const tplName = selectedTemplateId
        ? templates.find((t) => t.id === selectedTemplateId)?.name ?? "selected template"
        : "default design";
      toast.success(`Imported ${rowsIn.length} certificates using "${tplName}"`);
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
      const snap = await getDocs(query(
        collection(db, "certificates"),
        where("projectId", "==", projectId === "default" ? null : projectId),
        orderBy("issued_at", "desc")
      ));
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
          ...r.customData, // Append any custom data columns automatically
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
        "Registration No": "2026001",
        "Department": "Computer Science",
        "Start Date": "01 March 2026",
        "End Date": "15 March 2026",
        "Performance Rating": "Excellent",
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
        "Registration No": "2026002",
        "Department": "Information Technology",
        "Start Date": "01 March 2026",
        "End Date": "15 March 2026",
        "Performance Rating": "Good",
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
        "Registration No": "2026003",
        "Department": "Electronics",
        "Start Date": "01 March 2026",
        "End Date": "15 March 2026",
        "Performance Rating": "Average",
      },
    ];

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
      { "Column": "Status",      "Required?": "No",  "Description": "Is certificate valid or revoked?", "Allowed Values": "valid | revoked" },
      { "Column": "(Custom)",    "Required?": "No",  "Description": "Any other column you add (e.g. 'Registration No') will be available in custom text fields like {Registration No}", "Allowed Values": "Any text" },
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(sampleRows);
    ws1["!cols"] = [
      { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 14 },
      { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Participants");

    const ws2 = XLSX.utils.json_to_sheet(instructions);
    ws2["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 42 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

    XLSX.writeFile(wb, "pec-hacks-participant-template.xlsx");
    toast.success("Template downloaded!");
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total certificates" value={stats.total} />
          <StatCard label="Valid" value={stats.valid} tone="success" />
          <StatCard label="Revoked" value={stats.revoked} tone="warning" />
          <StatCard label="Issued today" value={stats.today} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <LayoutIcon className="h-4 w-4 text-navy" />
                Select Template for Import
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose which template to apply when importing Excel or creating new certificates
              </p>
            </div>
            <Link to="/project/$projectId/templates" params={{ projectId }} className="text-xs text-navy hover:underline">
              + Create / Edit Templates
            </Link>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">No templates created yet.</p>
              <Link to="/project/$projectId/templates" params={{ projectId }} className="mt-1 inline-block text-xs text-navy hover:underline">
                Go to Template Builder →
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTemplateId(null)}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm transition-all ${
                  selectedTemplateId === null
                    ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {selectedTemplateId === null && <CheckCircle2 className="h-4 w-4" />}
                None (default design)
              </button>

              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm transition-all ${
                    selectedTemplateId === tpl.id
                      ? "border-navy bg-navy/5 text-navy font-medium"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  {selectedTemplateId === tpl.id && <CheckCircle2 className="h-4 w-4 text-navy" />}
                  <span>{tpl.name}</span>
                  {(tpl.applyToRoles.length > 0 || tpl.applyToTypes.length > 0) && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {[...tpl.applyToRoles, ...tpl.applyToTypes].join(", ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedTemplateId && (
            <p className="mt-3 text-xs text-green-700">
              ✓ <strong>"{templates.find(t => t.id === selectedTemplateId)?.name}"</strong> will be applied to all certificates imported from Excel or created via + New
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
            selectedTemplateId
              ? "border-navy bg-navy/5 text-navy hover:bg-navy/10"
              : "border-border bg-card hover:bg-accent"
          }`}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import Excel
            {selectedTemplateId && (
              <span className="rounded-full bg-navy px-1.5 py-0.5 text-[10px] text-white">
                {templates.find(t => t.id === selectedTemplateId)?.name}
              </span>
            )}
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
          <button onClick={() => setShowBulkModal(true)} disabled={bulkDownloading || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-accent disabled:opacity-50">
            {bulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderArchive className="h-4 w-4" />}
            {bulkDownloading ? `Generating (${bulkProgress.current}/${bulkProgress.total})` : "Bulk download"}
          </button>
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 py-2.5 text-sm text-navy-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-semibold">{editing.id ? "Edit Certificate" : "New Certificate"}</h3>
              <button onClick={() => setEditing(null)} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Participant Name *</label>
                  <input
                    value={editing.participant_name || ""}
                    onChange={(e) => setEditing({ ...editing, participant_name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                    placeholder="E.g. Priya Nair"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Role *</label>
                  <select
                    value={editing.role || "Participant"}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Certificate Type *</label>
                  <select
                    value={editing.certificate_type || "Participation"}
                    onChange={(e) => setEditing({ ...editing, certificate_type: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">College/Organization</label>
                  <input
                    value={editing.college || ""}
                    onChange={(e) => setEditing({ ...editing, college: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Team Name</label>
                  <input
                    value={editing.team_name || ""}
                    onChange={(e) => setEditing({ ...editing, team_name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Project Name</label>
                  <input
                    value={editing.project_name || ""}
                    onChange={(e) => setEditing({ ...editing, project_name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Event Name</label>
                  <input
                    value={editing.event_name || "PEC Hacks 4.0"}
                    onChange={(e) => setEditing({ ...editing, event_name: e.target.value })}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-border bg-muted/30 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm hover:bg-accent font-medium">Cancel</button>
              <button onClick={() => save(editing)} className="rounded-lg bg-navy px-4 py-2 text-sm text-navy-foreground hover:opacity-90 font-medium">Save Certificate</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-semibold text-lg">Bulk Download ZIP</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You are about to generate PDFs for {rows.length} certificate(s).
              </p>
            </div>
            <div className="p-6">
              <label className="mb-1.5 block text-sm font-medium">ZIP File Name</label>
              <input
                value={bulkZipName}
                onChange={(e) => setBulkZipName(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                autoFocus
              />
            </div>
            <div className="border-t border-border bg-muted/30 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowBulkModal(false)} className="rounded-lg px-4 py-2 text-sm hover:bg-accent font-medium">Cancel</button>
              <button onClick={performBulkDownload} className="rounded-lg bg-navy px-4 py-2 text-sm text-navy-foreground hover:opacity-90 font-medium inline-flex items-center gap-2">
                <FolderArchive className="h-4 w-4" /> Download ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className="fixed top-0 left-[-9999px] z-[-1] opacity-0 pointer-events-none" 
        style={{ width: "297mm", height: "210mm" }}
      >
        <div className="w-full h-full relative">
          {renderQueue && (
             renderQueue.template 
              ? <DynamicCertificateSheet cert={renderQueue.cert} template={renderQueue.template} qr={renderQueue.qr} id="bulk-render-sheet" />
              : <CertificateSheet cert={renderQueue.cert} qr={renderQueue.qr} id="bulk-render-sheet" />
          )}
        </div>
      </div>
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


