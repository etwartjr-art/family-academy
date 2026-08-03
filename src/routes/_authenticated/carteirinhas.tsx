import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listarSalas, listarMatriculas, listarPerfis, listarCursos } from "@/lib/api";
import { useFiltroAluno, TODOS_ALUNOS } from "@/hooks/useFiltroAluno";
import { QRCodeBox } from "@/components/QRCodeBox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer } from "lucide-react";

const TODOS_CURSOS = "todos";


export const Route = createFileRoute("/_authenticated/carteirinhas")({
  head: () => ({
    meta: [
      { title: "Carteirinhas — Escola de Finanças" },
      {
        name: "description",
        content: "Gere e imprima as carteirinhas dos alunos com QR code para a chamada.",
      },
      { property: "og:title", content: "Carteirinhas — Escola de Finanças" },
      { property: "og:description", content: "Carteirinhas com QR para chamada." },
    ],
  }),
  component: Carteirinhas,
});

function Carteirinhas() {
  const [cursoId, setCursoId] = useState(TODOS_CURSOS);
  const [salaId, setSalaId] = useState("");
  const [busca, setBusca] = useState("");
  const { alunoSel, setAlunoSel, filtrando } = useFiltroAluno();

  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  const salasFiltradas = (salas.data ?? []).filter(
    (s) => cursoId === TODOS_CURSOS || s.curso_id === cursoId,
  );
  const sala = salasFiltradas.find((s) => s.id === salaId);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);

  const matriculasSala = (matriculas.data ?? []).filter(
    (m) => m.sala_id === salaId && m.status !== "cancelada",
  );
  const termo = busca.trim().toLowerCase();
  const alunos = matriculasSala
    .map((m) => {
      const perfil = (perfis.data ?? []).find((p) => p.id === m.aluno_id);
      if (!perfil) return null;
      const casal = m.tipo === "casal" ? (m.nome_casal?.trim() || null) : null;
      return { ...perfil, casal };
    })
    .filter((a): a is NonNullable<typeof a> => !!a)
    .filter((a) => !filtrando || a.id === alunoSel)
    .filter(
      (a) =>
        !termo ||
        a.nome.toLowerCase().includes(termo) ||
        a.codigo.toLowerCase().includes(termo) ||
        (a.casal ?? "").toLowerCase().includes(termo),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const alunosDaSala = matriculasSala
    .map((m) => (perfis.data ?? []).find((p) => p.id === m.aluno_id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => a.nome.localeCompare(b.nome));


  return (
    <div className="space-y-6">
      <div className="sem-impressao flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Carteirinhas</h1>
          <p className="text-sm text-muted-foreground">
            Cada QR contém o código do aluno usado na chamada.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => window.print()}
          disabled={!salaId || alunos.length === 0}
        >
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>

      <Card className="sem-impressao gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Curso</Label>
            <Select
              value={cursoId}
              onValueChange={(v) => {
                setCursoId(v);
                setSalaId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os cursos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_CURSOS}>Todos os cursos</SelectItem>
                {(cursos.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Sala</Label>
            <Select value={salaId} onValueChange={setSalaId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a sala" />
              </SelectTrigger>
              <SelectContent>
                {salasFiltradas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Aluno</Label>
            <Select value={alunoSel} onValueChange={setAlunoSel}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os alunos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_ALUNOS}>Todos os alunos</SelectItem>
                {alunosDaSala.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código"
            />
          </div>
        </div>

        {salaId && (
          <p className="text-xs text-muted-foreground">
            {alunos.length} de {matriculasSala.length} aluno(s) selecionado(s)
            {filtrando ? " · filtro de aluno ativo" : ""}
          </p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {alunos.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-diario"
          >
            <QRCodeBox
              valor={a.casal ? `FA|ALUNO|${a.codigo}|CASAL|${a.casal}` : `FA|ALUNO|${a.codigo}`}
              tamanho={84}
            />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {curso?.nome ?? "Escola de Finanças"}
              </div>
              <div className="truncate font-display text-base font-extrabold">{a.nome}</div>
              {a.casal && (
                <div className="truncate text-xs font-semibold text-primary">
                  Casal: {a.casal}
                </div>
              )}
              <div className="font-mono text-sm">{a.codigo}</div>
              <div className="text-xs text-muted-foreground">{sala?.nome}</div>
            </div>

          </div>
        ))}
        {salaId && alunos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum aluno encontrado com os filtros aplicados.
          </p>
        )}
        {!salaId && (
          <p className="text-sm text-muted-foreground">Escolha uma sala para gerar as carteirinhas.</p>
        )}
      </div>
    </div>
  );
}

