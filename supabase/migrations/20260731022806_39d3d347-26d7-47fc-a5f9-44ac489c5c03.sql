REVOKE EXECUTE ON FUNCTION public.gerar_codigo(int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tem_papel(uuid, public.papel_app) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.e_coordenador() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.e_professor_da_sala(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.esta_matriculado(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sala_visivel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sala_gerenciavel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sala_da_aula(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sala_do_modulo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.aluno_visivel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.matricular_por_convite(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sala_por_convite(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.criar_aulas_do_modulo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.aplicar_ementa_na_sala() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.inscrever_em_modulos() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.tem_papel(uuid, public.papel_app) TO authenticated;
GRANT EXECUTE ON FUNCTION public.e_coordenador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.e_professor_da_sala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.esta_matriculado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_visivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_gerenciavel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_da_aula(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_do_modulo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_visivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matricular_por_convite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid, text, uuid, public.metodo_presenca, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sala_por_convite(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_papel public.papel_app;
BEGIN
  INSERT INTO public.perfis (id, nome, email, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.papeis_usuario WHERE papel = 'coordenador') THEN
    v_papel := 'coordenador';
  ELSE
    v_papel := COALESCE((NEW.raw_user_meta_data->>'papel')::public.papel_app, 'aluno');
    IF v_papel = 'coordenador' THEN v_papel := 'aluno'; END IF;
  END IF;

  INSERT INTO public.papeis_usuario (user_id, papel) VALUES (NEW.id, v_papel)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;