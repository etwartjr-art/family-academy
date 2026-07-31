import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  GraduationCap,

  Users,
  BookOpen,
  School,
  ScanLine,
  ClipboardCheck,
  IdCard,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/useSessao";
import { usePermissoes } from "@/hooks/usePermissoes";
import type { ChaveAcesso } from "@/lib/permissoes";
import { iniciais } from "@/lib/api";
import { cn } from "@/lib/utils";

export type Item = {
  para: string;
  rotulo: string;
  icone: typeof Users;
  chave: ChaveAcesso;
};

export const MENU: Item[] = [

  { para: "/painel", rotulo: "Painel", icone: LayoutDashboard, chave: "painel" },
  { para: "/meu-painel", rotulo: "Minha carteirinha", icone: IdCard, chave: "meu_painel" },
  { para: "/cursos", rotulo: "Cursos", icone: BookOpen, chave: "cursos" },
  { para: "/salas", rotulo: "Salas", icone: School, chave: "salas" },
  { para: "/alunos", rotulo: "Alunos", icone: GraduationCap, chave: "alunos" },
  { para: "/chamada", rotulo: "Chamada", icone: ScanLine, chave: "chamada" },
  { para: "/frequencia", rotulo: "Frequência", icone: ClipboardCheck, chave: "frequencia" },
  { para: "/carteirinhas", rotulo: "Carteirinhas", icone: IdCard, chave: "carteirinhas" },
  { para: "/pessoas", rotulo: "Pessoas", icone: Users, chave: "pessoas" },
  { para: "/acessos", rotulo: "Níveis de acesso", icone: ShieldCheck, chave: "acessos" },
];

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
      <div className="grid size-9 place-items-center rounded-[10px] bg-sidebar-primary font-display text-[15px] font-extrabold text-sidebar-primary-foreground">
        FA
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-extrabold text-white">Family Academy</div>
        <div className="text-[11px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
          Escola de Finanças
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: sessao } = useSessao();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  const papel = sessao?.papel ?? "aluno";
  const { pode } = usePermissoes();
  const itens = MENU.filter((i) => pode(i.chave));

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const navegacao = (
    <nav className="flex flex-col gap-1">
      {itens.map((item) => {
        const ativo = caminho === item.para;
        return (
          <Link
            key={item.para}
            to={item.para}
            onClick={() => setAberto(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white",
              ativo && "bg-sidebar-accent font-semibold text-white",
            )}
          >
            <item.icone className="size-4 shrink-0" />
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <FundoMarca />

      {/* barra lateral — desktop */}
      <aside className="sem-impressao sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col justify-between bg-sidebar p-4 md:flex">
        <div>
          <Marca />
          {navegacao}
        </div>
        <button
          onClick={sair}
          className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </aside>

      {/* topo — mobile */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sem-impressao sticky top-0 z-30 flex items-center justify-between bg-sidebar px-3 py-2 md:hidden">
          <Marca />
          <button
            aria-label="Abrir menu"
            onClick={() => setAberto((v) => !v)}
            className="rounded-lg p-2 text-white"
          >
            {aberto ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>

        {aberto && (
          <div className="sem-impressao sticky top-[57px] z-30 bg-sidebar px-3 pb-3 md:hidden">
            {navegacao}
            <button
              onClick={sair}
              className="mt-1 flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-sidebar-foreground"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-16 md:p-7">{children}</main>

        <footer className="sem-impressao px-4 pb-4 text-center text-xs text-muted-foreground">
          {sessao?.perfil ? (
            <span>
              {iniciais(sessao.perfil.nome)} · {sessao.perfil.nome} ·{" "}
              <span className="capitalize">{papel}</span>
            </span>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
