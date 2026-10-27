const store = window.EtoStore;
const form = document.querySelector("#login-form");
const identifier = document.querySelector("#username");
const password = document.querySelector("#password");
const visibilityToggle = document.querySelector(".visibility-toggle");
const statusMessage = document.querySelector("#status-message");

const existing = store.getSession();
if (existing && store.load().users.some((u) => u.id === existing.userId && u.active)) {
  location.replace("app.html");
}

function showStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle("is-error", isError);
}

visibilityToggle.addEventListener("click", () => {
  const showing = password.type === "password";
  password.type = showing ? "text" : "password";
  visibilityToggle.setAttribute("aria-pressed", String(showing));
  visibilityToggle.setAttribute("aria-label", showing ? "Jelszó elrejtése" : "Jelszó megjelenítése");
});

document.querySelector("#forgot-link").addEventListener("click", () => {
  const id = identifier.value.trim();
  showStatus(
    id
      ? `A jelszó visszaállításához keresd az adminisztrátort ezzel az azonosítóval: ${id}.`
      : "Add meg a TalentX azonosítód, majd keresd az adminisztrátort a jelszó visszaállításához."
  );
});

document.querySelector("#support-link").addEventListener("click", (event) => {
  event.preventDefault();
  showStatus("Az adminisztrátor elérhetőségét a rendszer beállításakor kell megadni.");
});

document.querySelectorAll("[data-demo-id]").forEach((button) => {
  button.addEventListener("click", () => {
    identifier.value = button.dataset.demoId;
    password.value = store.DEMO_PASSWORD;
    form.requestSubmit();
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = store.authenticate(store.load(), identifier.value, password.value);
  if (result.error) {
    showStatus(result.error, true);
    return;
  }
  store.setSession(result.user.id, form.elements.remember.checked);
  location.href = "app.html";
});
