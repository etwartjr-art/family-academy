import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listarSalas,
  listarCursos,
  listarModulos,
  listarAulas,
  listarMatriculas,
  listarPerfis,
  listarPapeis,
  listarInscricoes,
  dataBR,
  iniciais,
} from "@/lib/api";
import { useSessao } from "@/hooks/useSessao";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useServerFn } from "@tanstack/react-start";
import { criarUsuario } from "@/lib/usuarios.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { QRCodeBox } from "@/components/QRCodeBox";
import { ImportarAlunosCSV } from "@/components/ImportarAlunosCSV";
import { toast } from "sonner";
import { ArrowLeft, History as HistoryIcon, Pencil, Search, Trash2, UserPlus } from "lucide-react";

const ROTULOS_CAMPO: Record<string, string> = {
  nome: "Nome da turma",
  professor: "Professor",
  turno: "Turno",
  data_inicio: "Data de início",
};

function formatarValor(campo: string, valor: string | null) {
  if (!valor) return "—";
  if (campo === "data_inicio") return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
  return valor;
}



export const Route = createFileRoute("/_authenticated/salas/$id")({
  head: () => ({
    meta: [
      { title: "Sala — Family Academy" },
      {
        name: "description",
        content: "Módulos, aulas e alunos inscritos da turma, com controle de datas e inscrições.",
      },
      { property: "og:title", content: "Sala — Family Academy" },
      { property: "og:description", content: "Módulos, aulas e inscrições da turma." },
    ],
  }),
  component: SalaDetalhe,
});

function SalaDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: sessao } = useSessao();

  const salas = useQuery({ queryKey: ["salas"], queryFn: () => listarSalas() });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const modulos = useQuery({ queryKey: ["modulos", id], queryFn: () => listarModulos(id) });
  const matriculas = useQuery({ queryKey: ["matriculas", id], queryFn: () => listarMatriculas(id) });
  const inscricoes = useQuery({ queryKey: ["inscricoes"], queryFn: listarInscricoes });
  const perfis = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });
  const papeis = useQuery({ queryKey: ["papeis"], queryFn: listarPapeis });
  const { pode } = usePermissoes();
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
  const auditoria = useQuery({
    queryKey: ["salas-auditoria", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salas_auditoria")
        .select("id, campo, valor_antigo, valor_novo, alterado_por, criado_em")
        .eq("sala_id", id)
        .order("criado_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [editando, setEditando] = useState(false);
  const [editandoModulo, setEditandoModulo] = useState(false);
  const [formModulo, setFormModulo] = useState({ nome: "", ordem: 0, data_inicio: "" });
  const [adicionando, setAdicionando] = useState(false);
  const [novo, setNovo] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    tipo: "individual" as "individual" | "casal",
    nome_casal: "",
  });
  const [buscaExistente, setBuscaExistente] = useState("");
  const [existente, setExistente] = useState({
    aluno_id: "",
    tipo: "individual" as "individual" | "casal",
    nome_casal: "",
  });
  const [buscaMatriculados, setBuscaMatriculados] = useState("");
  const [removendo, setRemovendo] = useState<{ id: string; nome: string } | null>(null);

  const [form, setForm] = useState({
    nome: "",
    professor_id: "",
    turno: "",
    data_inicio: "",
  });


  const idsModulos = (modulos.data ?? []).map((m) => m.id);
  const aulas = useQuery({
    queryKey: ["aulas", idsModulos],
    queryFn: () => listarAulas(idsModulos),
    enabled: idsModulos.length > 0,
  });

  const navigate = useNavigate();
  const sala = (salas.data ?? []).find((s) => s.id === id);
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const professores = (perfis.data ?? []).filter((p) =>
    (papeis.data ?? []).some((r) => r.user_id === p.id && r.papel === "professor"),
  );
  const coordenador = sessao?.papel === "coordenador";
  const equipe = salaProfs.data ?? [];
  const gerencia =
    sessao?.papel === "coordenador" ||
    (!!sala?.professor_id && sala.professor_id === sessao?.user.id) ||
    (!!sessao?.user.id && equipe.includes(sessao.user.id));
  const podeEditar = gerencia && pode("turma_editar");
  const podeMatricular = gerencia && pode("turma_matricular");
  const podeDefinirProfessor = gerencia && pode("turma_definir_professor");

  const listaModulos = modulos.data ?? [];
  const moduloAtivo =
    listaModulos.find((m) => m.id === sala?.modulo_ativo_id) ?? listaModulos[0] ?? null;
  const aulasDoModulo = (aulas.data ?? []).filter((a) => a.modulo_id === moduloAtivo?.id);
  const equipePerfis = equipe
    .map((pid) => (perfis.data ?? []).find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const professoresDisponiveis = professores.filter((p) => !equipe.includes(p.id));

  const idsMatriculados = new Set((matriculas.data ?? []).map((m) => m.aluno_id));
  const termoExistente = buscaExistente.trim().toLowerCase();
  const candidatos = (perfis.data ?? [])
    .filter((p) => !idsMatriculados.has(p.id))
    .filter((p) =>
      termoExistente.length === 0
        ? false
        : [p.nome, p.email ?? "", p.codigo].some((v) =>
            v.toLowerCase().includes(termoExistente),
          ),
    )
    .slice(0, 8);

  const termoMatriculados = buscaMatriculados.trim().toLowerCase();
  const matriculasVisiveis = (matriculas.data ?? []).filter((mat) => {
    if (!termoMatriculados) return true;
    const perfil = (perfis.data ?? []).find((p) => p.id === mat.aluno_id);
    return [perfil?.nome ?? "", perfil?.email ?? "", perfil?.codigo ?? "", mat.nome_casal ?? ""]
      .some((v) => v.toLowerCase().includes(termoMatriculados));
  });



  const salvarSala = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("salas")
        .update({
          nome: form.nome.trim(),
          professor_id: form.professor_id || null,
          turno: form.turno.trim() || null,
          data_inicio: form.data_inicio,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma atualizada");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["salas"] });
      qc.invalidateQueries({ queryKey: ["salas-auditoria", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useServerFn(criarUsuario);

  const adicionarAluno = useMutation({
    mutationFn: async () => {
      const { id: alunoId } = await criar({
        data: {
          nome: novo.nome.trim(),
          email: novo.email.trim(),
          senha: novo.senha,
          telefone: novo.telefone.trim(),
          papel: "aluno",
        },
      });

      const { data: matricula, error } = await supabase
        .from("matriculas")
        .insert({
          aluno_id: alunoId,
          sala_id: id,
          status: "ativa",
          tipo: novo.tipo,
          nome_casal: novo.tipo === "casal" ? novo.nome_casal.trim() || null : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (idsModulos.length > 0) {
        const { error: erroMod } = await supabase
          .from("matricula_modulos")
          .insert(idsModulos.map((moduloId) => ({ matricula_id: matricula.id, modulo_id: moduloId })));
        if (erroMod) throw erroMod;
      }
    },
    onSuccess: () => {
      toast.success("Aluno adicionado à turma");
      setNovo({
        nome: "",
        email: "",
        telefone: "",
        senha: "",
        tipo: "individual",
        nome_casal: "",
      });
      setAdicionando(false);
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["perfis"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matricularExistente = useMutation({
    mutationFn: async () => {
      const { data: matricula, error } = await supabase
        .from("matriculas")
        .insert({
          aluno_id: existente.aluno_id,
          sala_id: id,
          status: "ativa",
          tipo: existente.tipo,
          nome_casal:
            existente.tipo === "casal" ? existente.nome_casal.trim() || null : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (idsModulos.length > 0) {
        const { error: erroMod } = await supabase
          .from("matricula_modulos")
          .insert(
            idsModulos.map((moduloId) => ({ matricula_id: matricula.id, modulo_id: moduloId })),
          );
        if (erroMod) throw erroMod;
      }
    },
    onSuccess: () => {
      toast.success("Aluno matriculado na turma");
      setExistente({ aluno_id: "", tipo: "individual", nome_casal: "" });
      setBuscaExistente("");
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerMatricula = useMutation({
    mutationFn: async (matriculaId: string) => {
      const { error: erroMod } = await supabase
        .from("matricula_modulos")
        .delete()
        .eq("matricula_id", matriculaId);
      if (erroMod) throw erroMod;
      const { error } = await supabase.from("matriculas").delete().eq("id", matriculaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição removida da turma");
      setRemovendo(null);
      qc.invalidateQueries({ queryKey: ["matriculas"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const salvarTipo = useMutation({
    mutationFn: async ({
      matriculaId,
      tipo,
      nomeCasal,
    }: {
      matriculaId: string;
      tipo: "individual" | "casal";
      nomeCasal: string | null;
    }) => {
      const { error } = await supabase
        .from("matriculas")
        .update({ tipo, nome_casal: tipo === "casal" ? nomeCasal : null })
        .eq("id", matriculaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matriculas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirEdicao() {
    if (!sala) return;
    setForm({
      nome: sala.nome,
      professor_id: sala.professor_id ?? "",
      turno: sala.turno ?? "",
      data_inicio: sala.data_inicio.slice(0, 10),
    });
    setEditando(true);
  }


  const definirModuloAtivo = useMutation({
    mutationFn: async (moduloId: string) => {
      const { error } = await supabase
        .from("salas")
        .update({ modulo_ativo_id: moduloId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo da turma atualizado");
      qc.invalidateQueries({ queryKey: ["salas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adicionarProfessor = useMutation({
    mutationFn: async (professorId: string) => {
      const { error } = await supabase
        .from("sala_professores")
        .insert({ sala_id: id, professor_id: professorId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Professor adicionado à turma");
      qc.invalidateQueries({ queryKey: ["sala-professores", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerProfessor = useMutation({
    mutationFn: async (professorId: string) => {
      const { error } = await supabase
        .from("sala_professores")
        .delete()
        .eq("sala_id", id)
        .eq("professor_id", professorId);
      if (error) throw error;
      const { error: erroAulas } = await supabase
        .from("aulas")
        .update({ professor_id: null })
        .eq("professor_id", professorId)
        .in("modulo_id", idsModulos.length > 0 ? idsModulos : ["00000000-0000-0000-0000-000000000000"]);
      if (erroAulas) throw erroAulas;
    },
    onSuccess: () => {
      toast.success("Professor removido da turma");
      qc.invalidateQueries({ queryKey: ["sala-professores", id] });
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const definirProfessorAula = useMutation({
    mutationFn: async ({ aulaId, professorId }: { aulaId: string; professorId: string | null }) => {
      const { error } = await supabase
        .from("aulas")
        .update({ professor_id: professorId })
        .eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarData = useMutation({
    mutationFn: async ({ aulaId, data }: { aulaId: string; data: string }) => {
      const { error } = await supabase
        .from("aulas")
        .update({ data: data || null })
        .eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarModulo = useMutation({
    mutationFn: async (dados: {
      moduloId: string;
      nome: string;
      ordem: number;
      data_inicio: string;
    }) => {
      const { error } = await supabase
        .from("modulos")
        .update({
          nome: dados.nome.trim(),
          ordem: dados.ordem,
          ...(dados.data_inicio ? { data_inicio: dados.data_inicio } : {}),
        })
        .eq("id", dados.moduloId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulo atualizado");
      setEditandoModulo(false);
      qc.invalidateQueries({ queryKey: ["modulos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarTituloAula = useMutation({
    mutationFn: async ({ aulaId, titulo }: { aulaId: string; titulo: string }) => {
      const limpo = titulo.trim();
      if (!limpo) throw new Error("O título da aula não pode ficar vazio");
      const { error } = await supabase.from("aulas").update({ titulo: limpo }).eq("id", aulaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aulas"] }),
    onError: (e: Error) => toast.error(e.message),
  });



  const alternarInscricao = useMutation({
    mutationFn: async ({
      matriculaId,
      moduloId,
      inscrito,
    }: {
      matriculaId: string;
      moduloId: string;
      inscrito: boolean;
    }) => {
      if (inscrito) {
        const { error } = await supabase
          .from("matricula_modulos")
          .delete()
          .eq("matricula_id", matriculaId)
          .eq("modulo_id", moduloId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("matricula_modulos")
          .insert({ matricula_id: matriculaId, modulo_id: moduloId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inscricoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTurma = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Turma excluída");
      qc.invalidateQueries();
      navigate({ to: "/salas" });
    },
    onError: (e: Error) =>
      toast.error(e.message || "Não foi possível excluir. Verifique suas permissões."),
  });

  if (!sala) {
    return <p className="text-sm text-muted-foreground">Carregando sala…</p>;
  }


  return (
    <div className="space-y-6">
      <Link
        to="/salas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Salas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl">{sala.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {curso?.nome} · {sala.turno ?? "—"} · início {dataBR(sala.data_inicio)}
          </p>
          <p className="text-sm text-muted-foreground">
            Professor:{" "}
            {(perfis.data ?? []).find((p) => p.id === sala.professor_id)?.nome ?? "—"}
          </p>
          <p className="mt-1 font-mono text-sm">{sala.convite}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {podeEditar && !editando && (
              <Button variant="outline" size="sm" onClick={abrirEdicao}>
                <Pencil className="size-4" /> Editar turma
              </Button>
            )}
            {podeEditar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={excluirTurma.isPending}>
                    <Trash2 className="size-4" /> Excluir turma
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {sala.nome}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove a turma com seus módulos, aulas, matrículas e presenças. Não é
                      possível desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => excluirTurma.mutate()}>
                      Excluir definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

        </div>
        <QRCodeBox valor={`${origem}/matricula/${sala.convite}`} tamanho={104} />
      </div>

      {podeEditar && editando && (
        <Card className="gap-4 p-4">
          <h2 className="text-lg">Editar turma</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome-sala">Nome da turma</Label>
              <Input
                id="nome-sala"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Professor</Label>
              <Select
                value={form.professor_id || "nenhum"}
                onValueChange={(v) =>
                  setForm({ ...form, professor_id: v === "nenhum" ? "" : v })
                }
                disabled={!podeDefinirProfessor}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem professor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem professor</SelectItem>
                  {professores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!podeDefinirProfessor && (
                <p className="text-xs text-muted-foreground">
                  Você não tem permissão para definir o professor responsável.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="turno-sala">Turno</Label>
              <Input
                id="turno-sala"
                value={form.turno}
                onChange={(e) => setForm({ ...form, turno: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inicio-sala">Início</Label>
              <Input
                id="inicio-sala"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => salvarSala.mutate()}
              disabled={!form.nome.trim() || salvarSala.isPending}
            >
              {salvarSala.isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {podeEditar && (
        <Card className="gap-3 p-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-4 text-muted-foreground" />
            <h2 className="text-lg">Histórico de alterações</h2>
          </div>
          {auditoria.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (auditoria.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma alteração registrada nesta turma ainda.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {(auditoria.data ?? []).map((log) => {
                const autor = (perfis.data ?? []).find((p) => p.id === log.alterado_por);
                return (
                  <li key={log.id} className="space-y-1 px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{ROTULOS_CAMPO[log.campo] ?? log.campo}</span>
                      <span className="text-muted-foreground">
                        {formatarValor(log.campo, log.valor_antigo)} →{" "}
                        <span className="text-foreground">
                          {formatarValor(log.campo, log.valor_novo)}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.criado_em).toLocaleString("pt-BR")} ·{" "}
                      {autor?.nome ?? "Usuário removido"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}




      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">Professores da turma</h2>
            <p className="text-sm text-muted-foreground">
              Vários professores podem atuar na mesma turma; a aula define quem ministra.
            </p>
          </div>
          {podeDefinirProfessor && professoresDisponiveis.length > 0 && (
            <Select value="" onValueChange={(v) => adicionarProfessor.mutate(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Adicionar professor" />
              </SelectTrigger>
              <SelectContent>
                {professoresDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {equipePerfis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum professor vinculado a esta turma.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {equipePerfis.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                  {iniciais(p.nome)}
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{p.nome}</span>
                  <span className="text-xs text-muted-foreground">{p.email ?? "—"}</span>
                </span>
                {sala.professor_id === p.id && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Responsável</span>
                )}
                {podeDefinirProfessor && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removerProfessor.mutate(p.id)}
                  >
                    <Trash2 className="size-4" /> Remover
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg">Módulo em andamento</h2>
            <p className="text-sm text-muted-foreground">
              A turma trabalha um módulo por vez — troque quando avançar na ementa.
            </p>
          </div>
          {listaModulos.length > 0 && (
            <div className="space-y-1.5">
              <Label>Módulo da turma</Label>
              <Select
                value={moduloAtivo?.id ?? ""}
                onValueChange={(v) => definirModuloAtivo.mutate(v)}
                disabled={!podeEditar}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecionar módulo" />
                </SelectTrigger>
                <SelectContent>
                  {listaModulos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {moduloAtivo ? (
          <Card className="gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold">{moduloAtivo.nome}</h3>
                <p className="text-sm text-muted-foreground">
                  Ordem {moduloAtivo.ordem} · início {dataBR(moduloAtivo.data_inicio)}
                </p>
              </div>
              {podeEditar && !editandoModulo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormModulo({
                      nome: moduloAtivo.nome,
                      ordem: moduloAtivo.ordem,
                      data_inicio: moduloAtivo.data_inicio?.slice(0, 10) ?? "",
                    });
                    setEditandoModulo(true);
                  }}
                >
                  <Pencil className="size-4" /> Editar módulo
                </Button>
              )}
            </div>

            {editandoModulo && (
              <form
                className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[2fr_auto_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  salvarModulo.mutate({ moduloId: moduloAtivo.id, ...formModulo });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="mod-nome">Nome do módulo</Label>
                  <Input
                    id="mod-nome"
                    value={formModulo.nome}
                    onChange={(e) => setFormModulo({ ...formModulo, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mod-ordem">Ordem</Label>
                  <Input
                    id="mod-ordem"
                    type="number"
                    min={0}
                    className="w-24"
                    value={formModulo.ordem}
                    onChange={(e) =>
                      setFormModulo({ ...formModulo, ordem: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mod-inicio">Início</Label>
                  <Input
                    id="mod-inicio"
                    type="date"
                    className="w-44"
                    value={formModulo.data_inicio}
                    onChange={(e) => setFormModulo({ ...formModulo, data_inicio: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-3">
                  <Button type="submit" disabled={salvarModulo.isPending}>
                    Salvar módulo
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditandoModulo(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            <ul className="divide-y rounded-xl border">
              {aulasDoModulo.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap"
                >
                  <span className="text-sm text-muted-foreground">Aula {a.numero}</span>
                  <Input
                    defaultValue={a.titulo}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== a.titulo)
                        salvarTituloAula.mutate({ aulaId: a.id, titulo: e.target.value });
                    }}
                    className="min-w-40 flex-1"
                    disabled={!podeEditar}
                    aria-label={`Título da aula ${a.numero}`}
                  />

                  <Select
                    value={a.professor_id ?? "nenhum"}
                    onValueChange={(v) =>
                      definirProfessorAula.mutate({
                        aulaId: a.id,
                        professorId: v === "nenhum" ? null : v,
                      })
                    }
                    disabled={!podeDefinirProfessor}
                  >
                    <SelectTrigger className="h-9 w-48">
                      <SelectValue placeholder="Professor da aula" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem professor definido</SelectItem>
                      {(equipePerfis.length > 0 ? equipePerfis : professores).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    defaultValue={a.data?.slice(0, 10) ?? ""}
                    onBlur={(e) => salvarData.mutate({ aulaId: a.id, data: e.target.value })}
                    className="w-40"
                    disabled={!podeEditar}
                  />
                </li>
              ))}
              {aulasDoModulo.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-muted-foreground">
                  Nenhuma aula cadastrada neste módulo.
                </li>
              )}
            </ul>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta sala não tem módulos — cadastre a ementa do curso e crie a sala novamente.
          </p>
        )}
      </section>


      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">
            Alunos {moduloAtivo ? `· inscrição em ${moduloAtivo.nome}` : ""}
          </h2>
          {podeMatricular && (
            <Button size="sm" onClick={() => setAdicionando((v) => !v)}>
              <UserPlus className="size-4" /> Adicionar aluno
            </Button>
          )}
        </div>

        {podeMatricular && adicionando && (
          <Card className="gap-4 p-4">
            <h3 className="text-base font-semibold">Novo aluno na turma</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de matrícula</Label>
                <Select
                  value={novo.tipo}
                  onValueChange={(v) => setNovo({ ...novo, tipo: v as "individual" | "casal" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="casal">Casal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {novo.tipo === "casal" && (
                <div className="space-y-1.5">
                  <Label htmlFor="novo-casal">Nome do casal</Label>
                  <Input
                    id="novo-casal"
                    value={novo.nome_casal}
                    onChange={(e) => setNovo({ ...novo, nome_casal: e.target.value })}
                    placeholder="Ex.: João e Maria Silva"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="novo-nome">Nome do aluno</Label>
                <Input
                  id="novo-nome"
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-email">E-mail</Label>
                <Input
                  id="novo-email"
                  type="email"
                  value={novo.email}
                  onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-tel">Telefone</Label>
                <Input
                  id="novo-tel"
                  value={novo.telefone}
                  onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-senha">Senha provisória</Label>
                <Input
                  id="novo-senha"
                  value={novo.senha}
                  onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                  placeholder="mínimo 6 caracteres"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => adicionarAluno.mutate()}
                disabled={
                  adicionarAluno.isPending ||
                  novo.nome.trim().length < 2 ||
                  !novo.email.trim() ||
                  novo.senha.length < 6 ||
                  (novo.tipo === "casal" && novo.nome_casal.trim().length < 3)
                }
              >
                {adicionarAluno.isPending ? "Adicionando…" : "Adicionar à turma"}
              </Button>
              <Button variant="ghost" onClick={() => setAdicionando(false)}>
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        {podeMatricular && (
          <Card className="gap-4 p-4">
            <div>
              <h3 className="text-base font-semibold">Matricular aluno já cadastrado</h3>
              <p className="text-sm text-muted-foreground">
                Busque por nome, e-mail ou código e matricule direto nesta turma.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="busca-existente">Buscar aluno</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="busca-existente"
                    className="pl-9"
                    value={buscaExistente}
                    onChange={(e) => {
                      setBuscaExistente(e.target.value);
                      setExistente((v) => ({ ...v, aluno_id: "" }));
                    }}
                    placeholder="Nome, e-mail ou código"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de matrícula</Label>
                <Select
                  value={existente.tipo}
                  onValueChange={(v) =>
                    setExistente({ ...existente, tipo: v as "individual" | "casal" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="casal">Casal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {existente.tipo === "casal" && (
                <div className="space-y-1.5">
                  <Label htmlFor="existente-casal">Nome do casal</Label>
                  <Input
                    id="existente-casal"
                    value={existente.nome_casal}
                    onChange={(e) => setExistente({ ...existente, nome_casal: e.target.value })}
                    placeholder="Ex.: João e Maria Silva"
                  />
                </div>
              )}
            </div>

            {buscaExistente.trim().length > 0 && (
              <ul className="divide-y rounded-md border">
                {candidatos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setExistente((v) => ({ ...v, aluno_id: p.id }))}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted ${
                        existente.aluno_id === p.id ? "bg-muted" : ""
                      }`}
                    >
                      <span>
                        <span className="block font-medium">{p.nome}</span>
                        <span className="text-xs text-muted-foreground">{p.email ?? "—"}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span>
                    </button>
                  </li>
                ))}
                {candidatos.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum aluno disponível para esta busca (já matriculados não aparecem).
                  </li>
                )}
              </ul>
            )}

            <div>
              <Button
                onClick={() => matricularExistente.mutate()}
                disabled={
                  matricularExistente.isPending ||
                  !existente.aluno_id ||
                  (existente.tipo === "casal" && existente.nome_casal.trim().length < 3)
                }
              >
                {matricularExistente.isPending ? "Matriculando…" : "Matricular na turma"}
              </Button>
            </div>
          </Card>
        )}

        {podeMatricular && <ImportarAlunosCSV salaId={id} />}


        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={buscaMatriculados}
            onChange={(e) => setBuscaMatriculados(e.target.value)}
            placeholder="Buscar aluno matriculado"
            aria-label="Buscar aluno matriculado"
          />
        </div>

        <Card className="overflow-x-auto p-4">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Aluno</th>
                <th className="px-2 py-2 font-medium">Matrícula</th>

                {moduloAtivo && (
                  <th className="px-2 py-2 text-center font-medium">
                    {moduloAtivo.nome}
                  </th>
                )}
                {podeMatricular && <th className="px-2 py-2 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {matriculasVisiveis.map((mat) => {

                const perfil = (perfis.data ?? []).find((p) => p.id === mat.aluno_id);
                return (
                  <tr key={mat.id}>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                          {iniciais(perfil?.nome ?? "?")}
                        </span>
                        <span>
                          <span className="block font-medium">{perfil?.nome ?? "—"}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {perfil?.codigo}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {podeMatricular ? (
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={mat.tipo}
                            onValueChange={(v) =>
                              salvarTipo.mutate({
                                matriculaId: mat.id,
                                tipo: v as "individual" | "casal",
                                nomeCasal: mat.nome_casal,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="casal">Casal</SelectItem>
                            </SelectContent>
                          </Select>
                          {mat.tipo === "casal" && (
                            <Input
                              className="h-8 w-40"
                              placeholder="Nome do casal"
                              defaultValue={mat.nome_casal ?? ""}
                              onBlur={(e) =>
                                salvarTipo.mutate({
                                  matriculaId: mat.id,
                                  tipo: "casal",
                                  nomeCasal: e.target.value.trim() || null,
                                })
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs">
                          {mat.tipo === "casal" ? `Casal · ${mat.nome_casal ?? "—"}` : "Individual"}
                        </span>
                      )}
                    </td>
                    {moduloAtivo && (
                      (() => {
                        const inscrito = (inscricoes.data ?? []).some(
                          (i) => i.matricula_id === mat.id && i.modulo_id === moduloAtivo.id,
                        );
                        return (
                          <td className="px-2 py-2 text-center">
                            <Checkbox
                              checked={inscrito}
                              aria-label={`${perfil?.nome} em ${moduloAtivo.nome}`}
                              onCheckedChange={() =>
                                alternarInscricao.mutate({
                                  matriculaId: mat.id,
                                  moduloId: moduloAtivo.id,
                                  inscrito,
                                })
                              }
                            />
                          </td>
                        );
                      })()
                    )}
                    {podeMatricular && (
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setRemovendo({ id: mat.id, nome: perfil?.nome ?? "este aluno" })
                          }
                        >
                          <Trash2 className="size-4" /> Remover
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {matriculasVisiveis.length === 0 && (
                <tr>
                  <td
                    colSpan={(moduloAtivo ? 1 : 0) + (podeMatricular ? 3 : 2)}
                    className="py-3 text-muted-foreground"
                  >
                    {(matriculas.data ?? []).length === 0
                      ? "Nenhum aluno matriculado. Compartilhe o QR de convite."
                      : "Nenhum aluno encontrado para esta busca."}
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </Card>

        <AlertDialog open={!!removendo} onOpenChange={(o) => !o && setRemovendo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover inscrição</AlertDialogTitle>
              <AlertDialogDescription>
                {removendo?.nome} será removido desta turma, junto com as inscrições nos módulos. As
                presenças já registradas permanecem no histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (removendo) removerMatricula.mutate(removendo.id);
                }}
              >
                {removerMatricula.isPending ? "Removendo…" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

    </div>
  );
}
