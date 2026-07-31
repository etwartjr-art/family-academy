import logoAsset from "@/assets/logo-family-academy.png.asset.json";

/**
 * Marca d'água fixa da Family Academy usada como fundo do sistema
 * e da tela inicial. Puramente decorativa.
 */
export function FundoMarca() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 select-none bg-background"
      style={{
        backgroundImage: `url(${logoAsset.url})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "min(78vw, 760px) auto",
        opacity: 0.06,
      }}
    />
  );
}
