// Mensaje de ánimo que aparece tras cada respuesta, mostrando cuánto tiempo tomó
// contestar. Se autocierra solo (barrita de progreso) y es el mismo componente
// para todos los modos de juego, para que "detener el contador de la siguiente
// pregunta" sea automático: nada arranca el siguiente ejercicio hasta que la
// promesa de show() se resuelve.
const TimeToast = (function () {
  const STORAGE_KEY = "encouragementMessagesEnabled";
  const DEFAULT_DURATION_MS = 1500;

  let enabled = true;
  let durationMs = DEFAULT_DURATION_MS;
  let container = null;
  let hideTimer = null;
  let activeResolve = null;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement("div");
    container.className = "time-toast hidden";
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.innerHTML =
      '<span class="time-toast-text"></span><div class="time-toast-bar"><div class="time-toast-bar-fill"></div></div>';
    container.addEventListener("click", skip);
    document.body.appendChild(container);
    return container;
  }

  function formatSeconds(seconds) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }

  function messageFor(seconds) {
    const s = formatSeconds(seconds);
    if (seconds <= 5) return { cls: "toast-great", text: `⚡ ¡Excelente! Tomaste ${s}` };
    if (seconds <= 12) return { cls: "toast-good", text: `🔥 ¡Muy bien! Lograste ${s}` };
    if (seconds <= 25) return { cls: "toast-ok", text: `👍 Nada mal, ${s}. Sigue practicando para ganar velocidad.` };
    return { cls: "toast-meh", text: `🙂 Te tomó ${s}. La práctica constante bajará ese tiempo.` };
  }

  // Se llama una vez por modo, al cargar la config del juego (no pisa lo que
  // el usuario ya haya elegido a través del interruptor, guardado en localStorage).
  function init(config) {
    const cfg = (config && config.encouragementMessages) || {};
    durationMs = cfg.durationMs > 0 ? cfg.durationMs : DEFAULT_DURATION_MS;

    const stored = localStorage.getItem(STORAGE_KEY);
    enabled = stored === null ? cfg.enabled !== false : stored === "1";
    syncToggleButtons();
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value) {
    enabled = value;
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    if (!value) skip();
    syncToggleButtons();
  }

  function syncToggleButtons() {
    document.querySelectorAll("[data-time-toast-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(enabled));
      btn.textContent = enabled ? "💬 Mensajes de ánimo: ON" : "💬 Mensajes de ánimo: OFF";
    });
  }

  function finish() {
    clearTimeout(hideTimer);
    hideTimer = null;
    const el = ensureContainer();
    el.classList.remove("visible");
    const resolve = activeResolve;
    activeResolve = null;
    if (resolve) resolve();
  }

  // Cierra el mensaje ya mismo (por ejemplo si el usuario pulsa "Siguiente"
  // antes de que termine la animación) y libera el avance inmediatamente.
  function skip() {
    if (!activeResolve) return;
    finish();
  }

  function show(seconds) {
    return new Promise((resolve) => {
      if (activeResolve) finish();

      if (!enabled) {
        resolve();
        return;
      }

      const el = ensureContainer();
      const { cls, text } = messageFor(seconds);

      activeResolve = resolve;
      el.querySelector(".time-toast-text").textContent = text;
      el.className = `time-toast ${cls}`;

      const fill = el.querySelector(".time-toast-bar-fill");
      fill.style.transitionDuration = "0ms";
      fill.style.width = "100%";

      // Forzar reflow para que la animación de entrada y la barra reinicien
      // cada vez, incluso si se muestra un mensaje justo después de otro.
      void el.offsetWidth;

      el.classList.add("visible");
      fill.style.transitionDuration = `${durationMs}ms`;
      requestAnimationFrame(() => {
        fill.style.width = "0%";
      });

      hideTimer = setTimeout(finish, durationMs);
    });
  }

  return { init, show, skip, isEnabled, setEnabled };
})();
