import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listarSalas,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPerfis,
  listarInscricoes,
  listarPresencas,
  baixarCSV,
  FREQUENCIA_MINIMA,
} from "@/lib/api";
import { useFiltroAluno, TODOS_ALUNOS } from "@/hooks/useFiltroAluno";
import { useRealtimePresencas } from "@/hooks/useRealtimePresencas";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/frequencia")({
  head: () => ({
    meta: [
      { title: "Frequência — Escola de Finanças" },
      {
        name: "description",
        content: "Grade de presença por módulo com percentual por aluno e exportação em CSV.",
      },
      { property: "og:title", content: "Frequência — Escola de Finanças" },
      { property: "og:description", content: "Grade de frequência e exportação CSV." },
    ],
  }),
  component: Frequencia,
});

function Frequencia() {
  const [salaId, setSalaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const { alunoSel, setAlunoSel } = useFiltroAluno();


  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas"], queryFn: () => listarAulas() });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const presencas = useQuery({ queryKey: ["presencas"], queryFn: () => listarPresencas() });

  const modulo = (modulos.data ?? []).find((m) => m.id === moduloId);
  const aulasModulo = (aulas.data ?? [])
    .filter((a) => a.modulo_id === moduloId)
    .sort((a, b) => a.numero - b.numero);

  const linhas = useMemo(() => {
    if (!modulo) return [];
    const ativas = (matriculas.data ?? []).filter(
      (m) => m.sala_id === modulo.sala_id && m.status !== "cancelada",
    );
    const inscritos = new Set(
      (inscricoes.data ?? []).filter((i) => i.modulo_id === modulo.id).map((i) => i.matricula_id),
    );
    const inscritas = ativas.filter((m) => inscritos.has(m.id));
    // Fallback: se nenhuma inscrição foi registrada no módulo, usa as
    // matrículas ativas da sala para que as porcentagens sempre apareçam.
    const mats = inscritas.length > 0 ? inscritas : ativas;
    const idsAulas = aulasModulo.map((a) => a.id);
    return mats
      .map((m) => {
        const perfil = (perfis.data ?? []).find((p) => p.id === m.aluno_id);
        const marcas = idsAulas.map((idAula) =>
          (presencas.data ?? []).some((p) => p.aula_id === idAula && p.aluno_id === m.aluno_id),
        );
        const total = marcas.filter(Boolean).length;
        const pct = idsAulas.length ? Math.round((total / idsAulas.length) * 100) : 0;
        return {
          id: m.aluno_id,
          nome: perfil?.nome ?? "—",
          codigo: perfil?.codigo ?? "—",
          marcas,
          pct,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [modulo, aulasModulo, inscricoes.data, matriculas.data, perfis.data, presencas.data]);


  // Filtro de aluno compartilhado com Tarefas e Chamada.
  // Só aplica o filtro quando o aluno escolhido existe neste módulo;
  // caso contrário mostra todos (evita tabela vazia sem porcentagens).
  const filtroValido = alunoSel !== TODOS_ALUNOS && linhas.some((l) => l.id === alunoSel);
  const linhasVisiveis = filtroValido ? linhas.filter((l) => l.id === alunoSel) : linhas;


  const abaixo = linhas.filter((l) => l.pct < FREQUENCIA_MINIMA);

  const totaisAulas = aulasModulo.map((_, i) => {
    const presentes = linhas.filter((l) => l.marcas[i]).length;
    const pct = linhas.length ? Math.round((presentes / linhas.length) * 100) : 0;
    return { presentes, pct };
  });

  const modulosDaSala = (modulos.data ?? []).filter((m) => !salaId || m.sala_id === salaId);

  function exportar() {
    const cabecalho = ["Aluno", "Código", ...aulasModulo.map((a) => `Aula ${a.numero}`), "%"];
    const corpo = linhasVisiveis.map((l) => [

      l.nome,
      l.codigo,
      ...l.marcas.map((m) => (m ? "P" : "F")),
      `${l.pct}%`,
    ]);
    const rodapePresentes = [
      "Presentes",
      `${linhas.length} inscritos`,
      ...totaisAulas.map((t) => String(t.presentes)),
      "",
    ];
    const rodapePct = ["% por aula", "", ...totaisAulas.map((t) => `${t.pct}%`), ""];
    baixarCSV(`frequencia-${modulo?.nome ?? "modulo"}.csv`, [
      cabecalho,
      ...corpo,
      rodapePresentes,
      rodapePct,
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Frequência</h1>
        <p className="text-sm text-muted-foreground">
          Mínimo exigido: {FREQUENCIA_MINIMA}% de presença por módulo.
        </p>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Sala</Label>
          <Select
            value={salaId}
            onValueChange={(v) => {
              setSalaId(v);
              setModuloId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha a sala" />
            </SelectTrigger>
            <SelectContent>
              {(salas.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Módulo</Label>
          <Select value={moduloId} onValueChange={setModuloId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o módulo" />
            </SelectTrigger>
            <SelectContent>
              {modulosDaSala.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Aluno</Label>
          <Select value={alunoSel} onValueChange={setAlunoSel} disabled={linhas.length === 0}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Selecionar aluno" />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              <SelectItem value={TODOS_ALUNOS}>Todos os alunos</SelectItem>
              {linhas.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Este filtro é o mesmo usado nas telas de Tarefas e Chamada.
          </p>
        </div>
      </Card>


      {modulo && (
        <>
          {abaixo.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p>
                <strong>{abaixo.length}</strong> aluno(s) abaixo de {FREQUENCIA_MINIMA}%:{" "}
                {abaixo.map((a) => a.nome).join(", ")}
              </p>
            </div>
          )}

          <Card className="gap-3 overflow-x-auto p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg">{modulo.nome}</h2>
              <Button size="sm" variant="secondary" onClick={exportar}>
                <Download className="size-4" /> CSV
              </Button>
            </div>
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Aluno</th>
                  {aulasModulo.map((a) => (
                    <th key={a.id} className="px-2 py-2 text-center font-medium">
                      A{a.numero}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linhasVisiveis.map((l) => (
                  <tr key={l.codigo}>
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{l.nome}</span>
                      <span className="font-mono text-xs text-muted-foreground">{l.codigo}</span>
                    </td>
                    {l.marcas.map((m, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        <span className={m ? "text-primary" : "text-muted-foreground"}>
                          {m ? "P" : "·"}
                        </span>
                      </td>
                    ))}
                    <td
                      className={`px-2 py-2 text-right font-semibold ${
                        l.pct < FREQUENCIA_MINIMA ? "text-destructive" : ""
                      }`}
                    >
                      {l.pct}%
                    </td>
                  </tr>
                ))}
                {linhasVisiveis.length === 0 && (
                  <tr>
                    <td colSpan={aulasModulo.length + 2} className="py-3 text-muted-foreground">
                      Nenhum aluno inscrito neste módulo.
                    </td>
                  </tr>
                )}


              </tbody>
              {linhas.length > 0 && (
                <tfoot className="border-t-2">
                  <tr className="text-xs">
                    <td className="py-2 pr-3 font-medium text-muted-foreground">
                      Presentes ({linhas.length} inscritos)
                    </td>
                    {totaisAulas.map((t, i) => (
                      <td key={i} className="px-2 py-2 text-center font-semibold">
                        {t.presentes}
                      </td>
                    ))}
                    <td />
                  </tr>
                  <tr className="text-xs">
                    <td className="py-2 pr-3 font-medium text-muted-foreground">% por aula</td>
                    {totaisAulas.map((t, i) => (
                      <td
                        key={i}
                        className={`px-2 py-2 text-center font-semibold ${
                          t.pct < FREQUENCIA_MINIMA ? "text-destructive" : "text-primary"
                        }`}
                      >
                        {t.pct}%
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
