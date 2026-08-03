import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });

    if (location.pathname !== "/trocar-senha") {
      const { data: perfil } = await supabase
        .from("perfis")
        .select("senha_provisoria")
        .eq("id", data.user.id)
        .maybeSingle();
      if (perfil?.senha_provisoria) throw redirect({ to: "/trocar-senha" });
    }

    return { user: data.user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
