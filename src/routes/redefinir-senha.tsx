import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FundoMarca } from "@/components/FundoMarca";
import { SENHA_MINIMA, SENHA_PADRAO } from "@/lib/senha-padrao";
import { mensagemAuth } from "@/lib/usuarios-erros";
import logoAsset from "@/assets/logo-escola-financas-academy.jpg.asset.json";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar nova senha — Escola de Finanças" },
      {
        name: "description",
        content:
          "Use o link recebido por e-mail para definir uma nova senha de acesso à plataforma da Escola de Finanças.",
      },
      { property: "og:title", content: "Criar nova senha — Escola de Finanças" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso à Escola de Finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RedefinirSenha,
});

type Estado = "verificando" | "pronto" | "invalido";

function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    // Erro vindo do link (token expirado ou já usado) chega no hash da URL.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      setEstado("invalido");
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY" || sessao) setEstado("pronto");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setEstado(data.session ? "pronto" : "invalido");
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova.length < SENHA_MINIMA) {
      toast.error(`A senha precisa de ao menos ${SENHA_MINIMA} caracteres`);
      return;
    }
    if (nova === SENHA_PADRAO) {
      toast.error("Escolha uma senha diferente da senha padrão");
      return;
    }
    if (nova !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) {
      setSalvando(false);
      toast.error(mensagemAuth(error.message));
      return;
    }
    const { data: sessao } = await supabase.auth.getUser();
    if (sessao.user) {
      await supabase.from("perfis").update({ senha_provisoria: false }).eq("id", sessao.user.id);
    }
    setSalvando(false);
    toast.success("Senha atualizada! Bem-vindo de volta.");
    navigate({ to: "/painel" });
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
          {estado === "verificando" && (
            <p className="text-sm text-muted-foreground">Validando seu link…</p>
          )}

          {estado === "invalido" && (
            <div className="space-y-3">
              <h2 className="text-lg">Link inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este link de recuperação já foi usado ou passou do prazo de validade. Solicite um
                novo e-mail para criar sua senha.
              </p>
              <Button asChild className="w-full">
                <Link to="/esqueci-senha">Solicitar novo link</Link>
              </Button>
            </div>
          )}

          {estado === "pronto" && (
            <form onSubmit={salvar} className="space-y-4">
              <h2 className="text-lg">Criar nova senha</h2>
              <div className="space-y-1.5">
                <Label htmlFor="nova">Nova senha</Label>
                <Input
                  id="nova"
                  type="password"
                  autoComplete="new-password"
                  value={nova}
                  onChange={(ev) => setNova(ev.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirma">Confirmar nova senha</Label>
                <Input
                  id="confirma"
                  type="password"
                  autoComplete="new-password"
                  value={confirma}
                  onChange={(ev) => setConfirma(ev.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar nova senha"}
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
