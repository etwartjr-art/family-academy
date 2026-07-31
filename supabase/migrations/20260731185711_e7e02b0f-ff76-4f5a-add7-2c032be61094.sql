CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Bootstrap: o primeiro usuário do sistema é coordenador.
  -- Fora disso, NUNCA confiamos no papel enviado pelo cliente: sempre 'aluno'.
  -- Professor/coordenador só via ações server-side de coordenador.
  IF NOT EXISTS (SELECT 1 FROM public.papeis_usuario WHERE papel = 'coordenador') THEN
    v_papel := 'coordenador';
  ELSE
    v_papel := 'aluno';
  END IF;

  INSERT INTO public.papeis_usuario (user_id, papel) VALUES (NEW.id, v_papel)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.checar_definir_professor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_auditoria_sala() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_ementa_na_sala() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_aulas_do_modulo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inscrever_em_modulos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gerar_codigo(integer) FROM PUBLIC, anon, authenticated;