import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ListChecks } from "lucide-react";
import {
  listarNotificacoes,
  marcarLida,
  marcarTodasLidas,
  quandoBR,
} from "@/lib/notificacoes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Sino com as notificações de tarefas publicadas ou atualizadas. */
export function SinoNotificacoes({ className }: { className?: string }) {
  const qc = useQueryClient();
  const notificacoes = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listarNotificacoes(),
    refetchInterval: 60_000,
  });

  const lista = notificacoes.data ?? [];
  const naoLidas = lista.filter((n) => !n.lida_em).length;

  const lerUma = useMutation({
    mutationFn: marcarLida,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });
  const lerTodas = useMutation({
    mutationFn: marcarTodasLidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ""}`}
          className={cn(
            "relative rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            className,
          )}
        >
          <Bell className="size-5" />
          {naoLidas > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => lerTodas.mutate()}
              disabled={lerTodas.isPending}
            >
              Marcar todas
            </Button>
          )}
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {lista.map((n) => (
            <li key={n.id} className={cn("px-3 py-2.5", !n.lida_em && "bg-accent/40")}>
              <div className="flex items-start gap-2">
                <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.titulo}</p>
                  {n.mensagem && (
                    <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {quandoBR(n.criado_em)}
                    </span>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                      <Link to="/minhas-tarefas" onClick={() => !n.lida_em && lerUma.mutate(n.id)}>
                        Ver tarefas
                      </Link>
                    </Button>
                    {!n.lida_em && (
                      <button
                        className="text-xs text-muted-foreground underline"
                        onClick={() => lerUma.mutate(n.id)}
                      >
                        marcar lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {lista.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Sem notificações por enquanto.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
