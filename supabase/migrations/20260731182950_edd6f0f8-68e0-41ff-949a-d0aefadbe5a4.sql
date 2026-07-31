DROP POLICY IF EXISTS salas_update ON public.salas;
CREATE POLICY salas_update ON public.salas FOR UPDATE TO authenticated
USING (public.sala_gerenciavel(id) AND public.pode(auth.uid(), 'turma_editar'))
WITH CHECK (public.sala_gerenciavel(id) AND public.pode(auth.uid(), 'turma_editar'));

DROP POLICY IF EXISTS matriculas_write ON public.matriculas;
CREATE POLICY matriculas_write ON public.matriculas FOR ALL TO authenticated
USING (public.sala_gerenciavel(sala_id) AND public.pode(auth.uid(), 'turma_matricular'))
WITH CHECK (public.sala_gerenciavel(sala_id) AND public.pode(auth.uid(), 'turma_matricular'));

CREATE OR REPLACE FUNCTION public.checar_definir_professor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.professor_id IS DISTINCT FROM OLD.professor_id
     AND NOT public.pode(auth.uid(), 'turma_definir_professor') THEN
    RAISE EXCEPTION 'Sem permissão para definir o professor da turma';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.checar_definir_professor() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_checar_definir_professor ON public.salas;
CREATE TRIGGER trg_checar_definir_professor
BEFORE UPDATE ON public.salas
FOR EACH ROW EXECUTE FUNCTION public.checar_definir_professor();