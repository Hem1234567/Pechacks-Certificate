import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  db,
  type CertificateTemplate,
  type FieldConfig,
  type QRStyleConfig,
} from "@/integrations/firebase/client";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { DEFAULT_QR_CONFIG, styledQrDataUrl, verifyUrl } from "@/lib/certificate-utils";
import { QRStylePicker, FONT_OPTIONS } from "@/components/qr-style-picker";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/org/$orgId/templates")({
  head: () => ({
    meta: [
      { title: "Template Builder — PEC Hacks 4.0" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrgTemplatesPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ["Participant", "Winner", "Runner-up", "Judge", "Mentor", "Volunteer", "Organiser"];
const TYPES = ["Participation", "Achievement", "Appreciation", "Excellence"];

const CERT_FIELDS: { key: string; label: string }[] = [
  { key: "participant_name", label: "Participant Name" },
  { key: "role", label: "Role" },
  { key: "team_name", label: "Team Name" },
  { key: "project_name", label: "Project Name" },
  { key: "college", label: "College" },
  { key: "event_name", label: "Event Name" },
  { key: "event_date", label: "Event Date" },
  { key: "certificate_id", label: "Certificate ID" },
  { key: "certificate_type", label: "Certificate Type" },
  { key: "issued_at", label: "Issued Date" },
  { key: "registration_no", label: "Registration No" },
  { key: "department", label: "Department" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "custom_text", label: "Custom Text Block" },
  { key: "qr", label: "QR Code" },
];

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "A4 Landscape", w: 1122, h: 794 },
  { label: "A4 Portrait",  w: 794,  h: 1122 },
  { label: "Letter Landscape", w: 1056, h: 816 },
  { label: "Letter Portrait",  w: 816,  h: 1056 },
  { label: "Square (800×800)", w: 800,  h: 800 },
  { label: "Custom",           w: 0,    h: 0 },
];

const DEFAULT_FIELD_STYLE: Omit<FieldConfig, "id" | "label" | "fieldKey"> = {
  x: 30,
  y: 40,
  width: 40,
  height: 10,
  fontFamily: "Cormorant Garamond, serif",
  fontSize: 32,
  fontWeight: "400",
  color: "#0b1a3a",
  textAlign: "center",
  letterSpacing: "0em",
  textTransform: "none",
  italic: false,
  visible: true,
};

function newFieldId() {
  return Math.random().toString(36).slice(2, 9);
}

function newTemplateId() {
  return `tpl-${Date.now().toString(36)}`;
}

const SAMPLE_CERT_DATA: Record<string, string> = {
  participant_name: "Aarav Sharma",
  role: "Winner",
  team_name: "Team Alpha",
  project_name: "AI Crop Monitor",
  college: "PEC University of Technology",
  event_name: "PEC Hacks 4.0",
  event_date: "15 March 2026",
  certificate_id: "PECH4-2026-ABCD1234",
  certificate_type: "Achievement",
  issued_at: new Date().toLocaleDateString(),
  registration_no: "REG-2026-9999",
  department: "Computer Science",
  start_date: "13 March 2026",
  end_date: "15 March 2026",
};

// ─── Empty template factory ───────────────────────────────────────────────────

function emptyTemplate(): CertificateTemplate {
  return {
    id: newTemplateId(),
    name: "New Template",
    backgroundUrl: "",
    fields: [],
    qrConfig: DEFAULT_QR_CONFIG,
    applyToRoles: [],
    applyToTypes: [],
    canvasWidth: 1122,
    canvasHeight: 794,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function OrgTemplatesPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Organisation");
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [active, setActive] = useState<CertificateTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"canvas" | "fields" | "qr">("canvas");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [orgId]);

  async function loadTemplates() {
    setLoading(true);
    try {
      // 1. Fetch org name for UI
      try {
        const orgDoc = await getDoc(doc(db, "organisations", orgId));
        if (orgDoc.exists()) setOrgName(orgDoc.data().name);
      } catch (_) {}

      const orgQ = query(
        collection(db, "certificate_templates"),
        where("orgId", "==", orgId),
        where("projectId", "==", null)
      );
      const orgSnap = await getDocs(orgQ);
      const list = orgSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CertificateTemplate)
      ).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

      setTemplates(list);
      if (list.length > 0 && !active) setActive(list[0]);
      else if (list.length === 0) setActive({ ...emptyTemplate(), orgId, projectId: null });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate() {
    if (!active) return;
    setSaving(true);
    try {
      const payload: Omit<CertificateTemplate, "id"> = {
        name: active.name || "Untitled Template",
        backgroundUrl: active.backgroundUrl || "",
        fields: active.fields || [],
        qrConfig: active.qrConfig || DEFAULT_QR_CONFIG,
        applyToRoles: active.applyToRoles || [],
        applyToTypes: active.applyToTypes || [],
        canvasWidth: active.canvasWidth || 1122,
        canvasHeight: active.canvasHeight || 794,
        updatedAt: new Date().toISOString(),
        createdAt: active.createdAt || new Date().toISOString(),
        projectId: null, // explicitly null so it's org-wide
        orgId: orgId,
      };
      await setDoc(doc(db, "certificate_templates", active.id), payload);
      toast.success("Template saved!");
      await loadTemplates();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(tpl: CertificateTemplate) {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "certificate_templates", tpl.id));
      toast.success("Template deleted");
      setActive(emptyTemplate());
      await loadTemplates();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function updateActive<K extends keyof CertificateTemplate>(k: K, v: CertificateTemplate[K]) {
    setActive((a) => (a ? { ...a, [k]: v } : a));
  }

  function updateField(id: string, patch: Partial<FieldConfig>) {
    setActive((a) =>
      a ? { ...a, fields: a.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : a
    );
  }

  function addField(fieldKey: string) {
    const meta = CERT_FIELDS.find((f) => f.key === fieldKey);
    if (!meta) return;
    const isQr = fieldKey === "qr";
    const newField: FieldConfig = {
      ...DEFAULT_FIELD_STYLE,
      id: newFieldId(),
      label: meta.label,
      fieldKey,
      width: isQr ? 12 : 50,
      height: isQr ? 12 : 8,
      x: 25,
      y: 40,
      fontSize: isQr ? 0 : 32,
    };
    setActive((a) => (a ? { ...a, fields: [...a.fields, newField] } : a));
    setSelectedFieldId(newField.id);
    setTab("fields");
  }

  function removeField(id: string) {
    setActive((a) => (a ? { ...a, fields: a.fields.filter((f) => f.id !== id) } : a));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  const [bgUrlInput, setBgUrlInput] = useState("");
  const [compressing, setCompressing] = useState(false);

  /** Compress image to JPEG ≤1240px wide at 75% quality — keeps base64 < 400KB */
  async function handleBackgroundUpload(file: File) {
    setCompressing(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const MAX_W = 1240;
            const scale = img.width > MAX_W ? MAX_W / img.width : 1;
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            updateActive("backgroundUrl", compressed);
            resolve();
          };
          img.onerror = reject;
          img.src = ev.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      toast.success("Background uploaded and compressed");
    } catch {
      toast.error("Failed to process image");
    } finally {
      setCompressing(false);
    }
  }

  function handleBgUrlPaste() {
    if (!bgUrlInput.trim()) return;
    updateActive("backgroundUrl", bgUrlInput.trim());
    setBgUrlInput("");
    toast.success("Background URL set");
  }

  const selectedField = active?.fields.find((f) => f.id === selectedFieldId) ?? null;

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: "/org/$orgId", params: { orgId } })}
              className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold text-navy leading-none">
                  Shared Templates
                </h1>
                <p className="text-xs text-muted-foreground">
                  {orgName} (Applies to all classes)
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => { setActive({ ...emptyTemplate(), orgId, projectId: null }); setSelectedFieldId(null); }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" /> New Template
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar: template list ── */}
        <aside className="w-56 shrink-0 border-r border-border bg-background overflow-y-auto">
          <div className="p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1">
              Saved Templates
            </p>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-2">No templates yet</p>
            )}
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => { setActive(t); setSelectedFieldId(null); }}
                className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active?.id === t.id ? "bg-accent font-medium" : "hover:bg-muted"
                }`}
              >
                <span className="truncate">{t.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTemplate(t); }}
                  className="ml-1 hidden text-muted-foreground hover:text-destructive group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main editor area ── */}
        {active ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas + tab bar */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Template meta bar */}
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-5 py-2.5">
                <input
                  value={active.name}
                  onChange={(e) => updateActive("name", e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:border-ring"
                  placeholder="Template name"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Roles:</span>
                  <MultiSelect
                    options={ROLES}
                    value={active.applyToRoles}
                    onChange={(v) => updateActive("applyToRoles", v)}
                    placeholder="All roles"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Types:</span>
                  <MultiSelect
                    options={TYPES}
                    value={active.applyToTypes}
                    onChange={(v) => updateActive("applyToTypes", v)}
                    placeholder="All types"
                  />
                </div>
                {/* Canvas size picker */}
                <SizeSelector
                  width={active.canvasWidth ?? 1122}
                  height={active.canvasHeight ?? 794}
                  onChange={(w, h) => { updateActive("canvasWidth", w); updateActive("canvasHeight", h); }}
                />
                {/* Background upload: file + URL paste */}
                <div className="ml-auto flex items-center gap-2">
                  {active.backgroundUrl && (
                    <span className="text-[10px] text-green-600 font-medium">✓ BG set</span>
                  )}
                  <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent ${
                    compressing ? "opacity-60 pointer-events-none" : ""
                  }`}>
                    {compressing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {compressing ? "Compressing…" : "Upload BG"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleBackgroundUpload(e.target.files[0])}
                    />
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={bgUrlInput}
                      onChange={(e) => setBgUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleBgUrlPaste()}
                      placeholder="Or paste image URL…"
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs w-44 outline-none focus:border-ring"
                    />
                    <button
                      onClick={handleBgUrlPaste}
                      disabled={!bgUrlInput.trim()}
                      className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                    >Set</button>
                  </div>
                </div>
              </div>

              {/* Tab nav */}
              <div className="flex gap-0 border-b border-border bg-background px-5">
                {(
                  [
                    { key: "canvas", label: "Canvas", icon: <Layers className="h-3.5 w-3.5" /> },
                    { key: "fields", label: "Field Style", icon: <Type className="h-3.5 w-3.5" /> },
                    { key: "qr", label: "QR Style", icon: <QrCode className="h-3.5 w-3.5" /> },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                      tab === t.key
                        ? "border-navy text-navy"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Canvas tab */}
              {tab === "canvas" && (
                <div className="flex flex-1 flex-col overflow-auto p-4 gap-4 bg-muted/10">
                  <CanvasEditor
                    template={active}
                    selectedFieldId={selectedFieldId}
                    onSelectField={setSelectedFieldId}
                    onUpdateField={updateField}
                    onAddField={addField}
                    onRemoveField={removeField}
                    canvasWidth={active.canvasWidth ?? 1122}
                    canvasHeight={active.canvasHeight ?? 794}
                  />
                </div>
              )}

              {/* Fields style tab */}
              {tab === "fields" && (
                <div className="flex flex-1 overflow-hidden">
                  {/* Field list */}
                  <div className="w-52 shrink-0 overflow-y-auto border-r border-border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Fields
                      </p>
                      <AddFieldMenu onAdd={addField} existingKeys={active.fields.map((f) => f.fieldKey)} />
                    </div>
                    {active.fields.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFieldId(f.id)}
                        className={`mb-1 flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                          selectedFieldId === f.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          {f.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {active.fields.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 px-1">
                        Add fields using the + button
                      </p>
                    )}
                  </div>

                  {/* Field style panel */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {selectedField ? (
                      <FieldStylePanel
                        field={selectedField}
                        onChange={(patch) => updateField(selectedField.id, patch)}
                      />
                    ) : (
                      <div className="grid place-items-center h-full text-muted-foreground text-sm">
                        Select a field from the list to edit its style
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* QR style tab */}
              {tab === "qr" && (
                <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full">
                  <h3 className="font-medium text-sm mb-4">QR Code Style</h3>
                  <QRStylePicker
                    value={active.qrConfig}
                    onChange={(v) => updateActive("qrConfig", v)}
                    previewText={verifyUrl("PREVIEW")}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Canvas Editor ────────────────────────────────────────────────────────────

function CanvasEditor({
  template,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onAddField,
  onRemoveField,
  canvasWidth,
  canvasHeight,
}: {
  template: CertificateTemplate;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (id: string, patch: Partial<FieldConfig>) => void;
  onAddField: (key: string) => void;
  onRemoveField: (id: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{
    fieldId: string;
    startX: number;
    startY: number;
    startFieldX: number;
    startFieldY: number;
  } | null>(null);
  const resizing = useRef<{
    fieldId: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});

  // Generate QR previews for QR-type fields
  useEffect(() => {
    const qrFields = template.fields.filter((f) => f.fieldKey === "qr");
    qrFields.forEach(async (f) => {
      if (qrPreviews[f.id]) return;
      try {
        const url = await styledQrDataUrl(verifyUrl("PREVIEW"), {
          ...template.qrConfig,
          size: 128,
        });
        setQrPreviews((p) => ({ ...p, [f.id]: url }));
      } catch {}
    });
    // Regenerate if qrConfig changed
  }, [template.qrConfig, template.fields]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent, fieldId: string) => {
      e.stopPropagation();
      const field = template.fields.find((f) => f.id === fieldId);
      if (!field) return;
      onSelectField(fieldId);
      dragging.current = {
        fieldId,
        startX: e.clientX,
        startY: e.clientY,
        startFieldX: field.x,
        startFieldY: field.y,
      };
    },
    [template.fields, onSelectField]
  );

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, fieldId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const field = template.fields.find((f) => f.id === fieldId);
      if (!field || !canvasRef.current) return;
      resizing.current = {
        fieldId,
        startX: e.clientX,
        startY: e.clientY,
        startW: field.width,
        startH: field.height,
      };
    },
    [template.fields]
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();

      if (dragging.current) {
        const dxPct = ((e.clientX - dragging.current.startX) / rect.width) * 100;
        const dyPct = ((e.clientY - dragging.current.startY) / rect.height) * 100;
        const field = template.fields.find((f) => f.id === dragging.current!.fieldId);
        if (!field) return;
        onUpdateField(dragging.current.fieldId, {
          x: Math.max(0, Math.min(100 - field.width, dragging.current.startFieldX + dxPct)),
          y: Math.max(0, Math.min(100 - field.height, dragging.current.startFieldY + dyPct)),
        });
      }

      if (resizing.current) {
        const dxPct = ((e.clientX - resizing.current.startX) / rect.width) * 100;
        const dyPct = ((e.clientY - resizing.current.startY) / rect.height) * 100;
        onUpdateField(resizing.current.fieldId, {
          width: Math.max(5, resizing.current.startW + dxPct),
          height: Math.max(3, resizing.current.startH + dyPct),
        });
      }
    }

    function onMouseUp() {
      dragging.current = null;
      resizing.current = null;
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [template.fields, onUpdateField]);

  return (
    <div className="space-y-4">
      {/* Add field row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Add field:</span>
        {CERT_FIELDS.map((cf) => {
          const exists = template.fields.some((f) => f.fieldKey === cf.key);
          return (
            <button
              key={cf.key}
              onClick={() => onAddField(cf.key)}
              disabled={exists}
              className={`rounded-full px-3 py-1 text-xs border transition-all ${
                exists
                  ? "border-indigo-300 bg-indigo-50 text-indigo-400 cursor-default"
                  : "border-border bg-card hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
              }`}
            >
              {exists ? "✓" : "+"} {cf.label}
            </button>
          );
        })}
      </div>

      {/* Canvas with selected size */}
      <div className="overflow-auto">
        <div
          ref={canvasRef}
          className="template-canvas"
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, maxWidth: "100%" }}
          onClick={() => onSelectField(null)}
        >
          {/* Background image */}
          {template.backgroundUrl ? (
            <img
              src={template.backgroundUrl}
              alt="Certificate background"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl border-2 border-dashed border-border/60 p-8 text-center">
                <ImagePlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No background</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Click "Background" above to upload your certificate design
                </p>
              </div>
            </div>
          )}

          {/* Field overlays */}
          {template.fields.filter((f) => f.visible).map((field) => {
            const isSelected = field.id === selectedFieldId;
            const isQr = field.fieldKey === "qr";

            return (
              <div
                key={field.id}
                className={`field-overlay${isSelected ? " selected" : ""}`}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                }}
                onMouseDown={(e) => onMouseDown(e, field.id)}
              >
                {isQr ? (
                  qrPreviews[field.id] ? (
                    <img
                      src={qrPreviews[field.id]}
                      alt="QR"
                      className="h-full w-full object-contain"
                      draggable={false}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    />
                  ) : (
                    <span className="field-overlay-label">QR Code</span>
                  )
                ) : (
                  <span
                    className="w-full px-1 text-center"
                    style={{
                      fontFamily: field.fontFamily,
                      fontSize: `${field.fontSize * 0.35}px`, // scale for canvas display
                      fontWeight: field.fontWeight,
                      color: field.color,
                      textAlign: field.textAlign,
                      letterSpacing: field.letterSpacing,
                      textTransform: field.textTransform,
                      fontStyle: field.italic ? "italic" : "normal",
                      pointerEvents: "none",
                      userSelect: "none",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {SAMPLE_CERT_DATA[field.fieldKey] ?? field.label}
                  </span>
                )}

                {/* Resize handle */}
                {isSelected && (
                  <div
                    className="resize-handle br"
                    onMouseDown={(e) => onResizeMouseDown(e, field.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag fields to reposition. Drag the bottom-right handle to resize. Click a field to select and style it in the "Field Style" tab.
      </p>
    </div>
  );
}

// ─── Size Selector ───────────────────────────────────────────────────────────

function SizeSelector({
  width,
  height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}) {
  const matchedPreset = SIZE_PRESETS.find((p) => p.w === width && p.h === height);
  const isCustom = !matchedPreset || matchedPreset.label === "Custom";
  const [customW, setCustomW] = useState(String(width));
  const [customH, setCustomH] = useState(String(height));

  useEffect(() => {
    setCustomW(String(width));
    setCustomH(String(height));
  }, [width, height]);

  function applyCustom() {
    const w = Math.max(100, parseInt(customW, 10) || 1122);
    const h = Math.max(100, parseInt(customH, 10) || 794);
    onChange(w, h);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Size:</span>
      <select
        value={isCustom ? "Custom" : (matchedPreset?.label ?? "A4 Landscape")}
        onChange={(e) => {
          const preset = SIZE_PRESETS.find((p) => p.label === e.target.value);
          if (!preset || preset.label === "Custom") return;
          onChange(preset.w, preset.h);
        }}
        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
      >
        {SIZE_PRESETS.map((p) => (
          <option key={p.label} value={p.label}>{p.label}</option>
        ))}
      </select>

      {isCustom && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={100}
            value={customW}
            onChange={(e) => setCustomW(e.target.value)}
            onBlur={applyCustom}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring text-center"
            placeholder="Width"
          />
          <span className="text-xs text-muted-foreground">px</span>
          <span className="text-xs text-muted-foreground">×</span>
          <input
            type="number"
            min={100}
            value={customH}
            onChange={(e) => setCustomH(e.target.value)}
            onBlur={applyCustom}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring text-center"
            placeholder="Height"
          />
          <span className="text-xs text-muted-foreground">px</span>
          <button
            onClick={applyCustom}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs hover:bg-accent"
          >
            Apply
          </button>
        </div>
      )}

      <span className="text-[10px] text-muted-foreground font-mono">
        {width} × {height} px
      </span>
    </div>
  );
}

// ─── Add Field Menu ───────────────────────────────────────────────────────────

function AddFieldMenu({ onAdd, existingKeys }: { onAdd: (key: string) => void; existingKeys: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-6 w-6 place-items-center rounded border border-border bg-card hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-card p-1 shadow-xl">
          {CERT_FIELDS.map((cf) => {
            const isCustomText = cf.key === "custom_text";
            const exists = existingKeys.includes(cf.key) && !isCustomText;
            return (
              <button
                key={cf.key}
                disabled={exists}
                onClick={() => { onAdd(cf.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  exists ? "cursor-default text-muted-foreground/50" : "hover:bg-accent"
                }`}
              >
                {exists ? "✓" : <Plus className="h-3 w-3" />} {cf.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Field Style Panel ────────────────────────────────────────────────────────

function FieldStylePanel({
  field,
  onChange,
}: {
  field: FieldConfig;
  onChange: (patch: Partial<FieldConfig>) => void;
}) {
  const set = <K extends keyof FieldConfig>(k: K, v: FieldConfig[K]) => onChange({ [k]: v });
  const isQr = field.fieldKey === "qr";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{field.label}</h3>
        <button
          onClick={() => set("visible", !field.visible)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title={field.visible ? "Hide field" : "Show field"}
        >
          {field.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {field.visible ? "Visible" : "Hidden"}
        </button>
      </div>

      {/* Custom Text Content */}
      {field.fieldKey === "custom_text" && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Text Content</label>
          <textarea
            value={field.textTemplate || ""}
            onChange={(e) => set("textTemplate", e.target.value)}
            placeholder="E.g., Student of {Department} from {College}"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring min-h-[80px]"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Use {"{VariableName}"} to insert dynamic fields (like {"{participant_name}"} or your Excel columns).
          </p>
        </div>
      )}

      {/* Position & Size */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Position & Size</label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { k: "x", label: "Left (%)", min: 0, max: 95 },
              { k: "y", label: "Top (%)", min: 0, max: 95 },
              { k: "width", label: "Width (%)", min: 5, max: 100 },
              { k: "height", label: "Height (%)", min: 3, max: 100 },
            ] as const
          ).map(({ k, label, min, max }) => (
            <div key={k}>
              <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.5}
                  value={field[k]}
                  onChange={(e) => set(k, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs font-mono">{field[k].toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isQr && (
        <>
          {/* Font */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Font Family</label>
            <select
              value={field.fontFamily}
              onChange={(e) => set("fontFamily", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              style={{ fontFamily: field.fontFamily }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </option>
              ))}
            </select>
            {/* Live font preview */}
            <div
              className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-center overflow-hidden"
              style={{
                fontFamily: field.fontFamily,
                fontSize: Math.min(field.fontSize * 0.6, 40) + "px",
                fontWeight: field.fontWeight,
                color: field.color,
                textAlign: field.textAlign,
                letterSpacing: field.letterSpacing,
                textTransform: field.textTransform,
                fontStyle: field.italic ? "italic" : "normal",
              }}
            >
              {SAMPLE_CERT_DATA[field.fieldKey] ?? field.label}
            </div>
          </div>

          {/* Font size */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Font Size: {field.fontSize}px
            </label>
            <input
              type="range"
              min={8}
              max={120}
              value={field.fontSize}
              onChange={(e) => set("fontSize", Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Font weight */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Font Weight</label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { v: "300", l: "Light" },
                  { v: "400", l: "Regular" },
                  { v: "600", l: "SemiBold" },
                  { v: "700", l: "Bold" },
                  { v: "800", l: "ExtraBold" },
                ] as const
              ).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => set("fontWeight", v)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    field.fontWeight === v
                      ? "bg-navy text-navy-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                  style={{ fontWeight: v }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={field.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-border"
              />
              <input
                type="text"
                value={field.color}
                onChange={(e) => set("color", e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono outline-none focus:border-ring"
              />
            </div>
            {/* Preset colors */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["#0b1a3a", "#c9a24b", "#ffffff", "#000000", "#e63946", "#2a9d8f", "#e76f51", "#264653"].map((c) => (
                <button
                  key={c}
                  onClick={() => set("color", c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: field.color === c ? "#6366f1" : "transparent",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Text formatting */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Formatting</label>
            <div className="flex flex-wrap gap-2">
              {/* Align */}
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => set("textAlign", a)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    field.textAlign === a ? "bg-navy text-navy-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
              {/* Italic */}
              <button
                onClick={() => set("italic", !field.italic)}
                className={`rounded px-2.5 py-1 text-xs italic ${
                  field.italic ? "bg-navy text-navy-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                Italic
              </button>
            </div>
          </div>

          {/* Letter spacing */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Letter Spacing
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { v: "0em", l: "Normal" },
                  { v: "0.05em", l: "Wide" },
                  { v: "0.1em", l: "Wider" },
                  { v: "0.2em", l: "Widest" },
                  { v: "0.35em", l: "Ultra" },
                ] as const
              ).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => set("letterSpacing", v)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    field.letterSpacing === v ? "bg-navy text-navy-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Text transform */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Transform</label>
            <div className="flex gap-1.5">
              {(
                [
                  { v: "none", l: "None" },
                  { v: "uppercase", l: "UPPER" },
                  { v: "capitalize", l: "Title" },
                ] as const
              ).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => set("textTransform", v)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    field.textTransform === v ? "bg-navy text-navy-foreground" : "bg-muted text-muted-foreground"
                  }`}
                  style={{ textTransform: v }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs min-w-[90px] text-left outline-none focus:border-ring"
      >
        {value.length === 0 ? placeholder : value.join(", ")}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-xl">
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-accent">
              <input
                type="checkbox"
                checked={value.includes(o)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, o] : value.filter((v) => v !== o))
                }
                className="rounded"
              />
              <span className="text-xs">{o}</span>
            </label>
          ))}
          <div className="mt-1 border-t border-border pt-1">
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full rounded px-3 py-1 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Clear (all)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
