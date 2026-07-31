ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS modulo_ativo_id uuid REFERENCES public.modulos(id) ON DELETE SET NULL;
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sala_professores (
  sala_id uuid NOT NULL REFERENCES public.salas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sala_id, professor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sala_professores TO authenticated;
GRANT ALL ON public.sala_professores TO service_role;
ALTER TABLE public.sala_professores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sala_professores_select ON public.sala_professores;
CREATE POLICY sala_professores_select ON public.sala_professores
  FOR SELECT TO authenticated USING (public.sala_visivel(sala_id));

DROP POLICY IF EXISTS sala_professores_write ON public.sala_professores;
CREATE POLICY sala_professores_write ON public.sala_professores
  FOR ALL TO authenticated
  USING (public.sala_gerenciavel(sala_id) AND public.pode(auth.uid(), 'turma_definir_professor'))
  WITH CHECK (public.sala_gerenciavel(sala_id) AND public.pode(auth.uid(), 'turma_definir_professor'));

CREATE OR REPLACE FUNCTION public.e_professor_da_sala(_sala_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.salas s WHERE s.id = _sala_id AND s.professor_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.sala_professores sp WHERE sp.sala_id = _sala_id AND sp.professor_id = auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.e_professor_da_sala(uuid) FROM anon;

INSERT INTO public.sala_professores (sala_id, professor_id)
SELECT id, professor_id FROM public.salas WHERE professor_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.salas s
SET modulo_ativo_id = (
  SELECT m.id FROM public.modulos m WHERE m.sala_id = s.id ORDER BY m.ordem, m.nome LIMIT 1
)
WHERE s.modulo_ativo_id IS NULL;