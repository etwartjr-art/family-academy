import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { FundoMarca } from "@/components/FundoMarca";
import logoAsset from "@/assets/logo-escola-financas-academy.jpg.asset.json";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha — Escola de Finanças" },
      {
        name: "description",
        content:
          "Receba por e-mail um link seguro com validade limitada para criar uma nova senha de acesso à Escola de Finanças.",
      },
      { property: "og:title", content: "Esqueci minha senha — Escola de Finanças" },
      {
        property: "og:description",
        content: "Recupere o acesso à plataforma da Escola de Finanças por e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EsqueciSenha,
});

const esquema = z.object({ email: z.string().trim().email("E-mail inválido").max(255) });

function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquema.safeParse({ email });
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(r.data.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviando(false);
    if (error) {
      if (error.message.toLowerCase().includes("rate")) {
        toast.error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        return;
      }
      toast.error("Não foi possível enviar o e-mail agora. Tente novamente.");
      return;
    }
    setEnviado(true);
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
          {enviado ? (
            <div className="space-y-3 text-center">
              <MailCheck className="mx-auto size-8 text-primary" />
              <h2 className="text-lg">Verifique seu e-mail</h2>
              <p className="text-sm text-muted-foreground">
                Se existir uma conta com <strong>{email}</strong>, enviamos um link para criar uma
                nova senha. O link é de uso único e expira em cerca de 1 hora.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              <h2 className="text-lg">Esqueci minha senha</h2>
              <p className="text-sm text-muted-foreground">
                Informe o e-mail cadastrado. Enviaremos um link seguro, com prazo de validade, para
                você criar uma nova senha.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar link de recuperação"}
              </Button>
            </form>
          )}

          <div className="mt-4 border-t pt-4 text-center">
            <Link to="/" className="text-sm font-medium text-primary underline underline-offset-4">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
