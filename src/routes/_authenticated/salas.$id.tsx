import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarSalas,
  listarCursos,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPerfis,
  listarPapeis,
  listarInscricoes,
  dataBR,
  iniciais,
} from "@/lib/api";
import { useSessao } from "@/hooks/useSessao";
import { useServerFn } from "@tanstack/react-start";
import { criarUsuario } from "@/lib/usuarios.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeBox } from "@/components/QRCodeBox";
import { toast } from "sonner";
import { ArrowLeft, Pencil, UserPlus } from "lucide-react";


export const Route = createFileRoute("/_authenticated/salas/$id")({
  head: () => ({
    meta: [
      { title: "Sala — Family Academy" },
      {
        name: "description",
        content: "Módulos, aulas e alunos inscritos da turma, com controle de datas e inscrições.",
      },
      { property: "og:title", content: "Sala — Family Academy" },
      { property: "og:description", content: "Módulos, aulas e inscrições da turma." },
    ],
  }),
  component: SalaDetalhe,
});

function SalaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sessao } = useSessao();

  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const modulos = useQuery({ queryKey: ["modulos", id], queryFn: () => listarModulos(id) });
  const matriculas = useQuery({ queryKey: ["matriculas", id], queryFn: () => listarMatriculas(id) });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });

  const [editando, setEditando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [novo, setNovo] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    tipo: "individual" as "individual" | "casal",
    nome_casal: "",
  });
  const [form, setForm] = useState({
    nome: "",
    professor_id: "",
    turno: "",
    data_inicio: "",
  });


  const idsModulos = (modulos.data ?? []).map((m) => m.id);
  const aulas = useQuery({
    queryKey: ["aulas", idsModulos],
    queryFn: () => listarAulas(idsModulos),
    enabled: idsModulos.length > 0,
  });

  const sala = (salas.data ?? []).find((s) => s.id === id);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const professores = (perfis.data ?? []).filter((p) =>
    (papeis.data ?? []).some((r) => r.user_id === p.id && r.papel === "professor"),
  );
  const coordenador = sessao?.papel === "coordenador";
  const podeEditar =
    sessao?.papel === "coordenador" ||
    (!!sala?.professor_id && sala.professor_id === sessao?.user.id);

  const salvarSala = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("salas")
        .update({
          nome: form.nome.trim(),
          professor_id: form.professor_id || null,
          turno: form.turno.trim() || null,
          data_inicio: form.data_inicio,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma atualizada");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["salas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useServerFn(criarUsuario);

  const adicionarAluno = useMutation({
    mutationFn: async () => {
      const { id: alunoId } = await criar({
        data: {
          nome: novo.nome.trim(),
          email: novo.email.trim(),
          senha: novo.senha,
          telefone: novo.telefone.trim(),
          papel: "aluno",
        },
      });

      const { data: matricula, error } = await supabase
        .from("matriculas")
        .insert({
          aluno_id: alunoId,
          sala_id: id,
          status: "ativa",
          tipo: novo.tipo,
          nome_casal: novo.tipo === "casal" ? novo.nome_casal.trim() || null : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (idsModulos.length > 0) {
        const { error: erroMod } = await supabase
          .from("matricula_modulos")
          .insert(idsModulos.map((moduloId) => ({ matricula_id: matricula.id, modulo_id: moduloId })));
        if (erroMod) throw erroMod;
      }
    },
    onSuccess: () => {
      toast.success("Aluno adicionado à turma");
      setNovo({
        nome: "",
        email: "",
        telefone: "",
        senha: "",
        tipo: "individual",
        nome_casal: "",
      });
      setAdicionando(false);
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarTipo = useMutation({
    mutationFn: async ({
      matriculaId,
      tipo,
      nomeCasal,
    }: {
      matriculaId: string;
      tipo: "individual" | "casal";
      nomeCasal: string | null;
    }) => {
      const { error } = await supabase
        .from("matriculas")
        .update({ tipo, nome_casal: tipo === "casal" ? nomeCasal : null })
        .eq("id", matriculaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matriculas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirEdicao() {
    if (!sala) return;
    setForm({
      nome: sala.nome,
      professor_id: sala.professor_id ?? "",
      turno: sala.turno ?? "",
      data_inicio: sala.data_inicio.slice(0, 10),
    });
    setEditando(true);
  }


  const salvarData = useMutation({
    mutationFn: async ({ aulaId, data }: { aulaId: string; data: string }) => {
      const { error } = await supabase
        .from("aulas")
        .update({ data: data || null })
        .eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarInscricao = useMutation({
    mutationFn: async ({
      matriculaId,
      moduloId,
      inscrito,
    }: {
      matriculaId: string;
      moduloId: string;
      inscrito: boolean;
    }) => {
      if (inscrito) {
        const { error } = await supabase
          .from("matricula_modulos")
          .delete()
          .eq("matricula_id", matriculaId)
          .eq("modulo_id", moduloId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("matricula_modulos")
          .insert({ matricula_id: matriculaId, modulo_id: moduloId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inscricoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sala) {
    return <p className="text-sm text-muted-foreground">Carregando sala…</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/salas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Salas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{sala.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {curso?.nome} · {sala.turno ?? "—"} · início {dataBR(sala.data_inicio)}
          </p>
          <p className="text-sm text-muted-foreground">
            Professor:{" "}
            {(perfis.data ?? []).find((p) => p.id === sala.professor_id)?.nome ?? "—"}
          </p>
          <p className="mt-1 font-mono text-sm">{sala.convite}</p>
          {podeEditar && !editando && (
            <Button variant="outline" size="sm" className="mt-3" onClick={abrirEdicao}>
              <Pencil className="size-4" /> Editar turma
            </Button>
          )}
        </div>
        <QRCodeBox valor={`${origem}/matricula/${sala.convite}`} tamanho={104} />
      </div>

      {podeEditar && editando && (
        <Card className="gap-4 p-4">
          <h2 className="text-lg">Editar turma</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome-sala">Nome da turma</Label>
              <Input
                id="nome-sala"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Professor</Label>
              <Select
                value={form.professor_id || "nenhum"}
                onValueChange={(v) =>
                  setForm({ ...form, professor_id: v === "nenhum" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem professor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem professor</SelectItem>
                  {professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="turno-sala">Turno</Label>
              <Input
                id="turno-sala"
                value={form.turno}
                onChange={(e) => setForm({ ...form, turno: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inicio-sala">Início</Label>
              <Input
                id="inicio-sala"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => salvarSala.mutate()}
              disabled={!form.nome.trim() || salvarSala.isPending}
            >
              {salvarSala.isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}


      <section className="space-y-3">
        <h2 className="text-lg">Módulos e aulas</h2>
        {(modulos.data ?? []).map((m) => (
          <Card key={m.id} className="gap-3 p-4">
            <h3 className="text-base font-semibold">{m.nome}</h3>
            <ul className="divide-y rounded-xl border">
              {(aulas.data ?? [])
                .filter((a) => a.modulo_id === m.id)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex-1 text-sm">
                      Aula {a.numero} · {a.titulo}
                    </span>
                    <Input
                      type="date"
                      defaultValue={a.data?.slice(0, 10) ?? ""}
                      onBlur={(e) => salvarData.mutate({ aulaId: a.id, data: e.target.value })}
                      className="w-40"
                    />
                  </li>
                ))}
            </ul>
          </Card>
        ))}
        {(modulos.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta sala não tem módulos — cadastre a ementa do curso e crie a sala novamente.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">Alunos e inscrição por módulo</h2>
          {coordenador && (
            <Button size="sm" onClick={() => setAdicionando((v) => !v)}>
              <UserPlus className="size-4" /> Adicionar aluno
            </Button>
          )}
        </div>

        {coordenador && adicionando && (
          <Card className="gap-4 p-4">
            <h3 className="text-base font-semibold">Novo aluno na turma</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de matrícula</Label>
                <Select
                  value={novo.tipo}
                  onValueChange={(v) => setNovo({ ...novo, tipo: v as "individual" | "casal" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="casal">Casal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {novo.tipo === "casal" && (
                <div className="space-y-1.5">
                  <Label htmlFor="novo-casal">Nome do casal</Label>
                  <Input
                    id="novo-casal"
                    value={novo.nome_casal}
                    onChange={(e) => setNovo({ ...novo, nome_casal: e.target.value })}
                    placeholder="Ex.: João e Maria Silva"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="novo-nome">Nome do aluno</Label>
                <Input
                  id="novo-nome"
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-email">E-mail</Label>
                <Input
                  id="novo-email"
                  type="email"
                  value={novo.email}
                  onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-tel">Telefone</Label>
                <Input
                  id="novo-tel"
                  value={novo.telefone}
                  onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-senha">Senha provisória</Label>
                <Input
                  id="novo-senha"
                  value={novo.senha}
                  onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                  placeholder="mínimo 6 caracteres"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => adicionarAluno.mutate()}
                disabled={
                  adicionarAluno.isPending ||
                  novo.nome.trim().length < 2 ||
                  !novo.email.trim() ||
                  novo.senha.length < 6 ||
                  (novo.tipo === "casal" && novo.nome_casal.trim().length < 3)
                }
              >
                {adicionarAluno.isPending ? "Adicionando…" : "Adicionar à turma"}
              </Button>
              <Button variant="ghost" onClick={() => setAdicionando(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}
        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Aluno</th>
                <th className="px-2 py-2 font-medium">Matrícula</th>
                {(modulos.data ?? []).map((m) => (
                  <th key={m.id} className="px-2 py-2 text-center font-medium">
                    {m.ordem}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(matriculas.data ?? []).map((mat) => {
                const perfil = (perfis.data ?? []).find((p) => p.id === mat.aluno_id);
                return (
                  <tr key={mat.id}>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                          {iniciais(perfil?.nome ?? "?")}
                        </span>
                        <span>
                          <span className="block font-medium">{perfil?.nome ?? "—"}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {perfil?.codigo}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {podeEditar ? (
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={mat.tipo}
                            onValueChange={(v) =>
                              salvarTipo.mutate({
                                matriculaId: mat.id,
                                tipo: v as "individual" | "casal",
                                nomeCasal: mat.nome_casal,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="casal">Casal</SelectItem>
                            </SelectContent>
                          </Select>
                          {mat.tipo === "casal" && (
                            <Input
                              className="h-8 w-40"
                              placeholder="Nome do casal"
                              defaultValue={mat.nome_casal ?? ""}
                              onBlur={(e) =>
                                salvarTipo.mutate({
                                  matriculaId: mat.id,
                                  tipo: "casal",
                                  nomeCasal: e.target.value.trim() || null,
                                })
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs">
                          {mat.tipo === "casal" ? `Casal · ${mat.nome_casal ?? "—"}` : "Individual"}
                        </span>
                      )}
                    </td>
                    {(modulos.data ?? []).map((m) => {
                      const inscrito = (inscricoes.data ?? []).some(
                        (i) => i.matricula_id === mat.id && i.modulo_id === m.id,
                      );
                      return (
                        <td key={m.id} className="px-2 py-2 text-center">
                          <Checkbox
                            checked={inscrito}
                            aria-label={`${perfil?.nome} em ${m.nome}`}
                            onCheckedChange={() =>
                              alternarInscricao.mutate({
                                matriculaId: mat.id,
                                moduloId: m.id,
                                inscrito,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {(matriculas.data ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={(modulos.data ?? []).length + 2}
                    className="py-3 text-muted-foreground"
                  >
                    Nenhum aluno matriculado. Compartilhe o QR de convite.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
