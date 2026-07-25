import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, type Cert } from "@/integrations/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { qrDataUrl, verifyUrl, downloadCertificatePdf } from "@/lib/certificate-utils";
import { Award, Download, Printer, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/certificate/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Certificate ${params.id} — PEC Hacks 4.0` },
      { name: "description", content: `Official PEC Hacks 4.0 certificate ${params.id}. Scan the QR code to verify.` },
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
        <Link to="/" className="mt-4 inline-block text-sm text-navy hover:underline">Back home</Link>
      </div>
    </div>
  ),
});

function CertificatePage() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<Cert | null>(null);
  const [qr, setQr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFound] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, "certificates", id));
        if (!docSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const row = docSnap.data() as Cert;
        setCert(row);
        setQr(await qrDataUrl(verifyUrl(row.certificate_id), 512));
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
      <div className="no-print mx-auto mb-6 flex max-w-[297mm] items-center justify-between px-4">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
          >
            <Printer className="h-4 w-4" /> Print
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
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm text-navy-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pdfStatus ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {pdfStatus}</>
            ) : (
              <><Download className="h-4 w-4" /> Download PDF</>
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto grid place-items-center">
        <CertificateSheet cert={cert} qr={qr} />
      </div>
    </div>
  );
}

function CertificateSheet({ cert, qr }: { cert: Cert; qr: string }) {
  return (
    <div id="certificate-print" className="certificate-sheet">
      <div className="certificate-border" />

      {/* Corner ornaments */}
      {[
        "top-[16mm] left-[16mm]",
        "top-[16mm] right-[16mm]",
        "bottom-[16mm] left-[16mm]",
        "bottom-[16mm] right-[16mm]",
      ].map((pos, i) => (
        <div key={i} className={`absolute ${pos}`}>
          <Award className="h-6 w-6" style={{ color: "#c9a24b" }} />
        </div>
      ))}

      <div className="relative flex h-full flex-col items-center px-24 pt-28 pb-20 text-center">
        {/* Panimalar logo — top-left */}
        <div className="absolute top-[20mm] left-[22mm]">
          <img
            src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1784998453/uploads/media-converter/nkjufde8hggarqze8ejd.png"
            alt="Panimalar Engineering College"
            className="h-40 w-40 object-contain"
            crossOrigin="anonymous"
          />
        </div>

        <div className="mt-24 flex flex-col items-center">
          <p className="text-[13px] uppercase tracking-[0.35em] gold-text">Panimalar Engineering College</p>
        </div>

        <div className="gold-divider mt-6 w-40" />

        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] gold-text">Certificate of {cert.certificate_type}</p>
        <p className="mt-8 text-sm navy-text/70" style={{ color: "rgba(11,26,58,0.65)" }}>
          This certificate is proudly presented to
        </p>
        <h1 className="mt-3 font-serif text-6xl navy-text" style={{ fontFamily: "Cormorant Garamond, serif" }}>
          {cert.participant_name}
        </h1>
        <div className="gold-divider mt-6 w-64" />

        <p className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed" style={{ color: "rgba(11,26,58,0.75)" }}>
          for their outstanding contribution as{" "}
          <span className="font-semibold navy-text">{cert.role}</span>
          {cert.team_name && <> with team <span className="font-semibold navy-text">{cert.team_name}</span></>}
          {cert.project_name && <>, presenting the project <span className="italic navy-text">"{cert.project_name}"</span></>}
          {cert.college && <>, representing <span className="navy-text">{cert.college}</span></>}
          {" "}at {cert.event_name}
          {cert.event_date && <>, {cert.event_date}</>}.
        </p>

        <div className="mt-auto flex w-full items-end justify-between pt-10">
          <div className="text-left">
            <div className="h-12" />
            <div className="w-56 border-t border-[#0b1a3a]/40 pt-1 text-[11px] uppercase tracking-widest" style={{ color: "rgba(11,26,58,0.7)" }}>
              Organising Committee
            </div>
          </div>
          <div className="text-center">
            {qr ? (
              <img src={qr} alt="Verification QR" className="h-24 w-24" />
            ) : (
              <div className="h-24 w-24 rounded bg-black/5" />
            )}
            <p className="mt-1 text-[9px] uppercase tracking-widest gold-text">Scan to verify</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-widest gold-text">Certificate ID</p>
            <p className="mt-1 font-mono text-sm navy-text">{cert.certificate_id}</p>
            <p className="mt-3 text-[10px]" style={{ color: "rgba(11,26,58,0.6)" }}>
              Issued {new Date(cert.issued_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
