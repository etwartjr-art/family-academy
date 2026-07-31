import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listarAulas, listarCursos, listarModulos, listarSalas } from "@/lib/api";
import { listarMateriais } from "@/lib/materiais";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Library, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/materiais/")({
  head: () => ({
    meta: [
      { title: "Materiais de estudo — Escola de Finanças" },
      {
        name: "description",
        content:
          "Biblioteca de materiais por aula: e-books, apostilas, planilhas, slides, vídeos e links das turmas.",
      },
      { property: "og:title", content: "Materiais de estudo — Escola de Finanças" },
      { property: "og:description", content: "Biblioteca de materiais por curso, turma e aula." },
    ],
  }),
  component: IndiceMateriais,
});

function IndiceMateriais() {
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const salas = useQuery({ queryKey: ["salas"], queryFn: listarSalas });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas-todas"], queryFn: () => listarAulas() });
  const materiais = useQuery({ queryKey: ["materiais"], queryFn: () => listarMateriais() });
  const [busca, setBusca] = useState("");

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const mat of materiais.data ?? []) m.set(mat.aula_id, (m.get(mat.aula_id) ?? 0) + 1);
    return m;
  }, [materiais.data]);

  const termo = busca.trim().toLowerCase();
  const listaSalas = (salas.data ?? []).filter(
    (s) => !termo || s.nome.toLowerCase().includes(termo),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Materiais de estudo</h1>
        <p className="text-sm text-muted-foreground">
          Escolha a aula para publicar ou revisar e-books, apostilas, planilhas, slides, vídeos e
          links.
        </p>
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
                      return (
                        <div key={mod.id} className="px-3 py-2.5">
                          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            {mod.nome}
                          </div>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {aulasDoModulo.map((a) => (
                              <li key={a.id}>
                                <Button
                                  asChild
                                  variant="outline"
                                  className="h-auto w-full justify-between py-2 text-left"
                                >
                                  <Link to="/materiais/$aulaId" params={{ aulaId: a.id }}>
                                    <span className="min-w-0 truncate text-sm">
                                      Aula {a.numero} · {a.titulo}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Library className="size-3.5" />
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
