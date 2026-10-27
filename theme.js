// Light/dark mode: follows the system setting until the user picks one with a [data-theme-toggle] button.
(function () {
  const KEY = "eto-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const ICONS = {
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  };

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch (e) {
    // No storage: just follow the system setting.
  }

  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : media.matches);

  function sync() {
    const dark = isDark();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.innerHTML = dark ? ICONS.sun : ICONS.moon;
      button.setAttribute("aria-label", dark ? "Világos mód" : "Sötét mód");
      button.title = dark ? "Világos mód" : "Sötét mód";
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-theme-toggle]")) return;
    root.dataset.theme = isDark() ? "light" : "dark";
    try {
      localStorage.setItem(KEY, root.dataset.theme);
    } catch (e) {
      // Choice lasts for this page only.
    }
    sync();
  });
  document.addEventListener("DOMContentLoaded", sync);
  media.addEventListener("change", sync);
})();
