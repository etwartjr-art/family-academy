import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  dataBR,
  dataHoraBR,

  listarCursos,
  listarInscricoes,
  listarMatriculas,
  listarModulos,
  listarPerfis,
  listarSalas,
} from "@/lib/api";
import {
  atualizarTarefa,
  criarTarefa,
  desmarcarConclusao,
  excluirTarefa,
  listarConclusoes,
  listarTarefas,
  marcarConclusao,
  progresso,
  reordenar,
  type Tarefa,
} from "@/lib/tarefas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeft, ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tarefas/$aulaId")({
  head: () => ({
    meta: [
      { title: "Tarefas da aula — Escola de Finanças" },
      {
        name: "description",
        content: "Publique tarefas da aula, reordene a lista e acompanhe a adesão dos alunos.",
      },
      { property: "og:title", content: "Tarefas da aula — Escola de Finanças" },
      { property: "og:description", content: "Gestão de tarefas e conclusões por aula." },
    ],
  }),
  component: TarefasDaAula,
});

function TarefasDaAula() {
  const { aulaId } = Route.useParams();
  const qc = useQueryClient();

  const aula = useQuery({
    queryKey: ["aula", aulaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aulas")
        .select("*")
        .eq("id", aulaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const salas = useQuery({ queryKey: ["salas"], queryFn: listarSalas });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const tarefas = useQuery({
    queryKey: ["tarefas", aulaId],
    queryFn: () => listarTarefas([aulaId]),
  });
  const conclusoes = useQuery({
    queryKey: ["conclusoes", aulaId],
    queryFn: async () =>
      listarConclusoes((tarefas.data ?? []).map((t) => t.id)),
    enabled: !!tarefas.data,
  });

  const modulo = (modulos.data ?? []).find((m) => m.id === aula.data?.modulo_id) ?? null;
  const sala = (salas.data ?? []).find((s) => s.id === modulo?.sala_id) ?? null;
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id) ?? null;

  // Alunos inscritos no módulo desta aula.
  const alunos = (matriculas.data ?? [])
    .filter(
      (m) =>
        m.sala_id === sala?.id &&
        m.status === "ativa" &&
        (inscricoes.data ?? []).some(
          (i) => i.matricula_id === m.id && i.modulo_id === modulo?.id,
        ),
    )
    .map((m) => (perfis.data ?? []).find((p) => p.id === m.aluno_id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const [titulo, setTitulo] = useState("");
  const [instrucoes, setInstrucoes] = useState("");
  const [link, setLink] = useState("");
  const [rotuloLink, setRotuloLink] = useState("");
  const [ordemAlunos, setOrdemAlunos] = useState<
    "nome" | "conclusao-recente" | "conclusao-antiga"
  >("nome");
  const [filtroAlunos, setFiltroAlunos] = useState<
    "todos" | "concluidos" | "pendentes"
  >("todos");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [alunoSel, setAlunoSel] = useState<string>("todos");

  const ordenarAlunos = (listaAlunos: typeof alunos, tarefaId: string) => {
    const copia = [...listaAlunos];
    if (ordemAlunos === "nome") {
      return copia.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return copia.sort((a, b) => {
      const ra = feitas.find((c) => c.tarefa_id === tarefaId && c.aluno_id === a.id);
      const rb = feitas.find((c) => c.tarefa_id === tarefaId && c.aluno_id === b.id);
      if (ra && rb) {
        const ta = new Date(ra.em).getTime();
        const tb = new Date(rb.em).getTime();
        return ordemAlunos === "conclusao-recente" ? tb - ta : ta - tb;
      }
      if (ra) return -1;
      if (rb) return 1;
      return a.nome.localeCompare(b.nome);
    });
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["conclusoes"] });
  };

  const lista = tarefas.data ?? [];

  const publicar = useMutation({
    mutationFn: () =>
      criarTarefa({
        aulaId,
        titulo: titulo.trim(),
        instrucoes,
        link,
        rotuloLink,
        ordem: lista.length,
      }),
    onSuccess: () => {
      setTitulo("");
      setInstrucoes("");
      setLink("");
      setRotuloLink("");
      toast.success("Tarefa publicada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: string) => excluirTarefa(id),
    onSuccess: () => {
      toast.success("Tarefa excluída");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mover = useMutation({
    mutationFn: ({ a, b }: { a: Tarefa; b: Tarefa }) => reordenar(a, b),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const renomear = useMutation({
    mutationFn: ({ id, campos }: { id: string; campos: Partial<Tarefa> }) =>
      atualizarTarefa(id, campos),
    onSuccess: () => {
      toast.success("Tarefa atualizada");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternar = useMutation({
    mutationFn: ({
      tarefaId,
      alunoId,
      feito,
    }: {
      tarefaId: string;
      alunoId: string;
      feito: boolean;
    }) =>
      feito
        ? desmarcarConclusao(tarefaId, alunoId)
        : marcarConclusao(tarefaId, alunoId, "professor"),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message),
  });

  const feitas = conclusoes.data ?? [];
  const concluiu = (tarefaId: string, alunoId: string) =>
    feitas.some((c) => c.tarefa_id === tarefaId && c.aluno_id === alunoId);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/tarefas">
          <ArrowLeft className="size-4" /> Tarefas
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl">
          Tarefas · Aula {aula.data?.numero} · {aula.data?.titulo ?? "…"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {curso?.nome ?? "—"} · {sala?.nome ?? "—"} · {modulo?.nome ?? "—"} ·{" "}
          {dataBR(aula.data?.data)}
        </p>
      </div>

      <Card className="gap-3 p-4">
        <h2 className="text-lg">Nova tarefa</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Preencher a planilha de orçamento"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="instrucoes">Instruções (opcional)</Label>
            <Textarea
              id="instrucoes"
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="link">Link externo (opcional)</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="rotulo">Rótulo do botão (opcional)</Label>
            <Input
              id="rotulo"
              value={rotuloLink}
              onChange={(e) => setRotuloLink(e.target.value)}
              placeholder="Abrir formulário"
            />
          </div>
        </div>
        <Button
          className="w-fit"
          disabled={!titulo.trim() || publicar.isPending}
          onClick={() => publicar.mutate()}
        >
          <Plus className="size-4" /> Publicar tarefa
        </Button>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Tarefas publicadas</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Aluno</span>
            <Select value={alunoSel} onValueChange={setAlunoSel}>
              <SelectTrigger className="w-[12rem]">
                <SelectValue placeholder="Selecionar aluno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os alunos</SelectItem>
                {alunos.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar alunos</span>
            <Select value={filtroAlunos} onValueChange={(v) => setFiltroAlunos(v as typeof filtroAlunos)}>
              <SelectTrigger className="w-[10rem]">
                <SelectValue placeholder="Filtrar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="concluidos">Apenas concluídos</SelectItem>
                <SelectItem value="pendentes">Apenas pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ordenar alunos por</span>
            <Select value={ordemAlunos} onValueChange={(v) => setOrdemAlunos(v as typeof ordemAlunos)}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="conclusao-recente">Conclusão: mais recente</SelectItem>
                <SelectItem value="conclusao-antiga">Conclusão: mais antiga</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {lista.map((t, i) => {
          const total = alunos.length;
          const quantos = alunos.filter((a) => concluiu(t.id, a.id)).length;
          return (
            <Card key={t.id} className="gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    defaultValue={t.titulo}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== t.titulo) renomear.mutate({ id: t.id, campos: { titulo: v } });
                    }}
                    className="font-semibold"
                  />
                  <Textarea
                    defaultValue={t.instrucoes ?? ""}
                    rows={2}
                    placeholder="Instruções"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (t.instrucoes ?? ""))
                        renomear.mutate({ id: t.id, campos: { instrucoes: v || null } });
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      defaultValue={t.link ?? ""}
                      placeholder="Link externo"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (t.link ?? ""))
                          renomear.mutate({ id: t.id, campos: { link: v || null } });
                      }}
                    />
                    <Input
                      defaultValue={t.rotulo_link ?? ""}
                      placeholder="Rótulo do botão"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (t.rotulo_link ?? ""))
                          renomear.mutate({ id: t.id, campos: { rotulo_link: v || null } });
                      }}
                    />
                  </div>
                  {t.link && (
                    <Button asChild variant="outline" size="sm">
                      <a href={t.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" /> {t.rotulo_link?.trim() || "Abrir link"}
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => mover.mutate({ a: t, b: lista[i - 1]! })}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Descer"
                    disabled={i === lista.length - 1}
                    onClick={() => mover.mutate({ a: t, b: lista[i + 1]! })}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Excluir tarefa"
                    onClick={() => remover.mutate(t.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-4" /> {quantos} de {total} alunos concluíram
                  </span>
                  <span className="text-muted-foreground">{progresso(quantos, total)}%</span>
                </div>
                <Progress value={progresso(quantos, total)} className="h-2" />
              </div>

              {(() => {
              const visiveis = ordenarAlunos(
                alunos.filter((a) => {
                  if (alunoSel !== "todos" && a.id !== alunoSel) return false;
                  if (filtroAlunos === "concluidos") return concluiu(t.id, a.id);
                  if (filtroAlunos === "pendentes") return !concluiu(t.id, a.id);
                  return true;
                }),
                t.id,
              );
              return (
              <Collapsible
                open={filtroAlunos !== "todos" || alunoSel !== "todos" || !!abertos[t.id]}
                onOpenChange={(o) => setAbertos((s) => ({ ...s, [t.id]: o }))}
              >
                <CollapsibleTrigger className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  Ver alunos e marcar manualmente
                  {filtroAlunos === "concluidos" && ` · ${visiveis.length} concluídos`}
                  {filtroAlunos === "pendentes" && ` · ${visiveis.length} pendentes`}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 divide-y rounded-xl border">
                    {visiveis.map((a) => {
                      const marcado = concluiu(t.id, a.id);
                      const registro = feitas.find(
                        (c) => c.tarefa_id === t.id && c.aluno_id === a.id,
                      );
                      return (
                        <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <Checkbox
                            checked={marcado}
                            disabled={alternar.isPending}
                            aria-label={`Concluir para ${a.nome}`}
                            onCheckedChange={() =>
                              alternar.mutate({ tarefaId: t.id, alunoId: a.id, feito: marcado })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                          {registro ? (
                            <span className="shrink-0 text-right text-xs text-muted-foreground">
                              Concluída em {dataHoraBR(registro.em)}
                              <br />
                              marcada pelo {registro.por === "professor" ? "professor" : "aluno"}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Pendente
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {alunos.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum aluno inscrito neste módulo.
                      </li>
                    )}
                    {alunos.length > 0 && visiveis.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum aluno para os filtros selecionados.
                      </li>
                    )}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
              );
              })()}
            </Card>
          );
        })}
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa publicada nesta aula.</p>
        )}
      </div>
    </div>
  );
}
