import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarCursos,
  listarSalas,
  listarMatriculas,
  listarPerfis,
  listarPapeis,
  dataBR,
} from "@/lib/api";
import { useSessao } from "@/hooks/useSessao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeBox } from "@/components/QRCodeBox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated/salas/")({
  head: () => ({
    meta: [
      { title: "Salas — Family Academy" },
      {
        name: "description",
        content: "Turmas da Family Academy agrupadas por curso, com QR de convite para matrícula.",
      },
      { property: "og:title", content: "Salas — Family Academy" },
      { property: "og:description", content: "Turmas e convites por QR code." },
    ],
  }),
  component: Salas,
});

function Salas() {
  const qc = useQueryClient();
  const { data: sessao } = useSessao();
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });

  const [filtro, setFiltro] = useState("todos");
  const [nome, setNome] = useState("");
  const [cursoId, setCursoId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [turno, setTurno] = useState("Noite");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));

  const coordenador = sessao?.papel === "coordenador";
  const professor = sessao?.papel === "professor";
  const podeCriar = coordenador || professor;
  const professores = (perfis.data ?? []).filter((p) =>
    (papeis.data ?? []).some((r) => r.user_id === p.id && r.papel === "professor"),
  );

  const podeExcluir = (sala: { professor_id: string | null }) =>
    coordenador || (professor && sala.professor_id === sessao?.user.id);

  const criar = useMutation({
    mutationFn: async () => {
      if (!nome.trim() || !cursoId) throw new Error("Informe nome e curso");
      // professor só cria turmas em que ele é o responsável (regra também aplicada no banco)
      const responsavel = coordenador ? professorId || null : (sessao?.user.id ?? null);
      const { error } = await supabase.from("salas").insert({
        nome: nome.trim(),
        curso_id: cursoId,
        professor_id: responsavel,
        turno,
        data_inicio: inicio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNome("");
      toast.success("Sala criada com os módulos da ementa e 5 aulas por módulo");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma excluída");
      qc.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error(e.message || "Não foi possível excluir. Verifique suas permissões."),
  });

  const visiveis = (salas.data ?? []).filter((s) => filtro === "todos" || s.curso_id === filtro);
  const origem = typeof window !== "undefined" ? window.location.origin : "";


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Salas de aula</h1>
          <p className="text-sm text-muted-foreground">
            Cada sala nasce com a ementa do curso e um QR de convite.
          </p>
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por curso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cursos</SelectItem>
            {(cursos.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {podeCriar && (
        <Card className="gap-3 p-4">
          <h2 className="text-lg">Nova sala</h2>

          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              criar.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="nome-sala">Nome da turma</Label>
              <Input
                id="nome-sala"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Turma 2026.1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Curso</Label>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o curso" />
                </SelectTrigger>
                <SelectContent>
                  {(cursos.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Professor responsável</Label>
              <Select value={professorId} onValueChange={setProfessorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem professor" />
                </SelectTrigger>
                <SelectContent>
                  {professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="turno">Turno</Label>
                <Input id="turno" value={turno} onChange={(e) => setTurno(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inicio">Início</Label>
                <Input
                  id="inicio"
                  type="date"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={criar.isPending}>
                <Plus className="size-4" /> Criar sala
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {visiveis.map((s) => {
          const curso = cursos.data?.find((c) => c.id === s.curso_id);
          const prof = perfis.data?.find((p) => p.id === s.professor_id);
          const qtd = (matriculas.data ?? []).filter((m) => m.sala_id === s.id).length;
          return (
            <Card key={s.id} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg">{s.nome}</h2>
                  <p className="text-xs text-muted-foreground">
                    {curso?.nome} · {s.turno ?? "—"} · início {dataBR(s.data_inicio)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Professor: {prof?.nome ?? "não definido"} · {qtd} aluno(s)
                  </p>
                  <p className="mt-2 font-mono text-sm">{s.convite}</p>
                </div>
                <QRCodeBox valor={`${origem}/matricula/${s.convite}`} tamanho={92} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/salas/$id" params={{ id: s.id }}>
                    Abrir sala
                  </Link>
                </Button>
                {podeExcluir(s) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={excluir.isPending}>
                        <Trash2 className="size-4" /> Excluir turma
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {s.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação remove a turma com seus módulos, aulas, matrículas e presenças
                          registradas. Não é possível desfazer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => excluir.mutate(s.id)}>
                          Excluir definitivamente
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

            </Card>
          );
        })}
        {visiveis.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma sala nesse filtro.</p>
        )}
      </div>
    </div>
  );
}
