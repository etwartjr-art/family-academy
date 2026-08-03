import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { GraduationCap } from "lucide-react";
import { FundoMarca } from "@/components/FundoMarca";
import logoAsset from "@/assets/logo-escola-financas-academy.jpg.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Escola de Finanças" },
      {
        name: "description",
        content:
          "Acesse a plataforma de aulas da Escola de Finanças: chamada por QR code, turmas e frequência.",
      },
      { property: "og:title", content: "Entrar — Escola de Finanças" },
      {
        property: "og:description",
        content: "Plataforma de aulas da Escola de Finanças com chamada por QR code.",
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
      <FundoMarca tom="escuro" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-1.5 text-center">
          <img
            src={logoAsset.url}
            alt="Escola de Finanças"
            className="h-32 w-auto rounded-2xl shadow-lg"
          />
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-sidebar-foreground">
            Escola de Finanças
          </h1>
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
              <div className="text-center">
                <Link
                  to="/esqueci-senha"
                  className="text-sm text-muted-foreground underline underline-offset-4"
                >
                  Esqueci minha senha
                </Link>
              </div>
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
