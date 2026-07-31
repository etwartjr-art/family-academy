import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataBR, iniciais } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Eye, Mail, Phone, Trash2 } from "lucide-react";

type Props = {
  matricula: {
    id: string;
    aluno_id: string;
    tipo: "individual" | "casal";
    nome_casal: string | null;
    status?: string | null;
    criado_em?: string | null;
  };
  perfil?: {
    nome: string;
    codigo: string;
    email?: string | null;
    telefone?: string | null;
    criado_em?: string | null;
  } | null;
  salaNome?: string | null;
  cursoNome?: string | null;
  modulosInscritos: string[];
  aulaIds: string[];
  podeRemover?: boolean;
  onRemover?: () => void;
};

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}

export function DetalhesAluno({
  matricula,
  perfil,
  salaNome,
  cursoNome,
  modulosInscritos,
  aulaIds,
  podeRemover,
  onRemover,
}: Props) {
  const presencas = useQuery({
    queryKey: ["presencas-aluno", matricula.aluno_id, aulaIds],
    queryFn: async () => {
      if (aulaIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("presencas")
        .select("id", { count: "exact", head: true })
        .eq("aluno_id", matricula.aluno_id)
        .in("aula_id", aulaIds);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: aulaIds.length > 0,
  });

  const total = aulaIds.length;
  const presentes = presencas.data ?? 0;
  const frequencia = total > 0 ? Math.round((presentes / total) * 100) : 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <Eye className="size-4" /> Detalhes
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
              {iniciais(perfil?.nome ?? "?")}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{perfil?.nome ?? "Aluno"}</span>
              <span className="block font-mono text-xs font-normal text-muted-foreground">
                {perfil?.codigo ?? "—"}
              </span>
            </span>
          </SheetTitle>
          <SheetDescription>
            Revise os dados do aluno antes de alterar ou remover a inscrição.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Contato</p>
            <p className="flex items-center gap-2 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              {perfil?.email || "Sem e-mail"}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground" />
              {perfil?.telefone || "Sem telefone"}
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Matrícula</p>
            <Linha rotulo="Turma" valor={salaNome ?? "—"} />
            <Linha rotulo="Curso" valor={cursoNome ?? "—"} />
            <Linha
              rotulo="Tipo"
              valor={
                matricula.tipo === "casal"
                  ? `Casal · ${matricula.nome_casal ?? "—"}`
                  : "Individual"
              }
            />
            <Linha
              rotulo="Status"
              valor={
                <Badge variant={matricula.status === "ativa" ? "default" : "secondary"}>
                  {matricula.status ?? "—"}
                </Badge>
              }
            />
            <Linha rotulo="Matriculado em" valor={dataBR(matricula.criado_em)} />
            <Linha rotulo="Cadastro do perfil" valor={dataBR(perfil?.criado_em)} />
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Frequência no módulo
            </p>
            <p className="text-2xl font-bold">
              {frequencia}%
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {presentes} de {total} aulas
              </span>
            </p>
            {total > 0 && frequencia < 75 && (
              <p className="mt-1 text-xs text-destructive">Abaixo da frequência mínima (75%).</p>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Módulos inscritos
            </p>
            {modulosInscritos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum módulo inscrito.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {modulosInscritos.map((nome) => (
                  <Badge key={nome} variant="secondary">
                    {nome}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {podeRemover && onRemover && (
            <>
              <Separator />
              <Button variant="destructive" className="w-full" onClick={onRemover}>
                <Trash2 className="size-4" /> Remover inscrição
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
