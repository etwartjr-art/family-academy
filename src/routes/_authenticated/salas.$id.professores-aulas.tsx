import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarSalas,
  listarCursos,
  listarModulos,
  listarAulas,
  listarPerfis,
  listarPapeis,
  dataBR,
  iniciais,
} from "@/lib/api";
import { useSessao } from "@/hooks/useSessao";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/salas/$id/professores-aulas")({
  head: () => ({
    meta: [
      { title: "Professores por aula — Family Academy" },
      {
        name: "description",
        content:
          "Defina qual professor da turma ensinará cada aula do módulo em andamento na Family Academy.",
      },
      { property: "og:title", content: "Professores por aula — Family Academy" },
      {
        property: "og:description",
        content: "Distribua as aulas do módulo em andamento entre os professores da turma.",
      },
    ],
  }),
  component: ProfessoresAulas,
});

function ProfessoresAulas() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sessao } = useSessao();
  const { pode } = usePermissoes();

  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const modulos = useQuery({ queryKey: ["modulos", id], queryFn: () => listarModulos(id) });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });
  const salaProfs = useQuery({
    queryKey: ["sala-professores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sala_professores")
        .select("professor_id")
        .eq("sala_id", id);
      if (error) throw error;
      return (data ?? []).map((r) => r.professor_id);
    },
  });

  const listaModulos = modulos.data ?? [];
  const idsModulos = listaModulos.map((m) => m.id);
  const aulas = useQuery({
    queryKey: ["aulas", idsModulos],
    queryFn: () => listarAulas(idsModulos),
    enabled: idsModulos.length > 0,
  });

  const sala = (salas.data ?? []).find((s) => s.id === id);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
  const moduloAtivo =
    listaModulos.find((m) => m.id === sala?.modulo_ativo_id) ?? listaModulos[0] ?? null;
  const aulasDoModulo = (aulas.data ?? []).filter((a) => a.modulo_id === moduloAtivo?.id);

  const equipe = salaProfs.data ?? [];
  const gerencia =
    sessao?.papel === "coordenador" ||
    (!!sala?.professor_id && sala.professor_id === sessao?.user.id) ||
    (!!sessao?.user.id && equipe.includes(sessao.user.id));
  const podeDefinir = gerencia && pode("turma_definir_professor");

  const professoresGerais = (perfis.data ?? []).filter((p) =>
    (papeis.data ?? []).some((r) => r.user_id === p.id && r.papel === "professor"),
  );
  const idsEquipe = new Set<string>([...equipe, ...(sala?.professor_id ? [sala.professor_id] : [])]);
  const equipePerfis = (perfis.data ?? []).filter((p) => idsEquipe.has(p.id));
  const opcoes = equipePerfis.length > 0 ? equipePerfis : professoresGerais;

  const definir = useMutation({
    mutationFn: async ({
      aulaId,
      professorId,
    }: {
      aulaId: string;
      professorId: string | null;
    }) => {
      const { error } = await supabase
        .from("aulas")
        .update({ professor_id: professorId })
        .eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Professor da aula atualizado");
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atribuirTodas = useMutation({
    mutationFn: async (professorId: string) => {
      const ids = aulasDoModulo.map((a) => a.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("aulas")
        .update({ professor_id: professorId })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas as aulas do módulo foram atribuídas");
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const semProfessor = aulasDoModulo.filter((a) => !a.professor_id).length;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/salas/$id" params={{ id }}>
          <ArrowLeft className="size-4" /> Voltar para a turma
        </Link>
      </Button>

      <Card className="space-y-1 p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="size-5 text-primary" />
          Professores por aula
        </h1>
        <p className="text-sm text-muted-foreground">
          {sala?.nome ?? "Turma"} · {curso?.nome ?? "—"}
          {moduloAtivo ? ` · Módulo em andamento: ${moduloAtivo.nome}` : ""}
        </p>
        {aulasDoModulo.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {aulasDoModulo.length} aulas ·{" "}
            {semProfessor === 0 ? "todas com professor definido" : `${semProfessor} sem professor`}
          </p>
        )}
      </Card>

      {!moduloAtivo ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Esta turma ainda não tem módulo em andamento. Defina o módulo na página da turma.
        </Card>
      ) : (
        <>
          {podeDefinir && opcoes.length > 0 && (
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Atribuir todas as aulas a</span>
                <Select onValueChange={(v) => atribuirTodas.mutate(v)}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Escolher professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Depois é possível ajustar aula por aula abaixo.
              </p>
            </Card>
          )}

          <Card className="divide-y p-0">
            {aulasDoModulo.map((a) => {
              const prof = (perfis.data ?? []).find((p) => p.id === a.professor_id);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {a.numero}
                  </span>
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">{dataBR(a.data)}</p>
                  </div>
                  {prof ? (
                    <Badge variant="secondary" className="gap-1.5">
                      <span className="grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {iniciais(prof.nome)}
                      </span>
                      {prof.nome}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sem professor</Badge>
                  )}
                  <Select
                    value={a.professor_id ?? "nenhum"}
                    onValueChange={(v) =>
                      definir.mutate({ aulaId: a.id, professorId: v === "nenhum" ? null : v })
                    }
                    disabled={!podeDefinir}
                  >
                    <SelectTrigger className="h-9 w-56">
                      <SelectValue placeholder="Professor da aula" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem professor definido</SelectItem>
                      {opcoes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {aulasDoModulo.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhuma aula cadastrada neste módulo.
              </p>
            )}
          </Card>

          {!podeDefinir && (
            <p className="text-xs text-muted-foreground">
              Você não tem permissão para definir o professor das aulas desta turma.
            </p>
          )}
        </>
      )}
    </div>
  );
}
