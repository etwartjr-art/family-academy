import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listarCursos,
  listarSalas,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPresencas,
  dataBR,
} from "@/lib/api";
import { useSessao } from "@/hooks/useSessao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Escola de Finanças" },
      {
        name: "description",
        content: "Visão geral das turmas, alunos e frequência média da Escola de Finanças.",
      },
      { property: "og:title", content: "Painel — Escola de Finanças" },
      { property: "og:description", content: "Métricas e aulas pendentes de chamada." },
    ],
  }),
  component: Painel,
});

function Metrica({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <Card className="gap-1 p-4">
      <div className="font-display text-2xl font-extrabold">{valor}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</div>
    </Card>
  );
}

function Painel() {
  const { data: sessao } = useSessao();
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas"], queryFn: () => listarAulas() });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const presencas = useQuery({ queryKey: ["presencas"], queryFn: () => listarPresencas() });

  const listaAulas = aulas.data ?? [];
  const listaPresencas = presencas.data ?? [];
  const listaModulos = modulos.data ?? [];
  const listaSalas = salas.data ?? [];

  const alunos = new Set((matriculas.data ?? []).map((m) => m.aluno_id)).size;
  const aulasComChamada = new Set(listaPresencas.map((p) => p.aula_id));
  const esperadas = listaAulas.length * Math.max(alunos, 1);
  const media = esperadas ? Math.round((listaPresencas.length / esperadas) * 100) : 0;

  const semChamada = listaAulas
    .filter((a) => !aulasComChamada.has(a.id) && a.data)
    .sort((a, b) => (a.data! < b.data! ? -1 : 1))
    .slice(0, 5);

  const gerencia = sessao?.papel !== "aluno";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Olá, {sessao?.perfil?.nome.split(" ")[0] ?? ""}</h1>
          <p className="text-sm text-muted-foreground capitalize">{sessao?.papel}</p>
        </div>
        {gerencia && (
          <Button asChild>
            <Link to="/chamada">
              <ScanLine className="size-4" /> Fazer chamada
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica rotulo="Cursos" valor={cursos.data?.length ?? 0} />
        <Metrica rotulo="Salas" valor={listaSalas.length} />
        <Metrica rotulo="Alunos" valor={alunos} />
        <Metrica rotulo="Presença média" valor={`${media}%`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg">Próximas aulas sem chamada</h2>
        {semChamada.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma aula pendente.</p>
        ) : (
          <div className="space-y-2">
            {semChamada.map((a) => {
              const mod = listaModulos.find((m) => m.id === a.modulo_id);
              const sala = listaSalas.find((s) => s.id === mod?.sala_id);
              return (
                <Card key={a.id} className="flex-row items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {mod?.nome} · Aula {a.numero}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sala?.nome} · {dataBR(a.data)}
                    </div>
                  </div>
                  {gerencia && (
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/chamada" search={{ aula: a.id }}>
                        Chamar
                      </Link>
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Salas</h2>
        {listaSalas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sala ainda.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {listaSalas.map((s) => {
              const curso = cursos.data?.find((c) => c.id === s.curso_id);
              const qtd = (matriculas.data ?? []).filter((m) => m.sala_id === s.id).length;
              return (
                <Card key={s.id} className="gap-1 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{s.nome}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.convite}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {curso?.nome} · {qtd} aluno(s) · início {dataBR(s.data_inicio)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
