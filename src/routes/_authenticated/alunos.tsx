import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, GraduationCap, Users } from "lucide-react";
import {
  listarCursos,
  listarSalas,
  listarMatriculas,
  listarPerfis,
  baixarCSV,
  iniciais,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alunos")({
  head: () => ({
    meta: [
      { title: "Alunos por turma — Escola de Finanças Academy" },
      {
        name: "description",
        content: "Lista de alunos da Escola de Finanças Academy organizada por curso, turma e sala.",
      },
      { property: "og:title", content: "Alunos por turma — Escola de Finanças Academy" },
      { property: "og:description", content: "Alunos agrupados por curso, turma e sala." },
    ],
  }),
  component: Alunos,
});

function Alunos() {
  const [busca, setBusca] = useState("");
  const [fechados, setFechados] = useState<string[]>([]);

  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const salas = useQuery({ queryKey: ["salas"], queryFn: listarSalas });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  const carregando =
    cursos.isLoading || salas.isLoading || matriculas.isLoading || perfis.isLoading;

  const grupos = useMemo(() => {
    const porId = new Map((perfis.data ?? []).map((p) => [p.id, p]));
    const termo = busca.trim().toLowerCase();

    return (cursos.data ?? []).map((curso) => {
      const turmas = (salas.data ?? [])
        .filter((s) => s.curso_id === curso.id)
        .map((sala) => {
          const alunos = (matriculas.data ?? [])
            .filter((m) => m.sala_id === sala.id)
            .map((m) => ({ matricula: m, perfil: porId.get(m.aluno_id) }))
            .filter((a) => a.perfil)
            .filter((a) =>
              !termo
                ? true
                : `${a.perfil!.nome} ${a.perfil!.codigo} ${a.perfil!.email ?? ""}`
                    .toLowerCase()
                    .includes(termo),
            )
            .sort((a, b) => a.perfil!.nome.localeCompare(b.perfil!.nome, "pt-BR"));
          return { sala, alunos };
        })
        .filter((t) => (termo ? t.alunos.length > 0 : true));
      return { curso, turmas };
    });
  }, [cursos.data, salas.data, matriculas.data, perfis.data, busca]);

  const total = grupos.reduce(
    (acc, g) => acc + g.turmas.reduce((s, t) => s + t.alunos.length, 0),
    0,
  );

  function exportar() {
    const linhas: (string | number)[][] = [
      [
        "Curso",
        "Turma/Sala",
        "Turno",
        "Aluno",
        "Código",
        "E-mail",
        "Telefone",
        "Tipo",
        "Nome do casal",
        "Status",
      ],
    ];
    for (const g of grupos) {
      for (const t of g.turmas) {
        for (const a of t.alunos) {
          linhas.push([
            g.curso.nome,
            t.sala.nome,
            t.sala.turno ?? "",
            a.perfil!.nome,
            a.perfil!.codigo,
            a.perfil!.email ?? "",
            a.perfil!.telefone ?? "",
            a.matricula.tipo,
            a.matricula.nome_casal ?? "",
            a.matricula.status,
          ]);
        }
      }
    }
    baixarCSV("alunos-por-turma.csv", linhas);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground">
            {total} aluno(s) organizados por curso, turma e sala.
          </p>
        </div>
        <Button variant="outline" onClick={exportar} disabled={total === 0}>
          Exportar CSV
        </Button>
      </header>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, código ou e-mail"
        className="max-w-sm"
      />

      {carregando ? (
        <Card className="p-6 text-sm text-muted-foreground">Carregando alunos…</Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.curso.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-muted-foreground" />
                <h2 className="font-display text-base font-bold">{g.curso.nome}</h2>
              </div>

              {g.turmas.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">
                  Nenhuma turma cadastrada neste curso.
                </Card>
              ) : (
                g.turmas.map(({ sala, alunos }) => {
                  const fechado = fechados.includes(sala.id);
                  return (
                    <Card key={sala.id} className="overflow-hidden">
                      <button
                        onClick={() =>
                          setFechados((v) =>
                            v.includes(sala.id) ? v.filter((x) => x !== sala.id) : [...v, sala.id],
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{sala.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {sala.turno ? `${sala.turno} · ` : ""}
                            {sala.convite}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-4" />
                            {alunos.length}
                          </span>
                          <ChevronDown
                            className={cn("size-4 transition-transform", !fechado && "rotate-180")}
                          />
                        </div>
                      </button>

                      {!fechado && (
                        <div className="border-t">
                          {alunos.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">
                              Nenhum aluno matriculado nesta sala.
                            </p>
                          ) : (
                            <ul className="divide-y">
                              {alunos.map(({ perfil, matricula }) => (
                                <li
                                  key={matricula.id}
                                  className="flex items-center gap-3 px-4 py-2.5"
                                >
                                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                                    {iniciais(perfil!.nome)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {perfil!.nome}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {perfil!.email ?? "sem e-mail"}
                                      {perfil!.telefone ? ` · ${perfil!.telefone}` : ""}
                                      {matricula.tipo === "casal"
                                        ? ` · Casal: ${matricula.nome_casal ?? "—"}`
                                        : ""}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                    {perfil!.codigo}
                                  </span>
                                  {matricula.status !== "ativa" && (
                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                                      {matricula.status}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="border-t px-4 py-2">
                            <Link
                              to="/salas/$id"
                              params={{ id: sala.id }}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Abrir sala
                            </Link>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
