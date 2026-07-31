CREATE POLICY materiais_arquivos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'materiais'
    AND EXISTS (
      SELECT 1 FROM public.materiais m WHERE m.storage_path = storage.objects.name
    )
  );

CREATE POLICY materiais_arquivos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais');

CREATE POLICY materiais_arquivos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'materiais'
    AND NOT EXISTS (
      SELECT 1 FROM public.materiais m WHERE m.storage_path = storage.objects.name
    )
  );
