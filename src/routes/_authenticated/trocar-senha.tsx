import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { SENHA_MINIMA, SENHA_PADRAO } from "@/lib/senha-padrao";
import { mensagemAuth } from "@/lib/usuarios-erros";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — Escola de Finanças" },
      {
        name: "description",
        content:
          "Defina uma nova senha pessoal para acessar a plataforma da Escola de Finanças com segurança.",
      },
      { property: "og:title", content: "Criar nova senha — Escola de Finanças" },
      {
        property: "og:description",
        content: "Troque a senha padrão por uma senha pessoal na Escola de Finanças.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrocarSenha,
});

function TrocarSenha() {
  const navigate = useNavigate();
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

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
    toast.success("Senha atualizada!");
    navigate({ to: "/painel" });
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="mb-4 text-xl font-semibold">Criar nova senha</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Primeiro acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Você entrou com a senha padrão. Defina agora uma senha pessoal para continuar usando a
            plataforma.
          </p>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirma">Confirmar nova senha</Label>
              <Input
                id="confirma"
                type="password"
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
