export type Hud = {
  setDebugVisible: (v: boolean) => void;
  toggleDebug: () => void;
  setStatus: (text: string) => void;
  setPrompt: (text: string) => void;
  flashRestore: () => void;
  hidePromptSoon: (afterS?: number) => void;
};

export function createHud(): Hud {
  const debug = document.getElementById('debug-panel');
  const status = document.getElementById('status');
  const prompt = document.getElementById('prompt');
  const flash = document.getElementById('restore-flash');
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let flashAnimation: Animation | undefined;
  const setDebugVisible = (v: boolean) => {
    document.body.classList.toggle('debug-on', v);
    debug?.classList.toggle('visible', v);
  };
  const toggleDebug = () => setDebugVisible(!document.body.classList.contains('debug-on'));
  addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.code !== 'Backquote' && event.key !== 'F1') return;
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (element?.isContentEditable || element?.closest('input, textarea, select')) return;
    event.preventDefault();
    if (!event.repeat) toggleDebug();
  });
  setDebugVisible(document.body.classList.contains('debug-on'));
  return {
    setDebugVisible,
    toggleDebug,
    setStatus(text) { if (status) status.textContent = text; },
    setPrompt(text) {
      clearTimeout(hideTimer);
      if (prompt) {
        prompt.textContent = text;
        prompt.style.opacity = text ? '0.72' : '0';
      }
    },
    hidePromptSoon(afterS = 5) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (prompt) prompt.style.opacity = '0'; }, Math.max(0, afterS) * 1000);
    },
    flashRestore() {
      flashAnimation?.cancel();
      flashAnimation = flash?.animate([
        { opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 },
      ], { duration: 1800, easing: 'ease-out' });
    },
  };
}
