/** Traduz erros da API de autenticação para mensagens claras em português. */
export function mensagemAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked")) {
    return "Senha muito fraca ou vazada em bases públicas. Use pelo menos 8 caracteres com letras, números e símbolos.";
  }
  if (m.includes("already been registered") || m.includes("already registered")) {
    return "Este e-mail já está cadastrado.";
  }
  if (m.includes("invalid email")) return "E-mail inválido.";
  if (m.includes("password should be at least")) {
    return "A senha é curta demais. Use pelo menos 6 caracteres.";
  }
  return msg;
}
