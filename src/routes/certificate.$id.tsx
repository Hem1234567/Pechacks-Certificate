import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  db,
  type Cert,
  type CertificateTemplate,
  type FieldConfig,
} from "@/integrations/firebase/client";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import {
  styledQrDataUrl,
  verifyUrl,
  downloadCertificatePdf,
  DEFAULT_QR_CONFIG,
} from "@/lib/certificate-utils";
import { Award, Download, Printer, Loader2, ArrowLeft } from "lucide-react";
import { CertificateSheet, DynamicCertificateSheet } from "@/components/CertificateRenderer";

export const Route = createFileRoute("/certificate/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Certificate ${params.id} — PEC Hacks 4.0` },
      {
        name: "description",
        content: `Official PEC Hacks 4.0 certificate ${params.id}. Scan the QR code to verify.`,
      },
      { property: "og:title", content: `Certificate ${params.id} — PEC Hacks 4.0` },
      { property: "og:description", content: "Official PEC Hacks 4.0 certificate. Scan to verify." },
    ],
  }),
  component: CertificatePage,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      Failed to load certificate: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="font-serif text-3xl">Certificate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This certificate ID does not exist.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-navy hover:underline">
          Back home
        </Link>
      </div>
    </div>
  ),
});

function CertificatePage() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [template, setTemplate] = useState<CertificateTemplate | null | undefined>(undefined); // undefined = loading
  const [qr, setQr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFound] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 1. Load certificate
        const docSnap = await getDoc(doc(db, "certificates", id));
        if (!docSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const row = docSnap.data() as Cert;
        setCert(row);

        // 2. Find matching template — direct link first, then role/type auto-match
        let tSnap;
        if (row.projectId && row.projectId !== "default") {
          tSnap = await getDocs(query(collection(db, "certificate_templates"), where("projectId", "==", row.projectId), orderBy("updatedAt", "desc")));
        } else {
          tSnap = await getDocs(query(collection(db, "certificate_templates"), where("projectId", "in", ["", null, "default"]), orderBy("updatedAt", "desc")));
        }
        const templates = tSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as CertificateTemplate));

        const matched =
          // Priority 1: explicit templateId set during import/create
          (row.templateId ? templates.find((t) => t.id === row.templateId) : null) ??
          // Priority 2: auto-match by role / certificate_type
          templates.find((t) => {
            const roleMatch = t.applyToRoles.length === 0 || t.applyToRoles.includes(row.role);
            const typeMatch =
              t.applyToTypes.length === 0 || t.applyToTypes.includes(row.certificate_type);
            return roleMatch && typeMatch;
          }) ??
          null;

        setTemplate(matched);

        // 3. Generate QR using template's config (or default)
        const qrConfig = matched?.qrConfig ?? DEFAULT_QR_CONFIG;
        setQr(await styledQrDataUrl(verifyUrl(row.certificate_id), { ...qrConfig, size: 512 }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (notFoundFlag || !cert) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-[297mm] flex-wrap items-center justify-between gap-3 px-4">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 sm:px-4 py-2 text-sm hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={() =>
              downloadCertificatePdf(
                "certificate-print",
                `${cert.certificate_id}.pdf`,
                setPdfStatus
              )
            }
            disabled={!!pdfStatus}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-3 sm:px-4 py-2 text-sm text-navy-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pdfStatus ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {pdfStatus}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto grid place-items-center">
        {template && template.fields.length > 0 ? (
          // ── Custom template rendering ──
          <DynamicCertificateSheet cert={cert} template={template} qr={qr} />
        ) : (
          // ── Fallback: original hardcoded design ──
          <CertificateSheet cert={cert} qr={qr} />
        )}
      </div>
    </div>
  );
}


