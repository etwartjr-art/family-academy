DROP POLICY IF EXISTS salas_insert ON public.salas;
CREATE POLICY salas_insert ON public.salas FOR INSERT TO authenticated
WITH CHECK (
  public.e_coordenador()
  OR (public.tem_papel(auth.uid(), 'professor') AND professor_id = auth.uid())
);

DROP POLICY IF EXISTS salas_delete ON public.salas;
CREATE POLICY salas_delete ON public.salas FOR DELETE TO authenticated
USING (public.sala_gerenciavel(id));