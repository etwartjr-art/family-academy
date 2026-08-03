import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  listarSalas,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPerfis,
  listarInscricoes,
  listarPresencas,
  lerPayloadQR,
  dataBR,
  iniciais,
  FREQUENCIA_MINIMA,
} from "@/lib/api";
import { useFiltroAluno, TODOS_ALUNOS } from "@/hooks/useFiltroAluno";

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
import { LeitorQR } from "@/components/LeitorQR";
import { somSucesso, somErro } from "@/lib/som";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chamada")({
  validateSearch: z.object({ aula: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Chamada — Escola de Finanças" },
      {
        name: "description",
        content:
          "Registre presença por leitura de QR da carteirinha, código do aluno ou marcação manual.",
      },
      { property: "og:title", content: "Chamada — Escola de Finanças" },
      { property: "og:description", content: "Presença por QR, código ou manual." },
    ],
  }),
  component: Chamada,
});

function Chamada() {
  const busca = Route.useSearch();
  const qc = useQueryClient();
  const [salaId, setSalaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [aulaId, setAulaId] = useState(busca.aula ?? "");
  const [codigo, setCodigo] = useState("");
  const { alunoSel, setAlunoSel } = useFiltroAluno();


  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const aulas = useQuery({ queryKey: ["aulas"], queryFn: () => listarAulas() });
  const matriculas = useQuery({ queryKey: ["matriculas"], queryFn: () => listarMatriculas() });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  const aulaSelecionada = (aulas.data ?? []).find((a) => a.id === aulaId);
  const moduloDaAula = (modulos.data ?? []).find((m) => m.id === aulaSelecionada?.modulo_id);

  const presencas = useQuery({
    queryKey: ["presencas-aula", aulaId],
    queryFn: () => listarPresencas([aulaId]),
    enabled: !!aulaId,
  });

  const aulasModulo = useMemo(
    () =>
      (aulas.data ?? [])
        .filter((a) => a.modulo_id === moduloDaAula?.id)
        .sort((a, b) => a.numero - b.numero),
    [aulas.data, moduloDaAula?.id],
  );

  const presencasModulo = useQuery({
    queryKey: ["presencas-modulo", moduloDaAula?.id],
    queryFn: () => listarPresencas(aulasModulo.map((a) => a.id)),
    enabled: !!moduloDaAula && aulasModulo.length > 0,
  });

  const listaAlunos = useMemo(() => {
    if (!moduloDaAula) return [];
    const ativas = (matriculas.data ?? []).filter(
      (m) => m.sala_id === moduloDaAula.sala_id && m.status !== "cancelada",
    );
    const inscritos = new Set(
      (inscricoes.data ?? [])
        .filter((i) => i.modulo_id === moduloDaAula.id)
        .map((i) => i.matricula_id),
    );
    const inscritas = ativas.filter((m) => inscritos.has(m.id));
    // Fallback: sem inscrições no módulo, usa as matrículas ativas da sala.
    const mats = inscritas.length > 0 ? inscritas : ativas;
    const totalAulas = aulasModulo.length;
    return mats
      .map((m) => {
        const perfil = (perfis.data ?? []).find((p) => p.id === m.aluno_id);
        if (!perfil) return null;
        const presencasAluno = (presencasModulo.data ?? []).filter(
          (p) => p.aluno_id === m.aluno_id,
        ).length;
        return {
          ...perfil,
          presencasModulo: presencasAluno,
          totalAulas,
          pct: totalAulas ? Math.round((presencasAluno / totalAulas) * 100) : 0,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [
    moduloDaAula,
    matriculas.data,
    inscricoes.data,
    perfis.data,
    aulasModulo,
    presencasModulo.data,
  ]);

  // Filtro de aluno compartilhado com Tarefas e Frequência.
  const filtroValido = alunoSel !== TODOS_ALUNOS && listaAlunos.some((a) => a.id === alunoSel);
  const alunosVisiveis = filtroValido
    ? listaAlunos.filter((a) => a.id === alunoSel)
    : listaAlunos;


  const presentes = new Set((presencas.data ?? []).map((p) => p.aluno_id));



  async function registrar(args: {
    alunoId?: string;
    codigoAluno?: string;
    metodo: "qr" | "codigo" | "manual";
  }) {
    if (!aulaId) return toast.error("Escolha a aula primeiro");
    const comSom = args.metodo !== "manual";
    const { data, error } = await supabase.rpc("registrar_presenca", {
      _aula_id: aulaId,
      _aluno_id: args.alunoId,
      _codigo_aluno: args.codigoAluno,
      _metodo: args.metodo,
    });
    if (error) {
      if (comSom) somErro();
      return toast.error(error.message);
    }
    const r = data as { ok?: boolean; mensagem?: string; aluno?: string } | null;
    if (r && r.ok === false) {
      if (comSom) somErro();
      return toast.error(r.mensagem ?? "Não foi possível registrar");
    }
    if (comSom) somSucesso();
    toast.success(r?.aluno ? `Presença de ${r.aluno}` : "Presença registrada");
    qc.invalidateQueries({ queryKey: ["presencas-aula", aulaId] });
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  async function remover(alunoId: string) {
    const { error } = await supabase
      .from("presencas")
      .delete()
      .eq("aula_id", aulaId)
      .eq("aluno_id", alunoId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["presencas-aula", aulaId] });
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  const salaSelecionada = (salas.data ?? []).find((s) => s.id === salaId);
  const modulosDaSala = (modulos.data ?? [])
    .filter((m) => !salaId || m.sala_id === salaId)
    .filter((m) => !salaSelecionada?.modulo_ativo_id || m.id === salaSelecionada.modulo_ativo_id);
  const moduloEfetivo =
    modulosDaSala.find((m) => m.id === moduloId)?.id ?? modulosDaSala[0]?.id ?? "";
  const aulasDoModulo = (aulas.data ?? []).filter(
    (a) => !moduloEfetivo || a.modulo_id === moduloEfetivo,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Chamada</h1>
        <p className="text-sm text-muted-foreground">
          Leia a carteirinha do aluno, digite o código de 6 caracteres ou marque na lista.
        </p>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Sala</Label>
          <Select
            value={salaId}
            onValueChange={(v) => {
              setSalaId(v);
              setModuloId("");
              setAulaId("");
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
          <Select
            value={moduloEfetivo}
            onValueChange={(v) => {
              setModuloId(v);
              setAulaId("");
            }}
          >
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
        <div className="space-y-1.5">
          <Label>Aula</Label>
          <Select value={aulaId} onValueChange={setAulaId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a aula" />
            </SelectTrigger>
            <SelectContent>
              {aulasDoModulo.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  Aula {a.numero} · {dataBR(a.data)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label>Aluno</Label>
          <Select
            value={alunoSel}
            onValueChange={setAlunoSel}
            disabled={listaAlunos.length === 0}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Selecionar aluno" />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              <SelectItem value={TODOS_ALUNOS}>Todos os alunos</SelectItem>
              {listaAlunos.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Este filtro é o mesmo usado nas telas de Tarefas e Frequência.
          </p>
        </div>
      </Card>


      {aulaId && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card className="gap-3 p-4">
              <h2 className="text-lg">Leitura por QR</h2>
              <LeitorQR
                aoLer={(texto) => {
                  const p = lerPayloadQR(texto);
                  if (p.tipo !== "aluno") {
                    somErro();
                    return toast.error("QR não é de carteirinha de aluno");
                  }
                  registrar({ codigoAluno: p.valor, metodo: "qr" });
                }}
              />
            </Card>

            <Card className="gap-3 p-4">
              <h2 className="text-lg">Código do aluno</h2>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (codigo.trim().length < 4) return toast.error("Informe o código");
                  registrar({ codigoAluno: codigo.trim().toUpperCase(), metodo: "codigo" });
                  setCodigo("");
                }}
              >
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="ABC234"
                  className="font-mono uppercase"
                  maxLength={6}
                />
                <Button type="submit">Registrar</Button>
              </form>
            </Card>
          </div>

          <Card className="gap-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg">Lista de presença</h2>
              <span className="text-sm text-muted-foreground">
                {presentes.size}/{listaAlunos.length} presentes ·{" "}
                {listaAlunos.length
                  ? Math.round((presentes.size / listaAlunos.length) * 100)
                  : 0}
                %
              </span>
            </div>
            <ul className="divide-y rounded-xl border">
              {alunosVisiveis.map((a) => {
                const presente = presentes.has(a.id);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {iniciais(a.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.nome}</span>
                      <span className="font-mono text-xs text-muted-foreground">{a.codigo}</span>
                      <span className="block text-xs text-muted-foreground">
                        Frequência no módulo:{" "}
                        <strong className={a.pct < FREQUENCIA_MINIMA ? "text-destructive" : ""}>
                          {a.pct}%
                        </strong>{" "}
                        ({a.presencasModulo}/{a.totalAulas} aulas)
                      </span>
                    </span>

                    <Button
                      size="sm"
                      variant={presente ? "default" : "secondary"}
                      onClick={() =>
                        presente ? remover(a.id) : registrar({ alunoId: a.id, metodo: "manual" })
                      }
                    >
                      {presente ? <Check className="size-4" /> : <X className="size-4" />}
                      {presente ? "Presente" : "Marcar"}
                    </Button>
                  </li>
                );
              })}
              {alunosVisiveis.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Nenhum aluno inscrito neste módulo.
                </li>
              )}


            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
