import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém as porcentagens de presença atualizadas: sempre que uma presença é
 * registrada ou removida (por qualquer usuário), invalida as consultas de
 * presença para que a tela recalcule automaticamente.
 */
export function useRealtimePresencas() {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidar = () => {
      qc.invalidateQueries({ queryKey: ["presencas"] });
      qc.invalidateQueries({ queryKey: ["presencas-aula"] });
      qc.invalidateQueries({ queryKey: ["presencas-modulo"] });
    };

    const canal = supabase
      .channel("presencas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "presencas" }, invalidar)
      .subscribe();

    // Também revalida ao voltar para a aba, caso o socket tenha caído.
    window.addEventListener("focus", invalidar);

    return () => {
      window.removeEventListener("focus", invalidar);
      supabase.removeChannel(canal);
    };
  }, [qc]);
}
