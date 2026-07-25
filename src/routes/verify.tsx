import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, type Cert } from "@/integrations/firebase/client";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Award, ExternalLink } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ id: z.string().trim().max(64).optional() });

export const Route = createFileRoute("/verify")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Verify Certificate — PEC Hacks 4.0" },
      { name: "description", content: "Check the validity of a PEC Hacks 4.0 certificate." },
      { property: "og:title", content: "Verify Certificate — PEC Hacks 4.0" },
      { property: "og:description", content: "Check the validity of a PEC Hacks 4.0 certificate." },
    ],
  }),
  component: VerifyPage,
});

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "valid"; cert: Cert }
  | { kind: "revoked"; cert: Cert }
  | { kind: "invalid" }
  | { kind: "error" };

function VerifyPage() {
  const { id } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: id ? "loading" : "idle" });
  const [input, setInput] = useState(id ?? "");

  useEffect(() => {
    if (!id) return;
    setState({ kind: "loading" });
    (async () => {
      try {
        const docRef = doc(db, "certificates", id);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return setState({ kind: "invalid" });
        const row = docSnap.data() as Cert;
        
        // Fire-and-forget scan increment
        updateDoc(docRef, { scan_count: increment(1) }).catch(console.error);

        if (row.status === "revoked") setState({ kind: "revoked", cert: row });
        else setState({ kind: "valid", cert: row });
      } catch (e) {
        console.error(e);
        setState({ kind: "error" });
      }
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 h-12">
          <Link to="/" className="flex items-center">
            <img
              src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1784998453/uploads/media-converter/nkjufde8hggarqze8ejd.png"
              alt="Panimalar Engineering College"
              className="h-10 w-10 object-contain scale-[2.5] origin-left relative z-50"
            />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = input.trim();
            if (!clean) return;
            window.history.replaceState(null, "", `/verify?id=${encodeURIComponent(clean)}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
            // Simplest: navigate
            window.location.href = `/verify?id=${encodeURIComponent(clean)}`;
          }}
          className="mb-8 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Certificate ID"
            className="flex-1 rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none focus:border-ring"
            maxLength={64}
          />
          <button className="rounded-lg bg-navy px-5 py-3 text-sm font-medium text-navy-foreground hover:opacity-90">
            Verify
          </button>
        </form>

        <ResultCard state={state} />
      </div>
    </div>
  );
}

function ResultCard({ state }: { state: State }) {
  if (state.kind === "idle")
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Enter a certificate ID to begin verification.
      </div>
    );

  if (state.kind === "loading")
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (state.kind === "error")
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h2 className="mt-3 font-serif text-2xl">Verification unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">Please try again in a moment.</p>
      </div>
    );

  if (state.kind === "invalid")
    return (
      <div className="rounded-2xl border-2 border-destructive/30 bg-card p-10 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/10">
          <XCircle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="mt-4 font-serif text-3xl">Invalid Certificate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This certificate does not exist in our records.
        </p>
      </div>
    );

  if (state.kind === "revoked") {
    const c = state.cert;
    return (
      <div className="rounded-2xl border-2 border-warning/40 bg-card p-10">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-warning/15">
            <AlertTriangle className="h-12 w-12 text-warning" />
          </div>
          <h2 className="mt-4 font-serif text-3xl">Certificate Revoked</h2>
          {c.revoke_reason && (
            <p className="mt-2 text-sm text-muted-foreground">Reason: {c.revoke_reason}</p>
          )}
        </div>
        <Details cert={c} muted />
      </div>
    );
  }

  const c = state.cert;
  return (
    <div className="rounded-2xl border-2 border-success/30 bg-card p-10">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
        <h2 className="mt-4 font-serif text-3xl">Certificate Verified</h2>
        <p className="mt-2 text-sm text-muted-foreground">This certificate is valid and authentic.</p>
      </div>
      <Details cert={c} />
      <div className="mt-6 text-center">
        <a
          href={`/certificate/${c.certificate_id}`}
          className="inline-flex items-center gap-1 text-sm text-navy hover:underline"
        >
          View certificate <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function Details({ cert, muted = false }: { cert: Cert; muted?: boolean }) {
  const rows: [string, string | null][] = [
    ["Participant", cert.participant_name],
    ["Role", cert.role],
    ["Certificate Type", cert.certificate_type],
    ["Team", cert.team_name],
    ["Project", cert.project_name],
    ["College", cert.college],
    ["Event", cert.event_name],
    ["Event Date", cert.event_date],
    ["Certificate ID", cert.certificate_id],
    ["Issued", new Date(cert.issued_at).toLocaleDateString()],
  ];
  return (
    <dl className={`mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2 ${muted ? "opacity-70" : ""}`}>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="border-b border-border/60 pb-2">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
