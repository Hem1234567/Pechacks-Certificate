import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Award, Search, ScanLine } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PEC Hacks 4.0 — Certificate Portal" },
      { name: "description", content: "Verify PEC Hacks 4.0 certificates instantly. Enter a certificate ID or scan its QR code." },
      { property: "og:title", content: "PEC Hacks 4.0 — Certificate Portal" },
      { property: "og:description", content: "Verify PEC Hacks 4.0 certificates instantly. Enter a certificate ID or scan its QR code." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [id, setId] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 h-12">
          <Link to="/" className="flex items-center">
            <img
              src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1784998453/uploads/media-converter/nkjufde8hggarqze8ejd.png"
              alt="Panimalar Engineering College"
              className="h-10 w-10 object-contain scale-[2.5] origin-left relative z-50"
            />
          </Link>

        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-accent px-3 py-1 text-xs font-medium text-navy">
            <ShieldCheck className="h-3.5 w-3.5" /> Official verification portal
          </div>
          <h1 className="font-serif text-5xl leading-tight md:text-6xl">
            Authenticity for every <span className="gold-text">PEC Hacks 4.0</span> certificate
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Every certificate carries a unique ID and QR code. Scan it, or enter the ID below to confirm it is valid.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = id.trim();
              if (!clean) return;
              navigate({ to: "/verify", search: { id: clean } });
            }}
            className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Enter certificate ID (e.g. PECH4-2026-…)"
                className="w-full bg-transparent py-3 text-sm outline-none"
                maxLength={64}
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-navy px-5 py-3 text-sm font-medium text-navy-foreground hover:opacity-90"
            >
              Verify
            </button>
          </form>
        </div>

        <div className="mx-auto mt-24 grid max-w-4xl gap-6 md:grid-cols-3">
          {[
            { icon: Award, title: "Officially issued", body: "Certificates are generated and signed by PEC Hacks administrators." },
            { icon: ScanLine, title: "QR verifiable", body: "Every certificate ships with a scannable QR code linking to this portal." },
            { icon: ShieldCheck, title: "Instant status", body: "Get a valid, revoked, or invalid decision within a second." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-navy">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-serif text-xl">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PEC Hacks 4.0 · Certificate Portal
      </footer>
    </div>
  );
}
