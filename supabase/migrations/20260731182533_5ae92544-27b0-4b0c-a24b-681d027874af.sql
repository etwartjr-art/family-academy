CREATE TABLE public.salas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_antigo text,
  valor_novo text,
  alterado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX salas_auditoria_sala_idx ON public.salas_auditoria (sala_id, criado_em DESC);

GRANT SELECT ON public.salas_auditoria TO authenticated;
GRANT ALL ON public.salas_auditoria TO service_role;

ALTER TABLE public.salas_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY salas_auditoria_select ON public.salas_auditoria FOR SELECT TO authenticated
USING (public.sala_gerenciavel(sala_id));

CREATE OR REPLACE FUNCTION public.registrar_auditoria_sala()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    INSERT INTO public.salas_auditoria (sala_id, campo, valor_antigo, valor_novo, alterado_por)
    VALUES (NEW.id, 'nome', OLD.nome, NEW.nome, auth.uid());
  END IF;
  IF NEW.professor_id IS DISTINCT FROM OLD.professor_id THEN
    INSERT INTO public.salas_auditoria (sala_id, campo, valor_antigo, valor_novo, alterado_por)
    VALUES (NEW.id, 'professor',
      (SELECT nome FROM public.perfis WHERE id = OLD.professor_id),
      (SELECT nome FROM public.perfis WHERE id = NEW.professor_id),
      auth.uid());
  END IF;
  IF NEW.turno IS DISTINCT FROM OLD.turno THEN
    INSERT INTO public.salas_auditoria (sala_id, campo, valor_antigo, valor_novo, alterado_por)
    VALUES (NEW.id, 'turno', OLD.turno, NEW.turno, auth.uid());
  END IF;
  IF NEW.data_inicio IS DISTINCT FROM OLD.data_inicio THEN
    INSERT INTO public.salas_auditoria (sala_id, campo, valor_antigo, valor_novo, alterado_por)
    VALUES (NEW.id, 'data_inicio', OLD.data_inicio::text, NEW.data_inicio::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_auditoria_sala() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_auditoria_sala ON public.salas;
CREATE TRIGGER trg_auditoria_sala
AFTER UPDATE ON public.salas
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_sala();