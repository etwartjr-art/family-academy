import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fa-pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function AvisoInstalarApp() {
  const [visivel, setVisivel] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [modoIos, setModoIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisivel(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      setModoIos(true);
      timer = setTimeout(() => setVisivel(true), 2500);
    }

    const onInstalled = () => setVisivel(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function fechar() {
    setVisivel(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function instalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setVisivel(false);
    else fechar();
  }

  if (!visivel) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 sm:p-0">
      <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Instalar Family Academy
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {modoIos ? (
                <>
                  Toque em <Share className="inline h-3 w-3" /> Compartilhar e escolha{" "}
                  <strong>Adicionar à Tela de Início</strong>.
                </>
              ) : (
                "Adicione o app à tela inicial para abrir mais rápido e usar offline."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar aviso de instalação"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!modoIos && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={instalar}>
              <Download className="mr-2 h-4 w-4" />
              Adicionar à tela inicial
            </Button>
            <Button size="sm" variant="ghost" onClick={fechar}>
              Agora não
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
