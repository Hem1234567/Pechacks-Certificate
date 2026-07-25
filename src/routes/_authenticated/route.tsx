import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/integrations/firebase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await auth.authStateReady();
    if (!auth.currentUser) throw redirect({ to: "/admindashboard" });
    return { user: auth.currentUser };
  },
  component: () => <Outlet />,
});
