import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataBR, listarCursos, listarModulos, listarSalas } from "@/lib/api";
import {
  abrirMaterial,
  excluirMaterial,
  formatarTamanho,
  listarMateriais,
  publicarMaterial,
  rotuloTipo,
  TIPOS_MATERIAL,
  type Material,
  type TipoMaterial,
} from "@/lib/materiais";
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
import { toast } from "sonner";
import { ArrowLeft, Download, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/materiais/$aulaId")({
  head: () => ({
    meta: [
      { title: "Materiais da aula — Escola de Finanças Academy" },
      {
        name: "description",
        content: "Publique e organize os materiais de estudo de uma aula da turma.",
      },
      { property: "og:title", content: "Materiais da aula — Escola de Finanças Academy" },
      { property: "og:description", content: "Publicação de materiais de estudo por aula." },
    ],
  }),
  component: PainelAula,
});

function PainelAula() {
  const { aulaId } = Route.useParams();
  const qc = useQueryClient();

  const aula = useQuery({
    queryKey: ["aula", aulaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aulas")
        .select("*")
        .eq("id", aulaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });
  const salas = useQuery({ queryKey: ["salas"], queryFn: listarSalas });
  const cursos = useQuery({ queryKey: ["cursos"], queryFn: listarCursos });
  const materiais = useQuery({
    queryKey: ["materiais", aulaId],
    queryFn: () => listarMateriais([aulaId]),
  });

  const modulo = (modulos.data ?? []).find((m) => m.id === aula.data?.modulo_id) ?? null;
  const sala = (salas.data ?? []).find((s) => s.id === modulo?.sala_id) ?? null;
  const curso = (cursos.data ?? []).find((c) => c.id === sala?.curso_id) ?? null;

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoMaterial>("ebook");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  const publicar = useMutation({
    mutationFn: () =>
      publicarMaterial({ aulaId, titulo: titulo.trim(), tipo, url, arquivo }),
    onSuccess: () => {
      setTitulo("");
      setUrl("");
      setArquivo(null);
      toast.success("Material publicado");
      qc.invalidateQueries({ queryKey: ["materiais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (m: Material) => excluirMaterial(m),
    onSuccess: () => {
      toast.success("Material excluído");
      qc.invalidateQueries({ queryKey: ["materiais"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixar = useMutation({
    mutationFn: (m: Material) => abrirMaterial(m),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/materiais">
          <ArrowLeft className="size-4" /> Materiais
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl">
          Aula {aula.data?.numero} · {aula.data?.titulo ?? "…"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {curso?.nome ?? "—"} · {sala?.nome ?? "—"} · {modulo?.nome ?? "—"} ·{" "}
          {dataBR(aula.data?.data)}
        </p>
      </div>

      <Card className="gap-3 p-4">
        <h2 className="text-lg">Publicar material</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (titulo.trim().length < 3) return toast.error("Informe o título do material");
            if (!arquivo && !url.trim())
              return toast.error("Informe um link externo ou escolha um arquivo");
            publicar.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Apostila do módulo 1"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMaterial)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MATERIAL.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="url">
              Link externo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
            <p className="text-xs text-muted-foreground">
              Você pode enviar um arquivo, informar um link, ou os dois.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arquivo">Ou enviar arquivo</Label>
            <Input
              id="arquivo"
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={publicar.isPending}>
              <Upload className="size-4" /> {publicar.isPending ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="gap-3 p-4">
        <h2 className="text-lg">Biblioteca da aula ({materiais.data?.length ?? 0})</h2>
        <ul className="divide-y rounded-xl border">
          {(materiais.data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {rotuloTipo(m.tipo)} ·{" "}
                  {m.storage_path
                    ? `${m.nome_arquivo} · ${formatarTamanho(m.tamanho)}`
                    : "link externo"}{" "}
                  · {dataBR(m.criado_em)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => baixar.mutate(m)}>
                <Download className="size-4" /> Baixar
              </Button>
              <button
                onClick={() => remover.mutate(m)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Excluir ${m.titulo}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {(materiais.data ?? []).length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              Nenhum material publicado nesta aula.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
