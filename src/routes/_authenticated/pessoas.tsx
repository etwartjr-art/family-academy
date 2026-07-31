import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listarPerfis, listarPapeis, iniciais, type Papel } from "@/lib/api";
import { criarUsuario, editarUsuario } from "@/lib/usuarios.functions";
import { useSessao } from "@/hooks/useSessao";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas — Family Academy" },
      {
        name: "description",
        content: "Gerencie os papéis de coordenadores, professores e alunos da Family Academy.",
      },
      { property: "og:title", content: "Pessoas — Family Academy" },
      { property: "og:description", content: "Papéis de acesso da plataforma." },
    ],
  }),
  component: Pessoas,
});

const PAPEIS: Papel[] = ["coordenador", "professor", "aluno"];

const VAZIO = { nome: "", email: "", senha: "", telefone: "", papel: "aluno" as Papel };

function Pessoas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(VAZIO);
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState<null | {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    senha: string;
  }>(null);
  const sessao = useSessao();
  const ehCoordenador = sessao.data?.papel === "coordenador";
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });
  const criar = useServerFn(criarUsuario);
  const editar = useServerFn(editarUsuario);


  const cadastrar = useMutation({
    mutationFn: async () => criar({ data: form }),
    onSuccess: () => {
      toast.success("Usuário cadastrado");
      setForm(VAZIO);
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["papeis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!edicao) throw new Error("Nada para salvar");
      return editar({ data: edicao });
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      setEdicao(null);
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alterar = useMutation({
    mutationFn: async ({ userId, papel }: { userId: string; papel: Papel }) => {
      const { error: erroDelete } = await supabase
        .from("papeis_usuario")
        .delete()
        .eq("user_id", userId);
      if (erroDelete) throw erroDelete;
      const { error } = await supabase.from("papeis_usuario").insert({ user_id: userId, papel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["papeis"] });
      qc.invalidateQueries({ queryKey: ["sessao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = (perfis.data ?? []).filter((p) =>
    `${p.nome} ${p.email ?? ""} ${p.codigo}`.toLowerCase().includes(busca.toLowerCase()),
  );

  const papelDe = (id: string): Papel =>
    ((papeis.data ?? []).find((r) => r.user_id === id)?.papel as Papel) ?? "aluno";


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">Pessoas</h1>
          <p className="text-sm text-muted-foreground">
            Defina quem é coordenador, professor ou aluno.
          </p>
        </div>
        {ehCoordenador && (
          <Button onClick={() => setAberto((v) => !v)} variant={aberto ? "secondary" : "default"}>
            {aberto ? "Cancelar" : "Incluir usuário"}
          </Button>
        )}
      </div>

      {ehCoordenador && aberto && (
        <Card className="p-4">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              cadastrar.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                required
                maxLength={100}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha provisória</Label>
              <Input
                id="senha"
                type="password"
                required
                minLength={6}
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone (opcional)</Label>
              <Input
                id="telefone"
                maxLength={30}
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select
                value={form.papel}
                onValueChange={(v) => setForm({ ...form, papel: v as Papel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={cadastrar.isPending} className="w-full">
                {cadastrar.isPending ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou código"
        className="max-w-sm"
      />


      {PAPEIS.map((grupo) => {
        const doGrupo = lista.filter((p) => papelDe(p.id) === grupo);
        return (
          <section key={grupo} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                {LABEL_GRUPO[grupo]}
              </h2>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                {doGrupo.length}
              </span>
            </div>
            <Card className="gap-0 p-0">
              <ul className="divide-y">
                {doGrupo.map((p) => {
                  const atual = papelDe(p.id);
                  const editando = edicao?.id === p.id;
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                          {iniciais(p.nome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.email ?? "sem e-mail"} · <span className="font-mono">{p.codigo}</span>
                            {p.telefone ? ` · ${p.telefone}` : ""}
                          </span>
                        </span>
                        <Select
                          value={atual}
                          onValueChange={(v) => alterar.mutate({ userId: p.id, papel: v as Papel })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAPEIS.map((r) => (
                              <SelectItem key={r} value={r} className="capitalize">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {ehCoordenador && (
                          <Button
                            variant={editando ? "secondary" : "outline"}
                            size="sm"
                            onClick={() =>
                              setEdicao(
                                editando
                                  ? null
                                  : {
                                      id: p.id,
                                      nome: p.nome,
                                      email: p.email ?? "",
                                      telefone: p.telefone ?? "",
                                      senha: "",
                                    },
                              )
                            }
                          >
                            {editando ? "Fechar" : "Editar"}
                          </Button>
                        )}
                      </div>

                      {ehCoordenador && editando && edicao && (
                        <form
                          className="mt-3 grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            salvar.mutate();
                          }}
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor={`nome-${p.id}`}>Nome completo</Label>
                            <Input
                              id={`nome-${p.id}`}
                              required
                              maxLength={100}
                              value={edicao.nome}
                              onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`email-${p.id}`}>E-mail</Label>
                            <Input
                              id={`email-${p.id}`}
                              type="email"
                              required
                              maxLength={255}
                              value={edicao.email}
                              onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`tel-${p.id}`}>Telefone</Label>
                            <Input
                              id={`tel-${p.id}`}
                              maxLength={30}
                              value={edicao.telefone}
                              onChange={(e) => setEdicao({ ...edicao, telefone: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`senha-${p.id}`}>Nova senha (opcional)</Label>
                            <Input
                              id={`senha-${p.id}`}
                              type="password"
                              minLength={6}
                              value={edicao.senha}
                              onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })}
                            />
                          </div>
                          <div className="flex items-end gap-2 sm:col-span-2">
                            <Button type="submit" disabled={salvar.isPending}>
                              {salvar.isPending ? "Salvando..." : "Salvar alterações"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setEdicao(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
                {doGrupo.length === 0 && (
                  <li className="px-4 py-3 text-sm text-muted-foreground">
                    Ninguém neste grupo.
                  </li>
                )}
              </ul>
            </Card>
          </section>
        );
      })}


    </div>
  );
}
