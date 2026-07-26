import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  db,
  type Cert,
  type CertificateTemplate,
} from "@/integrations/firebase/client";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  QrCode,
  Search,
  Users,
} from "lucide-react";
import { styledQrDataUrl, verifyUrl, downloadCertificatePdf, DEFAULT_QR_CONFIG } from "@/lib/certificate-utils";

export const Route = createFileRoute("/_authenticated/bulk-preview")({
  head: () => ({
    meta: [
      { title: "Bulk Certificate Preview — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BulkPreviewPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────

type CertRow = Cert & { verifyLink: string };

// ─── Page ──────────────────────────────────────────────────────────────────

function BulkPreviewPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<string>("__all__");
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [filtered, setFiltered] = useState<CertRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const s = search.trim().toLowerCase();
    setFiltered(
      s
        ? certs.filter(
            (c) =>
              c.participant_name.toLowerCase().includes(s) ||
              c.certificate_id.toLowerCase().includes(s) ||
              (c.role?.toLowerCase().includes(s)) ||
              (c.team_name?.toLowerCase().includes(s))
          )
        : certs
    );
  }, [search, certs]);

  async function loadAll() {
    setLoading(true);
    try {
      const [tplSnap, certSnap] = await Promise.all([
        getDocs(query(collection(db, "certificate_templates"), orderBy("updatedAt", "desc"))),
        getDocs(query(collection(db, "certificates"), orderBy("issued_at", "desc"))),
      ]);

      const tplList = tplSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CertificateTemplate));
      setTemplates(tplList);

      const certList = certSnap.docs.map((d) => {
        const row = { id: d.id, ...d.data() } as Cert;
        return { ...row, verifyLink: verifyUrl(row.certificate_id) };
      });
      setCerts(certList);
      setFiltered(certList);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Find which template applies to a cert
  function matchTemplate(cert: Cert): CertificateTemplate | null {
    return (
      templates.find((t) => {
        const roleMatch = t.applyToRoles.length === 0 || t.applyToRoles.includes(cert.role);
        const typeMatch = t.applyToTypes.length === 0 || t.applyToTypes.includes(cert.certificate_type);
        return roleMatch && typeMatch;
      }) ?? null
    );
  }

  // Filter by selected template
  const displayCerts =
    selectedTplId === "__all__"
      ? filtered
      : selectedTplId === "__none__"
      ? filtered.filter((c) => !matchTemplate(c))
      : filtered.filter((c) => matchTemplate(c)?.id === selectedTplId);

  // Copy all verify links
  function copyAllLinks() {
    const text = displayCerts.map((c) => `${c.participant_name}: ${c.verifyLink}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`Copied ${displayCerts.length} verification links`);
  }

  // Download single cert as PDF by opening its page and triggering PDF
  function openCert(cert: Cert) {
    window.open(`/certificate/${cert.certificate_id}`, "_blank");
  }

  // Bulk open all certs as tabs (browser may block after first few — user can allow)
  function bulkOpenAll() {
    if (displayCerts.length > 20) {
      if (!confirm(`This will open ${displayCerts.length} tabs. Continue?`)) return;
    }
    displayCerts.forEach((c, i) => {
      setTimeout(() => window.open(`/certificate/${c.certificate_id}`, "_blank"), i * 150);
    });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6 h-14">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Bulk Certificate Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAllLinks}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : `Copy ${displayCerts.length} Links`}
          </button>
          <button
            onClick={bulkOpenAll}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-1.5 text-sm text-navy-foreground hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open All ({displayCerts.length})
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats bar */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatPill label="Total certificates" value={certs.length} />
          <StatPill label="Templates" value={templates.length} />
          <StatPill label="Showing" value={displayCerts.length} />
          <StatPill
            label="No template"
            value={certs.filter((c) => !matchTemplate(c)).length}
            warn
          />
        </div>

        {/* Workflow hint */}
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="text-sm font-semibold text-indigo-800 mb-1 flex items-center gap-2">
            <FileText className="h-4 w-4" /> How the Bulk Workflow Works
          </h2>
          <ol className="text-xs text-indigo-700 space-y-1 list-decimal list-inside">
            <li>
              Go to{" "}
              <Link to="/templates" className="underline font-medium">
                Template Builder
              </Link>{" "}
              → design your certificate (background, field positions, font, QR style) → <strong>Save</strong>
            </li>
            <li>
              Go to{" "}
              <Link to="/admin" className="underline font-medium">
                Admin Dashboard
              </Link>{" "}
              → click <strong>Import Excel</strong> → upload your participants spreadsheet
            </li>
            <li>
              Every certificate now auto-uses your template — each person's name, QR code, and verify
              link are unique to them
            </li>
            <li>
              Share verify links below, or click <strong>Open All</strong> to open each certificate
              (then use Print → Save as PDF for individual downloads)
            </li>
          </ol>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search name, ID, team, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-card pl-9 pr-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </div>

          {/* Template filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Template:</span>
            <select
              value={selectedTplId}
              onChange={(e) => setSelectedTplId(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm"
            >
              <option value="__all__">All certificates</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__none__">No matching template</option>
            </select>
          </div>
        </div>

        {/* Certificate table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Participant</th>
                  <th className="px-4 py-3">Role / Type</th>
                  <th className="px-4 py-3">Template Applied</th>
                  <th className="px-4 py-3">Certificate ID</th>
                  <th className="px-4 py-3">Verify Link</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayCerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      {search ? "No certificates match your search." : "No certificates found."}
                    </td>
                  </tr>
                ) : (
                  displayCerts.map((cert, idx) => {
                    const tpl = matchTemplate(cert);
                    return (
                      <CertRow
                        key={cert.id}
                        idx={idx + 1}
                        cert={cert}
                        template={tpl}
                        onOpen={() => openCert(cert)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {displayCerts.length} of {certs.length} total certificates</span>
            <button
              onClick={copyAllLinks}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy all verify links
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single row component ──────────────────────────────────────────────────

function CertRow({
  idx,
  cert,
  template,
  onOpen,
}: {
  idx: number;
  cert: CertRow;
  template: CertificateTemplate | null;
  onOpen: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(cert.verifyLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3 text-xs text-muted-foreground">{idx}</td>
      <td className="px-4 py-3">
        <div className="font-medium">{cert.participant_name}</div>
        {cert.team_name && (
          <div className="text-xs text-muted-foreground">{cert.team_name}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-xs">
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5">{cert.role}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{cert.certificate_type}</div>
      </td>
      <td className="px-4 py-3">
        {template ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            <Check className="h-3 w-3" /> {template.name}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            Default design
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {cert.certificate_id}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="max-w-[160px] truncate text-xs text-muted-foreground">
            {cert.verifyLink}
          </span>
          <button
            onClick={copyLink}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Copy verify link"
          >
            {linkCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onOpen}
            title="Open certificate in new tab"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Stat pill ─────────────────────────────────────────────────────────────

function StatPill({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-serif ${warn && value > 0 ? "text-amber-600" : "navy-text"}`}>
        {value}
      </p>
    </div>
  );
}
