const store = window.EtoStore;
const MIN = store.MIN;
const app = document.querySelector("#app");
const dialog = document.querySelector("#feedback-dialog");
const toastEl = document.querySelector("#toast");
const XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

// Face shapes for the 0–4 mood scale (eye radii + mouth curve), plus the dialog tint.
const FACES = [
  { bg: "#fde4dc", fg: "#d9503a", eye: [15, 15], mouth: "M78 112 Q100 86 122 112" },
  { bg: "#ebe6fc", fg: "#7b5ce5", eye: [22, 11], mouth: "M80 110 Q100 96 120 110" },
  { bg: "#fbf0d3", fg: "#c08a1e", eye: [17, 17], mouth: "M80 106 Q100 106 120 106" },
  { bg: "#d4eff0", fg: "#2b7a80", eye: [28, 22], mouth: "M84 102 Q100 114 116 102" },
  { bg: "#d8efdb", fg: "#2f7a3f", eye: [30, 30], mouth: "M78 100 Q100 126 122 100" },
];

let state = store.load();
const session = store.getSession();
const me = session && state.users.find((u) => u.id === session.userId && u.active);

let adminTab = "trainings";
let teamFilter = "all";
let uploadMessage = null;
let toastTimer;

function init() {
  document.querySelector("#user-name").textContent = me.name;
  document.querySelector("#user-role").textContent = store.ROLES[me.role] + (me.team ? " · " + me.team : "");
  document.querySelector("#logout").addEventListener("click", () => {
    store.clearSession();
    location.href = "index.html";
  });
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("submit", onSubmit);
  render();
  // Check-in windows and feedback deadlines move with the clock.
  setInterval(() => {
    if (!dialog.open && !document.activeElement.matches("input, select, textarea")) render();
  }, 30 * 1000);
}

/* ---------- helpers ---------- */

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const time = (d) => new Date(d).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
const dayKey = (d) => new Date(d).toDateString();
const byStart = (a, b) => new Date(a.start) - new Date(b.start);
const avg = (list) => list.reduce((sum, n) => sum + n, 0) / list.length;
const userById = (id) => state.users.find((u) => u.id === id);
// Hungarian names are family name first.
const firstName = (name) => name.split(" ").slice(1).join(" ") || name;

function relativeDay(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return { "-1": "Tegnap", 0: "Ma", 1: "Holnap" }[Math.round((target - today) / 86400000)] || null;
}

function dayLabel(d) {
  const long = new Date(d).toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" });
  const named = relativeDay(d);
  return named ? `${named} · ${long}` : long;
}

function groupByDay(trainings) {
  const groups = [];
  for (const t of [...trainings].sort(byStart)) {
    let group = groups.find((g) => g.key === dayKey(t.start));
    if (!group) groups.push((group = { key: dayKey(t.start), label: dayLabel(t.start), items: [] }));
    group.items.push(t);
  }
  return groups;
}

function phase(t, now = new Date()) {
  if (now >= new Date(t.end)) return "ended";
  if (now >= new Date(t.start)) return "live";
  if (now >= store.checkinOpensAt(t)) return "open";
  return "upcoming";
}

function faceSvg(level, cls = "") {
  const f = FACES[level];
  return `<svg class="face ${cls}" viewBox="0 0 200 140" aria-hidden="true" style="--face-fg:${f.fg}">
    <ellipse class="eye" cx="62" cy="52" rx="${f.eye[0]}" ry="${f.eye[1]}"/>
    <ellipse class="eye" cx="138" cy="52" rx="${f.eye[0]}" ry="${f.eye[1]}"/>
    <path class="mouth" d="${f.mouth}"/>
  </svg>`;
}

function setFace(svg, level) {
  const f = FACES[level];
  svg.style.setProperty("--face-fg", f.fg);
  svg.querySelectorAll(".eye").forEach((eye) => {
    eye.setAttribute("rx", f.eye[0]);
    eye.setAttribute("ry", f.eye[1]);
    eye.style.setProperty("rx", f.eye[0] + "px");
    eye.style.setProperty("ry", f.eye[1] + "px");
  });
  const mouth = svg.querySelector(".mouth");
  mouth.setAttribute("d", f.mouth);
  mouth.style.setProperty("d", `path("${f.mouth}")`);
}

const pageHead = (title, subtitle) =>
  `<header class="page-head"><span class="gold-rule"></span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></header>`;

const tiles = (items) =>
  `<div class="tiles">${items.map(([label, value]) => `<div class="tile"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;

function commit() {
  store.save(state);
  render();
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
}

/* ---------- rendering ---------- */

function render() {
  const wasOpen = new Map([...app.querySelectorAll("details")].map((d) => [d.dataset.id, d.open]));
  if (me.role === "player") {
    app.innerHTML = playerView();
  } else if (me.role === "coach") {
    const mine = state.trainings.filter((t) => t.team === me.team);
    app.innerHTML =
      pageHead(`Szia, ${firstName(me.name)}!`, `${me.team} edzője · jelenlét és visszajelzések`) +
      staffSummary(mine) +
      staffList(mine, false);
  } else {
    app.innerHTML = adminView();
  }
  app.insertAdjacentHTML(
    "beforeend",
    `<footer class="app-footer">Demó felület · az adatok csak ebben a böngészőben tárolódnak · <button class="text-link" type="button" data-act="reset">Demó visszaállítása</button></footer>`
  );
  app.querySelectorAll("details").forEach((d) => {
    if (wasOpen.has(d.dataset.id)) d.open = wasOpen.get(d.dataset.id);
  });
}

/* Player */

function playerState(t, now) {
  const rec = state.attendance[t.id]?.[me.id];
  const given = state.feedback.some((f) => f.trainingId === t.id && f.userId === me.id);
  const p = phase(t, now);
  if (p === "upcoming") return { key: "upcoming", note: `Belépés nyílik: ${time(store.checkinOpensAt(t))}` };
  if (p !== "ended") {
    if (!rec) return { key: "can-checkin", note: p === "live" ? "Az edzés folyamatban van" : `Belépés nyitva · kezdés ${time(t.start)}` };
    if (!rec.out) return { key: "inside", note: `Bent vagy ${time(rec.in)} óta` };
    return { key: "left", note: `Kiléptél: ${time(rec.out)}` };
  }
  if (!rec) return { key: "absent", note: "Nem voltál jelen" };
  if (given) return { key: "done", note: "Köszönjük a visszajelzést!" };
  if (now < store.feedbackDeadline(t)) return { key: "feedback", note: `Visszajelzés küldhető ${time(store.feedbackDeadline(t))}-ig` };
  return { key: "closed", note: "A visszajelzési idő lejárt" };
}

function playerAction(t, s) {
  return {
    upcoming: `<button class="btn" type="button" disabled>BELÉPEK</button>`,
    "can-checkin": `<button class="btn" type="button" data-act="checkin" data-id="${t.id}">BELÉPEK</button>`,
    inside: `<button class="btn btn-secondary" type="button" data-act="checkout" data-id="${t.id}">KILÉPEK</button>`,
    left: `<span class="chip">Kiléptél</span>`,
    absent: `<span class="chip chip-muted">Hiányzás</span>`,
    done: `<span class="chip">✓ Elküldve</span>`,
    feedback: `<button class="btn" type="button" data-act="feedback" data-id="${t.id}">VISSZAJELZÉS</button>`,
    closed: `<span class="chip chip-muted">Lezárva</span>`,
  }[s.key];
}

function playerCard(t, now) {
  const s = playerState(t, now);
  const p = phase(t, now);
  const cls = p === "live" || p === "open" ? "is-live" : p === "ended" ? "is-past" : "";
  return `<article class="training-card ${cls}">
    <div class="tc-time"><strong>${time(t.start)}</strong><span>${time(t.end)}</span></div>
    <div class="tc-body">
      <h3>${esc(t.title)}${p === "live" ? ' <span class="live-dot">Most</span>' : ""}</h3>
      <p>${esc(t.location)}</p>
      <p class="tc-note ${s.key === "feedback" ? "is-gold" : ""}">${esc(s.note)}</p>
    </div>
    <div class="tc-action">${playerAction(t, s)}</div>
  </article>`;
}

function playerView() {
  const now = new Date();
  const mine = state.trainings.filter((t) => t.team === me.team);
  const next = mine.filter((t) => new Date(t.end) > now).sort(byStart)[0];
  const finished = mine.filter((t) => phase(t, now) === "ended");
  const attended = finished.filter((t) => state.attendance[t.id]?.[me.id]).length;
  const pending = mine.filter((t) => playerState(t, now).key === "feedback").length;
  const coach = store.coachOf(state, me.team);
  const nextLabel = next ? `${relativeDay(next.start) || new Date(next.start).toLocaleDateString("hu-HU", { weekday: "long" })} ${time(next.start)}` : "Nincs";

  return (
    pageHead(`Szia, ${firstName(me.name)}!`, `${me.team} · Edző: ${coach ? coach.name : "–"}`) +
    tiles([
      ["Következő edzés", esc(nextLabel)],
      ["Visszajelzésre vár", pending],
      ["Jelenlét", `${attended}/${finished.length}`],
    ]) +
    scheduleNotice() +
    groupByDay(mine)
      .map((g) => `<section class="day-group"><h2>${esc(g.label)}</h2>${g.items.map((t) => playerCard(t, now)).join("")}</section>`)
      .join("")
  );
}

function scheduleNotice() {
  const last = state.uploads[0];
  if (!last) return "";
  const when = new Date(last.at).toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" });
  return `<p class="notice"><span class="gold-rule"></span>Heti beosztás véglegesítve: ${esc(when)} · ${esc(last.fileName)}</p>`;
}

/* Feedback dialog */

function openFeedback(trainingId) {
  const t = state.trainings.find((x) => x.id === trainingId);
  const [moodQ, ...rest] = store.QUESTIONS;
  dialog.innerHTML = `
    <form class="fb-form">
      <div class="fb-top">
        <button class="fb-close" type="button" data-close aria-label="Bezárás">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m6-6-6 6 6 6"/></svg>
        </button>
        <span>Edzés vége · ${esc(t.title)}</span>
      </div>
      <h2>${esc(moodQ.text)}</h2>
      <div class="fb-face">${faceSvg(3, "face-lg")}<p class="fb-mood-label" id="mood-label"></p></div>
      <input class="range" type="range" name="mood" min="0" max="4" step="1" value="3" aria-label="${esc(moodQ.text)}" />
      ${rest
        .map(
          (q) => `<label class="fb-question"><span>${esc(q.text)}</span>
            <input class="range" type="range" name="${q.id}" min="0" max="4" step="1" value="2" />
            <output>${esc(q.labels[2])}</output></label>`
        )
        .join("")}
      <textarea name="comment" rows="3" placeholder="Írd le részletesen (opcionális)"></textarea>
      <label class="fb-anon"><input type="checkbox" name="anonymous" /><span>Névtelenül küldöm</span></label>
      <button class="submit-button" type="submit"><span>KÜLDÉS</span></button>
      <p class="fb-deadline">Határidő: ${time(store.feedbackDeadline(t))}</p>
    </form>`;

  const form = dialog.querySelector("form");
  const applyMood = (level) => {
    dialog.style.setProperty("--mood-bg", FACES[level].bg);
    dialog.style.setProperty("--mood-fg", FACES[level].fg);
    setFace(dialog.querySelector(".face-lg"), level);
    dialog.querySelector("#mood-label").textContent = moodQ.labels[level];
  };
  applyMood(3);

  form.addEventListener("input", (event) => {
    const input = event.target;
    if (input.name === "mood") applyMood(Number(input.value));
    else if (input.type === "range") {
      input.nextElementSibling.textContent = store.QUESTIONS.find((q) => q.id === input.name).labels[input.value];
    }
  });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.feedback.push({
      id: "f" + Date.now(),
      trainingId,
      userId: me.id,
      anonymous: data.has("anonymous"),
      answers: Object.fromEntries(store.QUESTIONS.map((q) => [q.id, Number(data.get(q.id))])),
      comment: String(data.get("comment")).trim(),
      at: new Date().toISOString(),
    });
    dialog.close();
    commit();
    toast("Köszönjük a visszajelzést!");
  });
  dialog.showModal();
}

/* Coach & admin */

function staffSummary(trainings) {
  const now = new Date();
  const today = trainings.filter((t) => dayKey(t.start) === dayKey(now));
  const inside = trainings
    .filter((t) => ["open", "live"].includes(phase(t, now)))
    .reduce((n, t) => n + Object.values(state.attendance[t.id] || {}).filter((r) => !r.out).length, 0);
  const ids = new Set(trainings.map((t) => t.id));
  const feedbackToday = state.feedback.filter((f) => ids.has(f.trainingId) && dayKey(f.at) === dayKey(now)).length;
  return tiles([
    ["Mai edzések", today.length],
    ["Most bent", inside],
    ["Mai visszajelzések", feedbackToday],
  ]);
}

function staffList(trainings, showTeam) {
  const now = new Date();
  if (!trainings.length) return `<p class="empty">Nincs megjeleníthető edzés.</p>`;
  return groupByDay(trainings)
    .map((g) => `<section class="day-group"><h2>${esc(g.label)}</h2>${g.items.map((t) => staffCard(t, now, showTeam)).join("")}</section>`)
    .join("");
}

function staffCard(t, now, showTeam) {
  const p = phase(t, now);
  const roster = state.users.filter((u) => u.role === "player" && u.team === t.team && u.active);
  const att = state.attendance[t.id] || {};
  const present = roster.filter((u) => att[u.id]).length;
  const fbs = state.feedback.filter((f) => f.trainingId === t.id);
  const avgMood = fbs.length ? Math.round(avg(fbs.map((f) => f.answers.mood))) : null;
  const phaseChip = {
    upcoming: '<span class="chip chip-muted">Tervezett</span>',
    open: '<span class="chip chip-gold">Belépés nyitva</span>',
    live: '<span class="chip chip-live">Folyamatban</span>',
    ended: '<span class="chip chip-muted">Lezárult</span>',
  }[p];

  return `<details class="staff-card ${p === "live" || p === "open" ? "is-live" : ""}" data-id="${t.id}" ${p === "live" || p === "open" ? "open" : ""}>
    <summary>
      <div class="tc-time"><strong>${time(t.start)}</strong><span>${time(t.end)}</span></div>
      <div class="tc-body">
        <h3>${esc(t.title)}</h3>
        <p>${showTeam ? `<span class="team-tag">${esc(t.team)}</span>` : ""}${esc(t.location)}</p>
      </div>
      <div class="sc-stats">
        ${phaseChip}
        <span class="sc-stat"><span><strong>${p === "upcoming" ? "–" : present}</strong>/${roster.length} jelen</span></span>
        <span class="sc-stat">${avgMood !== null ? faceSvg(avgMood, "face-xs") : ""}<span><strong>${fbs.length}</strong> visszajelzés</span></span>
      </div>
      <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </summary>
    <div class="sc-detail">
      <section><h4>Jelenlét</h4><ul class="roster">${roster.map((u) => rosterRow(u, att[u.id], t, p)).join("")}</ul></section>
      <section><h4>Visszajelzések</h4>${feedbackSummary(fbs, p)}</section>
    </div>
  </details>`;
}

function rosterRow(user, rec, t, p) {
  let chip;
  if (rec && (rec.out || p === "ended")) chip = `<span class="chip">Jelen · ${time(rec.in)}–${time(rec.out || t.end)}</span>`;
  else if (rec) chip = `<span class="chip chip-live">Bent · ${time(rec.in)} óta</span>`;
  else if (p === "ended") chip = `<span class="chip chip-red">Hiányzott</span>`;
  else if (p === "upcoming") chip = `<span class="chip chip-muted">–</span>`;
  else chip = `<span class="chip chip-muted">Még nem lépett be</span>`;
  return `<li><span>${esc(user.name)}</span>${chip}</li>`;
}

function feedbackSummary(fbs, p) {
  if (!fbs.length) {
    return `<p class="empty">${p === "ended" ? "Még nem érkezett visszajelzés." : "A visszajelzés az edzés végén nyílik meg."}</p>`;
  }
  const bars = store.QUESTIONS.map((q) => {
    const a = avg(fbs.map((f) => f.answers[q.id]));
    return `<div class="avg-row"><span>${esc(q.text)}</span><div class="avg-bar"><i style="width:${(a / 4) * 100}%"></i></div><strong>${esc(q.labels[Math.round(a)])}</strong></div>`;
  }).join("");
  const comments = fbs
    .map((f) => {
      const author = f.anonymous ? "Névtelen" : userById(f.userId)?.name || "Ismeretlen";
      return `<li class="comment">${faceSvg(f.answers.mood, "face-xs")}<div><strong>${esc(author)}</strong> <span>${time(f.at)}</span>${
        f.comment ? `<p>${esc(f.comment)}</p>` : ""
      }</div></li>`;
    })
    .join("");
  return `<div class="avg-list">${bars}</div><ul class="comments">${comments}</ul>`;
}

function adminView() {
  const tabs = [
    ["trainings", "Edzések"],
    ["users", "Felhasználók"],
    ["upload", "Beosztás feltöltése"],
  ];
  const tabBar = `<nav class="tabs" role="tablist">${tabs
    .map(([id, label]) => `<button class="tab" type="button" role="tab" aria-selected="${adminTab === id}" data-act="tab" data-tab="${id}">${label}</button>`)
    .join("")}</nav>`;
  const body = adminTab === "users" ? usersTab() : adminTab === "upload" ? uploadTab() : trainingsTab();
  return pageHead(`Szia, ${firstName(me.name)}!`, "Adminisztráció · minden csapat edzése, felhasználók és beosztás") + tabBar + body;
}

function trainingsTab() {
  const list = state.trainings.filter((t) => teamFilter === "all" || t.team === teamFilter);
  const options = [["all", "Minden csapat"], ...store.teams(state).map((t) => [t, t])]
    .map(([value, label]) => `<option value="${esc(value)}" ${teamFilter === value ? "selected" : ""}>${esc(label)}</option>`)
    .join("");
  return `${staffSummary(list)}
    <div class="filter-row"><label>Csapat <select data-filter="team">${options}</select></label></div>
    ${staffList(list, true)}`;
}

function usersTab() {
  const rows = [...state.users]
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name, "hu"))
    .map(
      (u) => `<tr>
        <td>${esc(u.name)}</td>
        <td><code>${esc(u.talentx)}</code></td>
        <td>${store.ROLES[u.role]}</td>
        <td>${esc(u.team || "–")}</td>
        <td><button class="switch" type="button" role="switch" aria-checked="${u.active}" data-act="toggle-user" data-id="${u.id}" ${
          u.id === me.id ? "disabled" : ""
        }><span></span>${u.active ? "Engedélyezve" : "Tiltva"}</button></td>
      </tr>`
    )
    .join("");
  const teamOptions = store.teams(state).map((t) => `<option>${esc(t)}</option>`).join("");
  return `<section class="panel">
      <h2>Felhasználók</h2>
      <p class="panel-intro">Csak engedélyezett felhasználó léphet be. A belépés a TalentX azonosítóval történik.</p>
      <div class="table-wrap"><table class="user-table">
        <thead><tr><th>Név</th><th>TalentX</th><th>Szerepkör</th><th>Csapat</th><th>Hozzáférés</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>
    <section class="panel">
      <h2>Új felhasználó</h2>
      <form class="add-user" data-form="add-user">
        <label>Név<input name="name" required autocomplete="off" /></label>
        <label>TalentX azonosító<input name="talentx" required placeholder="TX-1234" autocomplete="off" /></label>
        <label>Szerepkör<select name="role"><option value="player">Játékos</option><option value="coach">Edző</option><option value="admin">Admin</option></select></label>
        <label>Csapat<select name="team">${teamOptions}<option value="">–</option></select></label>
        <button class="btn" type="submit">HOZZÁADÁS</button>
      </form>
      <p class="panel-intro">Az új felhasználó a demó jelszóval (<code>${store.DEMO_PASSWORD}</code>) tud belépni.</p>
    </section>`;
}

function uploadTab() {
  const history = state.uploads
    .map(
      (u) => `<li><strong>${esc(u.fileName)}</strong><span>${new Date(u.at).toLocaleString("hu-HU", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} · ${u.added} edzés</span></li>`
    )
    .join("");
  return `<section class="panel">
      <h2>Heti beosztás feltöltése</h2>
      <p class="panel-intro">A beosztást a Google Drive-on lévő Excelben vezetitek, és minden szombaton véglegesül. A véglegesített táblázatot töltsd fel ide: a játékosok és edzők azonnal látják az edzéseket. Az azonos napra és csapatra vonatkozó korábbi edzéseket a feltöltés felülírja.</p>
      <label class="dropzone">
        <input type="file" accept=".xlsx,.xls,.csv" data-upload />
        <strong>Fájl kiválasztása</strong>
        <span>.xlsx vagy .csv · oszlopok: Dátum, Kezdés, Vége, Csapat, Edzés, Helyszín</span>
      </label>
      <button class="btn btn-secondary" type="button" data-act="template">MINTA LETÖLTÉSE</button>
      ${uploadMessage ? `<p class="upload-result ${uploadMessage.error ? "is-error" : ""}">${esc(uploadMessage.text)}</p>` : ""}
    </section>
    <section class="panel">
      <h2>Korábbi feltöltések</h2>
      <ul class="uploads">${history || "<li>Még nincs feltöltés.</li>"}</ul>
    </section>`;
}

/* ---------- events ---------- */

function onClick(event) {
  const target = event.target.closest("[data-act]");
  if (!target) return;
  const { act, id } = target.dataset;
  if (act === "checkin") {
    (state.attendance[id] ||= {})[me.id] = { in: new Date().toISOString(), out: null };
    commit();
    toast("Sikeres belépés. Jó edzést!");
  } else if (act === "checkout") {
    state.attendance[id][me.id].out = new Date().toISOString();
    commit();
    toast("Kiléptél az edzésről.");
  } else if (act === "feedback") {
    openFeedback(id);
  } else if (act === "tab") {
    adminTab = target.dataset.tab;
    render();
  } else if (act === "toggle-user") {
    const user = userById(id);
    user.active = !user.active;
    commit();
  } else if (act === "template") {
    downloadTemplate();
  } else if (act === "reset" && confirm("Visszaállítod a demó adatokat?")) {
    state = store.reset();
    uploadMessage = null;
    render();
    toast("Demó adatok visszaállítva.");
  }
}

function onChange(event) {
  const input = event.target;
  if (input.matches("[data-filter='team']")) {
    teamFilter = input.value;
    render();
  } else if (input.matches("[data-upload]") && input.files[0]) {
    handleUpload(input.files[0]);
  }
}

function onSubmit(event) {
  const form = event.target;
  if (form.dataset.form !== "add-user") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const talentx = data.talentx.trim().toUpperCase();
  if (state.users.some((u) => u.talentx.toUpperCase() === talentx)) {
    toast("Ez a TalentX azonosító már létezik.");
    return;
  }
  state.users.push({
    id: "u" + Date.now(),
    talentx,
    name: data.name.trim(),
    role: data.role,
    team: data.role === "admin" ? "" : data.team,
    active: true,
  });
  commit();
  toast(`${data.name.trim()} hozzáadva.`);
}

/* ---------- schedule upload ---------- */

async function handleUpload(file) {
  try {
    const rows = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : await readExcel(file);
    const result = importSchedule(rows);
    if (!result.added) throw new Error("nem találtunk érvényes sort");
    state.uploads.unshift({ fileName: file.name, at: new Date().toISOString(), added: result.added });
    uploadMessage = { text: `${result.added} edzés importálva${result.skipped ? `, ${result.skipped} sor kihagyva` : ""}.` };
    commit();
  } catch (err) {
    uploadMessage = { text: `Nem sikerült beolvasni a fájlt: ${err.message}.`, error: true };
    render();
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("az Excel-olvasó nem tölthető be"));
    document.head.append(script);
  });
}

async function readExcel(file) {
  if (!window.XLSX) await loadScript(XLSX_URL);
  const book = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "" });
}

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const delimiter = lines[0].includes(";") ? ";" : ",";
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

// Excel stores dates as day serials and times as fractions of a day.
function parseDate(cell) {
  if (typeof cell === "number") {
    const d = new Date(Math.round((cell - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const m = String(cell).trim().match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/);
  return m ? new Date(+m[1], m[2] - 1, +m[3]) : null;
}

function parseTime(cell) {
  if (typeof cell === "number") return Math.round((cell % 1) * 1440);
  const m = String(cell).trim().match(/^(\d{1,2})[:.](\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

function importSchedule(rows) {
  const teams = store.teams(state);
  const parsed = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    if (!row.some((cell) => String(cell).trim())) return;
    const [dateCell, startCell, endCell, team, title, location] = row;
    const date = parseDate(dateCell);
    const start = parseTime(startCell);
    const end = parseTime(endCell);
    if (!date || start == null || end == null || end <= start || !teams.includes(String(team).trim())) {
      if (i > 0) skipped++; // the first row is usually the header
      return;
    }
    const at = (minutes) => {
      const d = new Date(date);
      d.setHours(0, minutes, 0, 0);
      return d.toISOString();
    };
    parsed.push({
      team: String(team).trim(),
      title: String(title || "Edzés").trim(),
      location: String(location || "").trim(),
      start: at(start),
      end: at(end),
    });
  });
  // A finalised sheet replaces that team's trainings on the same days, unless someone already checked in.
  const covered = new Set(parsed.map((t) => t.team + dayKey(t.start)));
  state.trainings = state.trainings.filter((t) => !covered.has(t.team + dayKey(t.start)) || state.attendance[t.id]);
  const stamp = Date.now();
  parsed.forEach((t, i) => state.trainings.push({ id: `imp${stamp}-${i}`, ...t }));
  return { added: parsed.length, skipped };
}

function downloadTemplate() {
  const pad = (n) => String(n).padStart(2, "0");
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  const rows = [["Dátum", "Kezdés", "Vége", "Csapat", "Edzés", "Helyszín"]];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    rows.push([date, "16:00", "17:30", "U17", i % 2 ? "Technikai edzés" : "Csapatedzés", "Füves pálya 1"]);
    rows.push([date, "17:45", "19:15", "U19", i % 2 ? "Taktikai edzés" : "Csapatedzés", "Füves pálya 2"]);
  }
  const csv = "﻿" + rows.map((r) => r.join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "heti_beosztas_minta.csv" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (!me) {
  store.clearSession();
  location.replace("index.html");
} else {
  init();
}
