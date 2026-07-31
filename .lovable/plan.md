## Family Academy — plataforma de aulas com chamada por QR

Construção completa (fases 1 a 5) do sistema descrito no brief, com o visual do protótipo HTML anexo, em português.

### Decisões confirmadas
- Matrícula por QR entra **direto como ativa**.
- Sem geolocalização; aluno pode estar em mais de uma turma; **75%** de frequência mínima (alerta em vermelho abaixo disso).
- Login por **e-mail e senha**.

### Identidade visual
Azul tinta `#0A2A66`, fundo escuro de navegação `#061634`, vermelho `#E11D2E` (falta/alerta), verde `#0E7C5A` (presença), papel `#EEF1F8`, linhas `#D5DCEC`. Títulos em Bricolage Grotesque, texto em Public Sans, códigos em JetBrains Mono. Mobile-first, estilo diário de classe digital, com barra lateral no desktop e navegação inferior no celular — igual ao protótipo.

### Backend (Lovable Cloud)
Tabelas: `perfis`, `papeis_usuario`, `cursos`, `curso_modulos`, `salas`, `modulos`, `aulas`, `matriculas`, `matricula_modulos`, `sessoes_chamada`, `presencas`.

Regras no banco:
- Papéis em tabela separada (`papeis_usuario`) com função `tem_papel()` SECURITY DEFINER — nunca no perfil.
- Trigger: ao criar módulo, gerar automaticamente as 5 aulas com datas semanais.
- Função: ao criar sala, copiar a ementa do curso para módulos (encadeando datas de 5 em 5 semanas).
- Função: ao criar matrícula, inscrever o aluno em todos os módulos da sala.
- Código pessoal de 6 caracteres (alfabeto sem O, 0, I, 1) e convite de sala `SALA-XXXXXX`, ambos gerados no banco.
- RLS: coordenador vê tudo; professor só as salas onde é responsável; aluno só o próprio perfil, matrículas, aulas e presenças.
- Registro de presença por função `SECURITY DEFINER` que valida existência do aluno, inscrição no módulo da aula, janela da sessão e duplicidade.
- Seed: curso "Escola de Finanças" com os 3 módulos da ementa.

### Telas
| Rota | Quem | Conteúdo |
| --- | --- | --- |
| `/` | público | entrada: login por e-mail/senha + caminho "sou aluno novo" com código de convite |
| `/matricula/:convite` | público | cadastro do aluno pela sala identificada; gera código pessoal e matrícula ativa |
| `/painel` | todos | métricas (cursos, salas, alunos, presença média), aulas sem chamada, atalhos |
| `/cursos` | coordenador | criar curso e editar ementa de módulos |
| `/salas` | coord./prof. | salas agrupadas por curso, filtro, criação, QR de convite |
| `/salas/:id` | coord./prof. | módulos com as 5 aulas (título e data editáveis), inscritos por módulo, alunos |
| `/chamada` | coord./prof. | curso > sala > módulo > aula; QR da sessão, leitor de câmera, código digitado, grade com toque para marcar |
| `/frequencia` | todos | grade aluno × 5 aulas por módulo (P/F/–), percentual, alerta <75%, exportar CSV |
| `/carteirinhas` | todos | QR por aluno, layout de impressão |
| `/meu-painel` | aluno | carteirinha em destaque, meus módulos, minha frequência |
| `/pessoas` | coordenador | cadastro de professores e alunos |

### Fluxos de QR
- **Modo A (padrão):** professor lê a carteirinha do aluno — payload `FA|ALUNO|{codigo}`.
- **Modo B:** professor projeta o QR da sessão (`/chamada/{codigo_sessao}`, validade de 15 min com botão de renovar); o aluno logado confirma a própria presença.
- Recusa em vermelho, dizendo nome do aluno e módulo, quando o aluno não está inscrito naquele módulo.
- Sempre disponíveis: código digitado e marcação manual tocando no nome.

### Detalhes técnicos
- TanStack Start + React + Tailwind + shadcn/ui; rotas protegidas sob `_authenticated`.
- `qrcode.react` para gerar QR, `html5-qrcode` para leitura pela câmera.
- Toda a lógica sensível (abrir sessão, registrar presença, criar matrícula pública) em server functions chamando funções do banco; validação com zod.
- Exportação CSV nativa; PWA (manifest + ícones) para instalar no celular do professor.

### Ordem de execução
1. Ativar Lovable Cloud, migração completa (tabelas, grants, RLS, triggers, funções, seed do curso).
2. Design system e layout (cores, fontes, barra lateral/navegação inferior).
3. Autenticação, papéis e cadastro de pessoas.
4. Cursos, salas, módulos e aulas.
5. Matrícula por QR (rota pública) e carteirinhas.
6. Chamada (sessão, câmera, código, manual).
7. Frequência, CSV e alerta de 75%.
8. Painel do aluno, PWA e SEO das rotas públicas.
