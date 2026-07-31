import logoAsset from "@/assets/logo-family-academy.png.asset.json";

/**
 * Marca d'água fixa da Family Academy usada como fundo do sistema
 * e da tela inicial. Puramente decorativa.
 *
 * A logo original é preta: em fundos escuros ela é invertida para branco.
 */
export function FundoMarca({ tom = "claro" }: { tom?: "claro" | "escuro" }) {
  const escuro = tom === "escuro";
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none"
      style={{
        backgroundImage: `url(${logoAsset.url})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "min(80vw, 780px) auto",
        opacity: escuro ? 0.12 : 0.07,
        filter: escuro ? "invert(1)" : undefined,
      }}
    />
  );
}
