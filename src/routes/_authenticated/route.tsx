import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/integrations/firebase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await auth.authStateReady();
    if (!auth.currentUser) throw redirect({ to: "/admindashboard" });
    return { user: auth.currentUser };
  },
  pendingComponent: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/20">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent"></div>
        <p className="text-sm font-medium text-navy">Authenticating...</p>
      </div>
    </div>
  ),
  component: () => <Outlet />,
});
