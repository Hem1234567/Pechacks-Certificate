import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/integrations/firebase/client";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/admindashboard")({
  head: () => ({
    meta: [
      { title: "Admin Login — Panimalar Engineering College" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate({ to: "/admin", replace: true });
    });
    return () => unsub();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
      navigate({ to: "/admin", replace: true });
    } catch {
      toast.error("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="mb-8 flex flex-col items-center gap-3">
          <img
            src="https://res.cloudinary.com/dzf0ggbrg/image/upload/v1785113095/uploads/media-converter/rpgoiz586azlmezzgfwu.png"
            alt="PEC Hacks 4.0"
            className="h-20 w-auto sm:h-24 object-contain"
          />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Panimalar Engineering College
          </p>
        </Link>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-navy/10">
              <Lock className="h-5 w-5 text-navy" />
            </div>
            <div>
              <h1 className="font-serif text-2xl leading-none">Admin Login</h1>
              <p className="mt-1 text-xs text-muted-foreground">Authorised administrators only.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                autoComplete="email"
              />
            </div>

            {/* Password with eye toggle */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-navy-foreground hover:opacity-90 disabled:opacity-60 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to portal</Link>
        </p>
      </div>
    </div>
  );
}
