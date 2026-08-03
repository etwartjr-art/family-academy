/** Senha padrão entregue ao aluno/usuário no cadastro. */
export const SENHA_PADRAO = "123456";

/** Regras mínimas para a nova senha definida pelo próprio usuário. */
export const SENHA_MINIMA = 6;

export function ehSenhaPadrao(senha: string) {
  return senha === SENHA_PADRAO;
}
