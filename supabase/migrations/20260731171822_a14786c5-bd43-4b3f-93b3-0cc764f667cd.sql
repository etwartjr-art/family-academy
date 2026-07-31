DELETE FROM public.papeis_usuario WHERE user_id = '0a628ddb-17e7-4edb-926e-6007814afef1';
INSERT INTO public.papeis_usuario (user_id, papel) VALUES ('0a628ddb-17e7-4edb-926e-6007814afef1', 'coordenador') ON CONFLICT DO NOTHING;
UPDATE public.perfis SET nome = 'Marcelo' WHERE id = '0a628ddb-17e7-4edb-926e-6007814afef1';