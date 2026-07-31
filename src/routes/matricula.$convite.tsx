import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/matricula/$convite")({
  head: () => ({
    meta: [
      { title: "Matrícula — Family Academy" },
      {
        name: "description",
        content: "Faça sua matrícula na turma da Family Academy usando o código de convite da sala.",
      },
      { property: "og:title", content: "Matrícula — Family Academy" },
      {
        property: "og:description",
        content: "Cadastro de aluno na turma da Family Academy.",
      },
    ],
  }),
  component: Matricula,
});

const esquema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().max(30).optional(),
  senha: z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(72),
  tipo: z.enum(["individual", "casal"]),
  nomeCasal: z.string().trim().max(160).optional(),
});

function Matricula() {
  const { convite } = Route.useParams();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<"individual" | "casal">("individual");
  const [nomeCasal, setNomeCasal] = useState("");
  const [carregando, setCarregando] = useState(false);

  const { data: sala, isLoading } = useQuery({
    queryKey: ["sala-convite", convite],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sala_por_convite", { _convite: convite });
      if (error) throw error;
      return (data as { sala_nome: string; curso_nome: string; turno: string | null }[])[0] ?? null;
    },
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquema.safeParse({ nome, email, telefone, senha, tipo, nomeCasal });
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    if (r.data.tipo === "casal" && (r.data.nomeCasal ?? "").length < 3) {
      toast.error("Informe o nome do casal");
      return;
    }
    setCarregando(true);
    const { error: erroCadastro } = await supabase.auth.signUp({
      email: r.data.email,
      password: r.data.senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome: r.data.nome, telefone: r.data.telefone, papel: "aluno" },
      },
    });

    if (erroCadastro) {
      const { error: erroLogin } = await supabase.auth.signInWithPassword({
        email: r.data.email,
        password: r.data.senha,
      });
      if (erroLogin) {
        setCarregando(false);
        toast.error("Não foi possível criar a conta. Esse e-mail já existe com outra senha?");
        return;
      }
    }

    const { error } = await supabase.rpc("matricular_por_convite", {
      _convite: convite,
      _tipo: r.data.tipo,
      _nome_casal: r.data.tipo === "casal" ? (r.data.nomeCasal ?? "") : "",
    });
    setCarregando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Matrícula concluída! Guarde sua carteirinha.");
    navigate({ to: "/meu-painel" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary font-display text-lg font-extrabold text-sidebar-primary-foreground">
            FA
          </div>
          <div className="leading-tight">
            <h1 className="text-xl text-white">Family Academy</h1>
            <p className="text-[11px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
              Matrícula
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-diario">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Procurando a sala…</p>
          ) : !sala ? (
            <div className="space-y-3">
              <h2 className="text-lg">Convite não encontrado</h2>
              <p className="text-sm text-muted-foreground">
                O código <span className="font-mono">{convite}</span> não corresponde a nenhuma sala.
              </p>
              <Link to="/" className="text-sm font-medium text-primary underline underline-offset-4">
                Voltar à entrada
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <h2 className="text-lg">{sala.sala_nome}</h2>
                <p className="text-sm text-muted-foreground">
                  {sala.curso_nome}
                  {sala.turno ? ` · ${sala.turno}` : ""}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de matrícula</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["individual", "casal"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      aria-pressed={tipo === t}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${
                        tipo === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {tipo === "casal" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome-casal">Nome do casal</Label>
                  <Input
                    id="nome-casal"
                    value={nomeCasal}
                    onChange={(e) => setNomeCasal(e.target.value)}
                    placeholder="Ex.: João e Maria Silva"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 90000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senha">Crie uma senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? "Matriculando…" : "Concluir matrícula"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
