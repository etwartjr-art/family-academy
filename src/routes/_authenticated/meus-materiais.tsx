import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { dataBR, listarAulas, listarModulos } from "@/lib/api";
import {
  abrirMaterial,
  formatarTamanho,
  listarMateriais,
  rotuloTipo,
  type Material,
} from "@/lib/materiais";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meus-materiais")({
  head: () => ({
    meta: [
      { title: "Meus materiais — Escola de Finanças" },
      {
        name: "description",
        content: "Baixe os materiais de estudo das aulas dos módulos em que você está inscrito.",
      },
      { property: "og:title", content: "Meus materiais — Escola de Finanças" },
      { property: "og:description", content: "Materiais de estudo dos seus módulos e aulas." },
    ],
  }),
  component: MeusMateriais,
});

function MeusMateriais() {
  const materiais = useQuery({ queryKey: ["materiais"], queryFn: () => listarMateriais() });
  const aulas = useQuery({ queryKey: ["aulas-todas"], queryFn: () => listarAulas() });
  const modulos = useQuery({ queryKey: ["modulos"], queryFn: () => listarModulos() });

  const baixar = useMutation({
    mutationFn: (m: Material) => abrirMaterial(m),
    onError: (e: Error) => toast.error(e.message),
  });

  const listaAulas = aulas.data ?? [];
  const listaModulos = (modulos.data ?? []).filter((mod) =>
    (materiais.data ?? []).some((mat) => {
      const aula = listaAulas.find((a) => a.id === mat.aula_id);
      return aula?.modulo_id === mod.id;
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Meus materiais</h1>
        <p className="text-sm text-muted-foreground">
          Materiais das aulas dos módulos em que você está inscrito.
        </p>
      </div>

      {listaModulos.map((mod) => {
        const aulasDoModulo = listaAulas
          .filter((a) => a.modulo_id === mod.id)
          .sort((a, b) => a.numero - b.numero);
        return (
          <Card key={mod.id} className="gap-3 p-4">
            <h2 className="text-lg">{mod.nome}</h2>
            {aulasDoModulo.map((a) => {
              const doAula = (materiais.data ?? []).filter((m) => m.aula_id === a.id);
              if (doAula.length === 0) return null;
              return (
                <div key={a.id} className="rounded-xl border">
                  <div className="border-b px-3 py-2 text-sm font-semibold">
                    Aula {a.numero} · {a.titulo}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {dataBR(a.data)}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {doAula.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{m.titulo}</div>
                          <div className="text-xs text-muted-foreground">
                            {rotuloTipo(m.tipo)}
                            {m.storage_path
                              ? ` · ${m.nome_arquivo} · ${formatarTamanho(m.tamanho)}`
                              : " · link externo"}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => baixar.mutate(m)}>
                          <Download className="size-4" /> Baixar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Card>
        );
      })}

      {(materiais.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum material disponível nos seus módulos por enquanto.
        </p>
      )}
    </div>
  );
}
