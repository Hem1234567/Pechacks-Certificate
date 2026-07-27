import { Award } from "lucide-react";
import type { Cert, CertificateTemplate, FieldConfig } from "@/integrations/firebase/client";

// ─── Dynamic Certificate Sheet ────────────────────────────────────────────────

export function DynamicCertificateSheet({
  cert,
  template,
  qr,
  id = "certificate-print",
}: {
  cert: Cert;
  template: CertificateTemplate;
  qr: string;
  id?: string;
}) {
  function resolveFieldValue(field: FieldConfig): React.ReactNode {
    const key = field.fieldKey as keyof Cert;
    if (key === ("qr" as any)) return "";

    if (key === ("custom_text" as any)) {
      if (!field.textTemplate) return "";
      
      const interpolate = (text: string) => {
        return text.replace(/\{([^}]+)\}/g, (match, varName) => {
          const v = varName.trim();
          let val: any = undefined;
          
          // Map friendly names
          if (v === "Name" || v === "Participant" || v === "participant_name") val = cert.participant_name;
          else if (v === "Team" || v === "team_name") val = cert.team_name;
          else if (v === "Project" || v === "project_name") val = cert.project_name;
          else if (v === "Role" || v === "role") val = cert.role;
          else if (v === "College" || v === "college") val = cert.college;
          else if (v === "Type" || v === "certificate_type") val = cert.certificate_type;
          else if (v === "Event" || v === "event_name") val = cert.event_name;
          else if (v === "Date" || v === "event_date") val = cert.event_date;
          else if (v === "Issued" || v === "issued_at") val = new Date(cert.issued_at).toLocaleDateString();
          else if (v === "Certificate ID" || v === "certificate_id") val = cert.certificate_id;
          else if (cert.customData && cert.customData[v] !== undefined) val = cert.customData[v];
          // Also try lowercase matching for customData
          else if (cert.customData) {
             const keyMatch = Object.keys(cert.customData).find(k => k.toLowerCase() === v.toLowerCase());
             if (keyMatch) val = cert.customData[keyMatch];
          }

          return val !== undefined && val !== null ? String(val) : match;
        });
      };

      const lines = field.textTemplate.split('\n');
      return (
        <>
          {lines.map((line, i) => (
            <span key={i}>
              {interpolate(line)}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </>
      );
    }

    let raw = cert[key];
    if (raw === null || raw === undefined) {
      if (cert.customData && cert.customData[key as string] !== undefined) {
        raw = cert.customData[key as string] as any;
      } else {
        return "";
      }
    }
    if (key === "issued_at") return new Date(raw as string).toLocaleDateString();
    return String(raw);
  }

  return (
    <div
      id={id}
      className="certificate-sheet"
      style={{
        position: "relative",
        overflow: "hidden",
        "--cert-width": template.canvasWidth ? `${template.canvasWidth}px` : "297mm",
        "--cert-height": template.canvasHeight ? `${template.canvasHeight}px` : "210mm",
      } as React.CSSProperties}
    >
      {/* Background */}
      {template.backgroundUrl && (
        <img
          src={template.backgroundUrl}
          alt="Certificate background"
          className="absolute inset-0 h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      )}

      {/* Fields */}
      {template.fields
        .filter((f) => f.visible)
        .map((field) => {
          const isQr = field.fieldKey === "qr";
          return (
            <div
              key={field.id}
              style={{
                position: "absolute",
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
                display: "flex",
                alignItems: "center",
                justifyContent:
                  field.textAlign === "left"
                    ? "flex-start"
                    : field.textAlign === "right"
                      ? "flex-end"
                      : "center",
              }}
            >
              {isQr ? (
                qr ? (
                  <img
                    src={qr}
                    alt="Verification QR"
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    crossOrigin="anonymous"
                  />
                ) : null
              ) : (
                <span
                  style={{
                    fontFamily: field.fontFamily,
                    fontSize: `${field.fontSize}px`,
                    fontWeight: field.fontWeight,
                    color: field.color,
                    textAlign: field.textAlign,
                    letterSpacing: field.letterSpacing,
                    textTransform: field.textTransform,
                    fontStyle: field.italic ? "italic" : "normal",
                    width: "100%",
                    display: "block",
                  }}
                >
                  {resolveFieldValue(field)}
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ─── Fallback: Original hardcoded certificate design ─────────────────────────

export function CertificateSheet({ cert, qr, id = "certificate-print" }: { cert: Cert; qr: string; id?: string }) {
  return (
    <div id={id} className="certificate-sheet">
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
          <p className="text-[13px] uppercase tracking-[0.35em] gold-text">
            Panimalar Engineering College
          </p>
        </div>

        <div className="gold-divider mt-6 w-40" />

        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] gold-text">
          Certificate of {cert.certificate_type}
        </p>
        <p className="mt-8 text-sm navy-text/70" style={{ color: "rgba(11,26,58,0.65)" }}>
          This certificate is proudly presented to
        </p>
        <h1
          className="mt-3 font-serif text-6xl navy-text"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          {cert.participant_name}
        </h1>
        <div className="gold-divider mt-6 w-64" />

        <p
          className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed"
          style={{ color: "rgba(11,26,58,0.75)" }}
        >
          for their outstanding contribution as{" "}
          <span className="font-semibold navy-text">{cert.role}</span>
          {cert.team_name && (
            <>
              {" "}
              with team <span className="font-semibold navy-text">{cert.team_name}</span>
            </>
          )}
          {cert.project_name && (
            <>
              , presenting the project{" "}
              <span className="italic navy-text">"{cert.project_name}"</span>
            </>
          )}
          {cert.college && (
            <>
              , representing <span className="navy-text">{cert.college}</span>
            </>
          )}
          {" "}at {cert.event_name}
          {cert.event_date && <>, {cert.event_date}</>}.
        </p>

        <div className="mt-auto flex w-full items-end justify-between pt-10">
          <div className="text-left">
            <div className="h-12" />
            <div
              className="w-56 border-t border-[#0b1a3a]/40 pt-1 text-[11px] uppercase tracking-widest"
              style={{ color: "rgba(11,26,58,0.7)" }}
            >
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
