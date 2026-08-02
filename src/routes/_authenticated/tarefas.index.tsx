import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listarAulas,
  listarCursos,
  listarMatriculas,
  listarModulos,
  listarPerfis,
  listarSalas,
} from "@/lib/api";
import { listarConclusoes, listarTarefas, progresso } from "@/lib/tarefas";
import {
  exportarRelatorioCSV,
  exportarRelatorioPDF,
  type LinhaRelatorio,
} from "@/lib/relatorio-tarefas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ListChecks, ChevronRight, FileDown } from "lucide-react";


export const Route = createFileRoute("/_authenticated/tarefas/")({
  head: () => ({
    meta: [
      { title: "Tarefas das aulas — Escola de Finanças" },
      {
        name: "description",
        content: "Publique tarefas por aula e acompanhe a adesão da turma na conclusão.",
      },
      { property: "og:title", content: "Tarefas das aulas — Escola de Finanças" },
      { property: "og:description", content: "Tarefas por curso, turma e aula." },
    ],
  }),
  component: IndiceTarefas,
});

function IndiceTarefas() {
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const salas = useQuery({ queryKey: ["salas"], queryFn: listarSalas });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas-todas"], queryFn: () => listarAulas() });
  const tarefas = useQuery({ queryKey: ["tarefas"], queryFn: () => listarTarefas() });
  const conclusoes = useQuery({ queryKey: ["conclusoes-todas"], queryFn: () => listarConclusoes() });
  const matriculas = useQuery({ queryKey: ["matriculas-todas"], queryFn: () => listarMatriculas() });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const [busca, setBusca] = useState("");

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tarefas.data ?? []) m.set(t.aula_id, (m.get(t.aula_id) ?? 0) + 1);
    return m;
  }, [tarefas.data]);

  /** Conclusões por tarefa. */
  const feitas = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of conclusoes.data ?? []) m.set(c.tarefa_id, (m.get(c.tarefa_id) ?? 0) + 1);
    return m;
  }, [conclusoes.data]);

  /** Alunos ativos por sala. */
  const alunosPorSala = useMemo(() => {
    const m = new Map<string, number>();
    for (const mat of matriculas.data ?? []) {
      if (mat.status !== "ativa") continue;
      m.set(mat.sala_id, (m.get(mat.sala_id) ?? 0) + 1);
    }
    return m;
  }, [matriculas.data]);

  /** Média de conclusão da turma no módulo: concluídas / (tarefas × alunos). */
  function mediaModulo(salaId: string, aulaIds: string[]) {
    const alunos = alunosPorSala.get(salaId) ?? 0;
    const tarefasDoModulo = (tarefas.data ?? []).filter((t) => aulaIds.includes(t.aula_id));
    const total = tarefasDoModulo.length * alunos;
    if (total === 0) return null;
    const concluidas = tarefasDoModulo.reduce((s, t) => s + (feitas.get(t.id) ?? 0), 0);
    return progresso(concluidas, total);
  }


  const termo = busca.trim().toLowerCase();
  const listaSalas = (salas.data ?? []).filter(
    (s) => !termo || s.nome.toLowerCase().includes(termo),
  );

  /** Uma linha por aluno × módulo, com concluídas/total no módulo. */
  const linhasRelatorio = useMemo<LinhaRelatorio[]>(() => {
    const nomes = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const linhas: LinhaRelatorio[] = [];
    for (const curso of cursos.data ?? []) {
      for (const sala of listaSalas.filter((s) => s.curso_id === curso.id)) {
        const mats = (matriculas.data ?? []).filter(
          (m) => m.sala_id === sala.id && m.status === "ativa",
        );
        for (const mod of (modulos.data ?? []).filter((m) => m.sala_id === sala.id)) {
          const aulaIds = (aulas.data ?? [])
            .filter((a) => a.modulo_id === mod.id)
            .map((a) => a.id);
          const tarefasDoModulo = (tarefas.data ?? []).filter((t) => aulaIds.includes(t.aula_id));
          if (tarefasDoModulo.length === 0) continue;
          const ids = new Set(tarefasDoModulo.map((t) => t.id));
          for (const mat of mats) {
            const perfil = nomes.get(mat.aluno_id);
            const concluidas = (conclusoes.data ?? []).filter(
              (c) => c.aluno_id === mat.aluno_id && ids.has(c.tarefa_id),
            ).length;
            linhas.push({
              curso: curso.nome,
              sala: sala.nome,
              modulo: mod.nome,
              aluno: perfil?.nome ?? "—",
              codigo: perfil?.codigo ?? "",
              tipo: mat.tipo === "casal" ? "Casal" : "Individual",
              nomeCasal: mat.tipo === "casal" ? (mat.nome_casal ?? "—") : "—",
              concluidas,
              total: tarefasDoModulo.length,
              percentual: progresso(concluidas, tarefasDoModulo.length),
            });
          }
        }
      }
    }
    return linhas;
  }, [
    cursos.data,
    listaSalas,
    matriculas.data,
    modulos.data,
    aulas.data,
    tarefas.data,
    conclusoes.data,
    perfis.data,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Tarefas das aulas</h1>
          <p className="text-sm text-muted-foreground">
            Escolha a aula para publicar tarefas e ver quem já concluiu.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={linhasRelatorio.length === 0}
            onClick={() => exportarRelatorioCSV(linhasRelatorio)}
          >
            <FileDown className="size-4" />
            Relatório CSV
          </Button>
          <Button
            variant="outline"
            disabled={linhasRelatorio.length === 0}
            onClick={() => void exportarRelatorioPDF(linhasRelatorio)}
          >
            <FileDown className="size-4" />
            Relatório PDF
          </Button>
        </div>
      </div>


      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar turma"
        className="max-w-sm"
      />

      <div className="space-y-4">
        {(cursos.data ?? []).map((curso) => {
          const salasDoCurso = listaSalas.filter((s) => s.curso_id === curso.id);
          if (salasDoCurso.length === 0) return null;
          return (
            <Card key={curso.id} className="gap-3 p-4">
              <h2 className="text-lg">{curso.nome}</h2>
              {salasDoCurso.map((sala) => {
                const mods = (modulos.data ?? []).filter((m) => m.sala_id === sala.id);
                return (
                  <div key={sala.id} className="rounded-xl border">
                    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                      <span className="text-sm font-semibold">{sala.nome}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {sala.convite}
                      </span>
                    </div>
                    {mods.map((mod) => {
                      const aulasDoModulo = (aulas.data ?? []).filter(
                        (a) => a.modulo_id === mod.id,
                      );
                      const media = mediaModulo(
                        sala.id,
                        aulasDoModulo.map((a) => a.id),
                      );
                      return (
                        <div key={mod.id} className="px-3 py-2.5">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {mod.nome}
                            </div>
                            <div className="flex min-w-40 items-center gap-2">
                              <Progress value={media ?? 0} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground">
                                {media === null ? "sem dados" : `média ${media}%`}
                              </span>
                            </div>
                          </div>
                          <ul className="grid gap-2 sm:grid-cols-2">

                            {aulasDoModulo.map((a) => (
                              <li key={a.id}>
                                <Button
                                  asChild
                                  variant="outline"
                                  className="h-auto w-full justify-between py-2 text-left"
                                >
                                  <Link to="/tarefas/$aulaId" params={{ aulaId: a.id }}>
                                    <span className="min-w-0 truncate text-sm">
                                      Aula {a.numero} · {a.titulo}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <ListChecks className="size-3.5" />
                                      {contagem.get(a.id) ?? 0}
                                      <ChevronRight className="size-3.5" />
                                    </span>
                                  </Link>
                                </Button>
                              </li>
                            ))}
                            {aulasDoModulo.length === 0 && (
                              <li className="text-sm text-muted-foreground">Sem aulas.</li>
                            )}
                          </ul>
                        </div>
                      );
                    })}
                    {mods.length === 0 && (
                      <p className="px-3 py-2.5 text-sm text-muted-foreground">
                        Turma sem módulos.
                      </p>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
        {listaSalas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma turma encontrada.</p>
        )}
      </div>
    </div>
  );
}
