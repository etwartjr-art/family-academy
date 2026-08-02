CREATE TYPE public.tipo_notificacao AS ENUM ('tarefa_publicada', 'tarefa_atualizada');

CREATE TABLE public.notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  tipo public.tipo_notificacao NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE,
  lida_em timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX notificacoes_usuario_idx ON public.notificacoes (usuario_id, criado_em DESC);

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacoes_select ON public.notificacoes
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY notificacoes_update ON public.notificacoes
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notificar_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.tipo_notificacao;
  v_titulo text;
  v_aula record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tipo := 'tarefa_publicada';
    v_titulo := 'Nova tarefa publicada';
  ELSE
    IF NEW.titulo IS NOT DISTINCT FROM OLD.titulo
       AND NEW.instrucoes IS NOT DISTINCT FROM OLD.instrucoes
       AND NEW.link IS NOT DISTINCT FROM OLD.link THEN
      RETURN NEW;
    END IF;
    v_tipo := 'tarefa_atualizada';
    v_titulo := 'Tarefa atualizada';
  END IF;

  SELECT a.id, a.numero, a.titulo AS aula_titulo, m.id AS modulo_id, m.nome AS modulo_nome
    INTO v_aula
  FROM public.aulas a
  JOIN public.modulos m ON m.id = a.modulo_id
  WHERE a.id = NEW.aula_id;

  IF v_aula.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, aula_id, tarefa_id)
  SELECT DISTINCT mt.aluno_id, v_tipo, v_titulo,
         NEW.titulo || ' · ' || v_aula.modulo_nome || ' · Aula ' || v_aula.numero || ' — ' || v_aula.aula_titulo,
         NEW.aula_id, NEW.id
  FROM public.matricula_modulos mm
  JOIN public.matriculas mt ON mt.id = mm.matricula_id
  WHERE mm.modulo_id = v_aula.modulo_id AND mt.status = 'ativa';

  RETURN NEW;
END;
$$;

CREATE TRIGGER tarefas_notificar_insert
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.notificar_tarefa();

CREATE TRIGGER tarefas_notificar_update
AFTER UPDATE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.notificar_tarefa();