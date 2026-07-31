import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Family Academy" },
      {
        name: "description",
        content:
          "Acesse a plataforma de aulas da Family Academy: chamada por QR code, turmas e frequência.",
      },
      { property: "og:title", content: "Entrar — Family Academy" },
      {
        property: "og:description",
        content: "Plataforma de aulas da Family Academy com chamada por QR code.",
      },
    ],
  }),
  component: Entrada,
});

const esquemaLogin = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  senha: z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(72),
});

function Entrada() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"login" | "convite">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquemaLogin.safeParse({ email, senha });
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: r.data.email,
      password: r.data.senha,
    });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível entrar. Confira e-mail e senha.");
      return;
    }
    navigate({ to: "/painel" });
  }

  function irParaConvite(e: React.FormEvent) {
    e.preventDefault();
    const cod = convite.trim().toUpperCase();
    if (!cod) {
      toast.error("Informe o código de convite da sala");
      return;
    }
    navigate({ to: "/matricula/$convite", params: { convite: cod } });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <FundoMarca />

      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary font-display text-lg font-extrabold text-sidebar-primary-foreground">
            FA
          </div>
          <div className="leading-tight">
            <h1 className="text-xl text-white">Family Academy</h1>
            <p className="text-[11px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
              Escola de Finanças
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-diario">
          {modo === "login" ? (
            <form onSubmit={entrar} className="space-y-4">
              <h2 className="text-lg">Entrar</h2>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          ) : (
            <form onSubmit={irParaConvite} className="space-y-4">
              <h2 className="text-lg">Sou aluno novo</h2>
              <p className="text-sm text-muted-foreground">
                Escaneie o QR da sala ou digite o código de convite que o coordenador passou.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="convite">Código de convite</Label>
                <Input
                  id="convite"
                  value={convite}
                  onChange={(e) => setConvite(e.target.value)}
                  placeholder="SALA-4F2K9X"
                  className="font-mono uppercase"
                />
              </div>
              <Button type="submit" className="w-full">
                <GraduationCap className="size-4" /> Continuar
              </Button>
            </form>
          )}

          <div className="mt-4 border-t pt-4 text-center">
            <button
              type="button"
              onClick={() => setModo(modo === "login" ? "convite" : "login")}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              {modo === "login" ? "Sou aluno novo, tenho um convite" : "Já tenho conta, quero entrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
