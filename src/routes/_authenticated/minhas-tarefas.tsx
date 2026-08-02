import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarAulas, listarModulos, dataBR } from "@/lib/api";
import {
  desmarcarConclusao,
  listarConclusoes,
  listarTarefas,
  marcarConclusao,
  progresso,
} from "@/lib/tarefas";
import { useSessao } from "@/hooks/useSessao";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/minhas-tarefas")({
  head: () => ({
    meta: [
      { title: "Minhas tarefas — Escola de Finanças" },
      {
        name: "description",
        content:
          "Acompanhe as tarefas das aulas dos seus módulos e veja seu progresso de conclusão.",
      },
      { property: "og:title", content: "Minhas tarefas — Escola de Finanças" },
      { property: "og:description", content: "Tarefas das aulas e barra de progresso do aluno." },
    ],
  }),
  component: MinhasTarefas,
});

function MinhasTarefas() {
  const qc = useQueryClient();
  const sessao = useSessao();
  const alunoId = sessao.data?.user.id;

  const tarefas = useQuery({ queryKey: ["tarefas"], queryFn: () => listarTarefas() });
  const conclusoes = useQuery({ queryKey: ["conclusoes"], queryFn: () => listarConclusoes() });
  const aulas = useQuery({ queryKey: ["aulas-todas"], queryFn: () => listarAulas() });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });

  const alternar = useMutation({
    mutationFn: ({ tarefaId, feito }: { tarefaId: string; feito: boolean }) =>
      feito
        ? desmarcarConclusao(tarefaId, alunoId!)
        : marcarConclusao(tarefaId, alunoId!, "aluno"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conclusoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const listaTarefas = tarefas.data ?? [];
  const minhas = (conclusoes.data ?? []).filter((c) => c.aluno_id === alunoId);
  const feito = (tarefaId: string) => minhas.some((c) => c.tarefa_id === tarefaId);

  const listaAulas = (aulas.data ?? []).filter((a) =>
    listaTarefas.some((t) => t.aula_id === a.id),
  );
  const listaModulos = (modulos.data ?? []).filter((m) =>
    listaAulas.some((a) => a.modulo_id === m.id),
  );

  const totalGeral = listaTarefas.length;
  const feitasGeral = listaTarefas.filter((t) => feito(t.id)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Minhas tarefas</h1>
        <p className="text-sm text-muted-foreground">
          Marque cada tarefa conforme conclui e acompanhe seu avanço.
        </p>
      </div>

      <Card className="gap-2 p-4">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Progresso geral</span>
          <span>
            {feitasGeral} de {totalGeral} · {progresso(feitasGeral, totalGeral)}%
          </span>
        </div>
        <Progress value={progresso(feitasGeral, totalGeral)} />
      </Card>

      {listaModulos.map((mod) => {
        const aulasDoModulo = listaAulas
          .filter((a) => a.modulo_id === mod.id)
          .sort((a, b) => a.numero - b.numero);
        const doModulo = listaTarefas.filter((t) =>
          aulasDoModulo.some((a) => a.id === t.aula_id),
        );
        const feitasMod = doModulo.filter((t) => feito(t.id)).length;
        return (
          <Card key={mod.id} className="gap-3 p-4">
            <div>
              <h2 className="text-lg">{mod.nome}</h2>
              <div className="mt-1 flex items-center gap-3">
                <Progress value={progresso(feitasMod, doModulo.length)} className="h-2" />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {feitasMod}/{doModulo.length}
                </span>
              </div>
            </div>

            {aulasDoModulo.map((a) => {
              const daAula = listaTarefas.filter((t) => t.aula_id === a.id);
              if (daAula.length === 0) return null;
              const feitasAula = daAula.filter((t) => feito(t.id)).length;
              return (
                <div key={a.id} className="rounded-xl border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold">
                    <span>
                      Aula {a.numero} · {a.titulo}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {dataBR(a.data)}
                      </span>
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {feitasAula}/{daAula.length} concluídas
                    </span>
                  </div>
                  <ul className="divide-y">
                    {daAula.map((t) => {
                      const marcada = feito(t.id);
                      const conclusao = minhas.find((c) => c.tarefa_id === t.id);
                      return (
                        <li key={t.id} className="px-3 py-2.5">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={marcada}
                              disabled={!alunoId || alternar.isPending}
                              onCheckedChange={() =>
                                alternar.mutate({ tarefaId: t.id, feito: marcada })
                              }
                              aria-label={`Concluir ${t.titulo}`}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="text-sm font-medium">
                                {t.titulo}
                                {conclusao?.por === "professor" && (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    marcada pelo professor
                                  </span>
                                )}
                              </div>
                              {t.instrucoes && (
                                <Collapsible>
                                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
                                    Instruções <ChevronDown className="size-3.5" />
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="whitespace-pre-wrap pt-1.5 text-sm text-muted-foreground">
                                    {t.instrucoes}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                              {t.link && (
                                <Button asChild variant="outline" size="sm">
                                  <a href={t.link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-4" />
                                    {t.rotulo_link?.trim() || "Abrir link"}
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </Card>
        );
      })}

      {totalGeral === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma tarefa publicada nos seus módulos por enquanto.
        </p>
      )}
    </div>
  );
}
