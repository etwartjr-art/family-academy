DROP POLICY IF EXISTS materiais_arquivos_select ON storage.objects;
CREATE POLICY materiais_arquivos_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materiais'
  AND EXISTS (
    SELECT 1 FROM public.materiais m
    WHERE m.storage_path = storage.objects.name
      AND (interno.sala_gerenciavel(interno.sala_da_aula(m.aula_id)) OR interno.aluno_ve_aula(m.aula_id))
  )
);