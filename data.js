// Demo data layer: everything is kept in this browser (localStorage), there is no backend yet.
(function () {
  const STATE_KEY = "eto-demo-state-v1";
  const SESSION_KEY = "eto-demo-session";
  const DEMO_PASSWORD = "eto1904";
  const MIN = 60 * 1000;
  const CHECKIN_OPENS_BEFORE_MIN = 15;
  const FEEDBACK_DEADLINE_HOUR = 22;
  // Demo trainings are generated relative to "now", so refresh them when they get old.
  const RESEED_AFTER_MS = 6 * 60 * MIN;

  const ROLES = { player: "Játékos", coach: "Edző", admin: "Admin" };

  // Standard slider questions shown at the end of a training (0–4 scale).
  const QUESTIONS = [
    { id: "mood", text: "Milyen volt az edzés?", labels: ["Nagyon rossz", "Rossz", "Rendben", "Nagyon jó", "Kiváló"] },
    { id: "load", text: "Mennyire volt megterhelő?", labels: ["Nagyon könnyű", "Könnyű", "Közepes", "Nehéz", "Nagyon nehéz"] },
    { id: "self", text: "Mennyire vagy elégedett a saját teljesítményeddel?", labels: ["Egyáltalán nem", "Kevésbé", "Közepesen", "Elégedett", "Nagyon elégedett"] },
  ];

  const memory = {};
  function read(storage, key) {
    try {
      return window[storage].getItem(key);
    } catch (e) {
      return memory[storage + key] ?? null;
    }
  }
  function write(storage, key, value) {
    try {
      window[storage].setItem(key, value);
    } catch (e) {
      memory[storage + key] = value;
    }
  }
  function remove(storage, key) {
    try {
      window[storage].removeItem(key);
    } catch (e) {
      // Storage unavailable; the in-memory copy below is all there is.
    }
    delete memory[storage + key];
  }

  function seed(now) {
    const users = [
      { id: "p1", talentx: "TX-1001", name: "Kiss Bence", role: "player", team: "U17", active: true },
      { id: "p2", talentx: "TX-1002", name: "Tóth Máté", role: "player", team: "U17", active: true },
      { id: "p3", talentx: "TX-1003", name: "Horváth Levente", role: "player", team: "U17", active: true },
      { id: "p4", talentx: "TX-1004", name: "Varga Dominik", role: "player", team: "U17", active: true },
      { id: "p5", talentx: "TX-1005", name: "Molnár Ádám", role: "player", team: "U17", active: true },
      { id: "p6", talentx: "TX-1006", name: "Farkas Zsombor", role: "player", team: "U17", active: true },
      { id: "p7", talentx: "TX-1101", name: "Balogh Kristóf", role: "player", team: "U19", active: true },
      { id: "p8", talentx: "TX-1102", name: "Papp Olivér", role: "player", team: "U19", active: true },
      { id: "p9", talentx: "TX-1103", name: "Szűcs Noel", role: "player", team: "U19", active: true },
      { id: "p10", talentx: "TX-1007", name: "Lakatos Bálint", role: "player", team: "U17", active: false },
      { id: "c1", talentx: "TX-2001", name: "Nagy Péter", role: "coach", team: "U17", active: true },
      { id: "c2", talentx: "TX-2002", name: "Szabó Anna", role: "coach", team: "U19", active: true },
      { id: "a1", talentx: "TX-9001", name: "Kovács Eszter", role: "admin", team: "", active: true },
    ];

    const base = new Date(now);
    base.setSeconds(0, 0);
    base.setMinutes(Math.floor(base.getMinutes() / 15) * 15);
    const rel = (min) => new Date(base.getTime() + min * MIN);
    const day = (offset, h, m) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const plan = [
      ["U17", day(-1, 16, 0), 90, "Taktikai edzés", "Füves pálya 1"],
      ["U17", rel(-120), 90, "Technikai edzés", "Műfüves pálya"], // ended: feedback is open
      ["U17", rel(-15), 90, "Csapatedzés", "Füves pálya 1"], // in progress: check-in is open
      ["U17", rel(105), 60, "Erőnléti edzés", "Konditerem"], // check-in not open yet
      ["U17", day(1, 16, 30), 90, "Csapatedzés", "Füves pálya 2"],
      ["U17", day(2, 16, 0), 90, "Taktikai edzés", "Füves pálya 1"],
      ["U17", day(3, 10, 0), 75, "Regeneráló edzés", "Konditerem"],
      ["U19", day(-1, 18, 0), 90, "Csapatedzés", "Füves pálya 2"],
      ["U19", rel(-90), 75, "Taktikai edzés", "Műfüves pálya"],
      ["U19", rel(30), 90, "Csapatedzés", "Füves pálya 2"],
      ["U19", day(1, 17, 30), 90, "Technikai edzés", "Műfüves pálya"],
    ];
    const trainings = plan.map(([team, start, duration, title, location], i) => ({
      id: "t" + (i + 1),
      team,
      title,
      location,
      start: start.toISOString(),
      end: new Date(start.getTime() + duration * MIN).toISOString(),
    }));
    const byId = Object.fromEntries(trainings.map((t) => [t.id, t]));

    const attendance = {};
    const checkIn = (trainingId, userId, earlyMin, left = true) => {
      const t = byId[trainingId];
      attendance[trainingId] = attendance[trainingId] || {};
      attendance[trainingId][userId] = {
        in: new Date(new Date(t.start).getTime() - earlyMin * MIN).toISOString(),
        out: left ? t.end : null,
      };
    };
    ["p1", "p2", "p3", "p4", "p5"].forEach((u, i) => checkIn("t1", u, 12 - i * 2));
    ["p1", "p2", "p3", "p4", "p6"].forEach((u, i) => checkIn("t2", u, 10 - i * 2));
    checkIn("t3", "p2", 10, false);
    checkIn("t3", "p3", 6, false);
    checkIn("t3", "p6", 2, false);
    ["p7", "p8", "p9"].forEach((u, i) => checkIn("t8", u, 9 - i * 3));
    ["p7", "p9"].forEach((u, i) => checkIn("t9", u, 8 - i * 4));

    const feedback = [];
    const give = (trainingId, userId, [mood, load, self], comment, anonymous = false) => {
      const end = new Date(byId[trainingId].end).getTime();
      feedback.push({
        id: "f" + (feedback.length + 1),
        trainingId,
        userId,
        anonymous,
        answers: { mood, load, self },
        comment,
        at: new Date(Math.min(end + (feedback.length + 1) * 7 * MIN, now.getTime())).toISOString(),
      });
    };
    give("t1", "p1", [3, 3, 3], "Jó volt a taktikai rész, a letámadást többször is gyakorolnám.");
    give("t1", "p2", [1, 4, 2], "Túl hosszú volt a bemelegítés, a végére elfáradtunk.", true);
    give("t1", "p3", [4, 2, 3], "");
    give("t2", "p3", [4, 3, 4], "Nagyon jók voltak a passzgyakorlatok!");
    give("t2", "p4", [2, 3, 2], "", true);
    give("t8", "p7", [3, 4, 3], "Kemény edzés volt, de megérte.");
    give("t8", "p8", [2, 4, 1], "Fájt a bokám, jó lenne, ha megnézné a gyógytornász.", true);

    const lastSaturday = new Date(now);
    lastSaturday.setDate(lastSaturday.getDate() - ((lastSaturday.getDay() + 1) % 7 || 7));
    lastSaturday.setHours(10, 0, 0, 0);

    return {
      seededAt: now.toISOString(),
      users,
      trainings,
      attendance,
      feedback,
      uploads: [{ fileName: "heti_beosztas_vegleges.xlsx", at: lastSaturday.toISOString(), added: trainings.length }],
    };
  }

  function save(state) {
    write("localStorage", STATE_KEY, JSON.stringify(state));
  }

  function load() {
    const now = new Date();
    let state = null;
    try {
      state = JSON.parse(read("localStorage", STATE_KEY));
    } catch (e) {
      state = null;
    }
    const seededAt = state && new Date(state.seededAt);
    const stale = !state || now - seededAt > RESEED_AFTER_MS || seededAt.toDateString() !== now.toDateString();
    if (stale) {
      state = seed(now);
      save(state);
    }
    return state;
  }

  function reset() {
    remove("localStorage", STATE_KEY);
    return load();
  }

  function authenticate(state, identifier, password) {
    const key = identifier.trim().toLowerCase();
    const user = state.users.find((u) => u.talentx.toLowerCase() === key);
    if (!user || password !== DEMO_PASSWORD) return { error: "Hibás TalentX azonosító vagy jelszó." };
    if (!user.active) return { error: "A fiókod nincs engedélyezve. Keresd az adminisztrátort." };
    return { user };
  }

  function getSession() {
    const raw = read("sessionStorage", SESSION_KEY) || read("localStorage", SESSION_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(userId, remember) {
    clearSession();
    write(remember ? "localStorage" : "sessionStorage", SESSION_KEY, JSON.stringify({ userId }));
  }

  function clearSession() {
    remove("localStorage", SESSION_KEY);
    remove("sessionStorage", SESSION_KEY);
  }

  function checkinOpensAt(training) {
    return new Date(new Date(training.start).getTime() - CHECKIN_OPENS_BEFORE_MIN * MIN);
  }

  function feedbackDeadline(training) {
    const end = new Date(training.end);
    const deadline = new Date(end);
    deadline.setHours(FEEDBACK_DEADLINE_HOUR, 0, 0, 0);
    // Late-evening trainings still get an hour to send feedback.
    return deadline - end < 60 * MIN ? new Date(end.getTime() + 60 * MIN) : deadline;
  }

  function teams(state) {
    return [...new Set(state.users.filter((u) => u.role === "player" && u.team).map((u) => u.team))].sort();
  }

  function coachOf(state, team) {
    return state.users.find((u) => u.role === "coach" && u.team === team);
  }

  window.EtoStore = {
    MIN,
    ROLES,
    QUESTIONS,
    DEMO_PASSWORD,
    load,
    save,
    reset,
    authenticate,
    getSession,
    setSession,
    clearSession,
    checkinOpensAt,
    feedbackDeadline,
    teams,
    coachOf,
  };
})();
