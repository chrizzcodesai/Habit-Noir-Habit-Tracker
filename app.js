const defaultHabits = [
  { id: "supplements", name: "Supplements", section: "Morning", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "08:00", archived: false },
  { id: "minoxidil-dermaroller", name: "Minoxidil & DermaRoller", section: "Night", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "21:30", archived: false },
  { id: "gym-cardio", name: "Go to the Gym & do cardio", section: "Day", schedule: { mode: "weekdays", days: [1, 2, 3, 4, 5] }, reminder: "18:00", archived: false },
  { id: "brush-night", name: "Brush teeth at night", section: "Night", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "22:45", archived: false },
  { id: "clothes-before", name: "Organize Clothes Night Before", section: "Night", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "", archived: false },
  { id: "wake-645", name: "Wake up 6:45 AM", section: "Morning", schedule: { mode: "weekdays", days: [1, 2, 3, 4, 5] }, reminder: "06:45", archived: false },
  { id: "no-junk", name: "Not eat junk food", section: "Day", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "", archived: false },
  { id: "weigh-morning", name: "Weigh myself in the morning", section: "Morning", schedule: { mode: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, reminder: "07:00", archived: false },
];

const seedEntries = {
  "2026-06-15": ["supplements", "minoxidil-dermaroller", "gym-cardio", "clothes-before", "wake-645", "no-junk", "weigh-morning"],
  "2026-06-16": ["supplements", "minoxidil-dermaroller", "clothes-before", "wake-645", "no-junk", "weigh-morning"],
  "2026-06-17": ["supplements", "minoxidil-dermaroller", "clothes-before", "wake-645", "no-junk"],
  "2026-06-18": ["supplements", "wake-645", "weigh-morning"],
  "2026-06-22": ["supplements", "minoxidil-dermaroller", "wake-645", "no-junk", "weigh-morning"],
  "2026-06-25": ["supplements", "no-junk"],
  "2026-06-29": ["supplements", "minoxidil-dermaroller", "gym-cardio", "brush-night", "no-junk"],
  "2026-06-30": ["supplements", "minoxidil-dermaroller"],
  "2026-07-01": ["supplements", "no-junk"],
};

const storageKey = "habit-noir:v2";
const legacyStorageKey = "habit-noir:v1";
const backupVersion = 1;
const rangeStart = new Date("2026-06-01T00:00:00");
const rangeEnd = new Date("2028-01-31T00:00:00");
const sectionOrder = ["Morning", "Day", "Night"];
const today = clampDate(startOfDay(new Date()), rangeStart, rangeEnd);
let selectedDate = today;
let selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let editingHabitId = null;
let notificationTimer = null;
let activeSheet = null;
let state = loadState();

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  scoreNumber: document.querySelector("#scoreNumber"),
  scoreRing: document.querySelector("#scoreRing"),
  habitList: document.querySelector("#habitList"),
  habitTemplate: document.querySelector("#habitTemplate"),
  resetToday: document.querySelector("#resetToday"),
  addHabit: document.querySelector("#addHabit"),
  openArchive: document.querySelector("#openArchive"),
  openReminders: document.querySelector("#openReminders"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  monthTitle: document.querySelector("#monthTitle"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthStrip: document.querySelector("#monthStrip"),
  calendarGrid: document.querySelector("#calendarGrid"),
  statsTitle: document.querySelector("#statsTitle"),
  statsList: document.querySelector("#statsList"),
  backdrop: document.querySelector("#sheetBackdrop"),
  habitSheet: document.querySelector("#habitSheet"),
  habitForm: document.querySelector("#habitForm"),
  sheetMode: document.querySelector("#sheetMode"),
  sheetTitle: document.querySelector("#sheetTitle"),
  closeSheet: document.querySelector("#closeSheet"),
  habitName: document.querySelector("#habitName"),
  habitReminder: document.querySelector("#habitReminder"),
  weekdayGrid: document.querySelector("#weekdayGrid"),
  notificationNotice: document.querySelector("#notificationNotice"),
  archiveHabit: document.querySelector("#archiveHabit"),
  deleteHabit: document.querySelector("#deleteHabit"),
  archiveSheet: document.querySelector("#archiveSheet"),
  closeArchive: document.querySelector("#closeArchive"),
  archiveList: document.querySelector("#archiveList"),
  reminderSheet: document.querySelector("#reminderSheet"),
  closeReminders: document.querySelector("#closeReminders"),
  reminderCopy: document.querySelector("#reminderCopy"),
  reminderList: document.querySelector("#reminderList"),
  enableNotifications: document.querySelector("#enableNotifications"),
  testNotification: null,
  exportProgress: document.querySelector("#exportProgress"),
  importProgress: document.querySelector("#importProgress"),
  importFile: document.querySelector("#importFile"),
};

renderAll();
registerEvents();
registerServiceWorker();
scheduleReminderCheck();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.habits && saved?.entries) return normalizeState(saved);
  } catch {}

  try {
    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey));
    if (legacy?.entries) return normalizeState({ habits: defaultHabits, entries: { ...seedEntries, ...legacy.entries }, notificationsEnabled: false });
  } catch {}

  return normalizeState({ habits: defaultHabits, entries: seedEntries, notificationsEnabled: false });
}

function normalizeState(input) {
  const habits = (input.habits || defaultHabits).map((habit, index) => ({
    id: habit.id || createId(habit.name || `habit-${index}`),
    name: habit.name || "Untitled Habit",
    section: sectionOrder.includes(habit.section) ? habit.section : "Day",
    schedule: normalizeSchedule(habit.schedule),
    reminder: habit.reminder || "",
    archived: Boolean(habit.archived),
    createdAt: habit.createdAt || new Date().toISOString(),
  }));
  return {
    habits,
    entries: cleanEntries(input.entries || {}),
    notificationsEnabled: Boolean(input.notificationsEnabled),
    lastNotificationKey: input.lastNotificationKey || "",
  };
}

function normalizeSchedule(schedule) {
  const mode = schedule?.mode === "weekdays" ? "weekdays" : "daily";
  const days = Array.isArray(schedule?.days) ? schedule.days.map(Number).filter((day) => day >= 0 && day <= 6) : [0, 1, 2, 3, 4, 5, 6];
  return { mode, days: days.length ? [...new Set(days)] : [0, 1, 2, 3, 4, 5, 6] };
}

function cleanEntries(entries) {
  return Object.fromEntries(Object.entries(entries).map(([date, ids]) => [date, [...new Set(ids || [])]]));
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function registerEvents() {
  els.resetToday.addEventListener("click", () => {
    const key = iso(selectedDate);
    const scheduledIds = activeHabitsForDate(selectedDate).map((habit) => habit.id);
    state.entries[key] = (state.entries[key] || []).filter((id) => !scheduledIds.includes(id));
    saveAndRender();
  });

  els.addHabit.addEventListener("click", () => openHabitSheet());
  els.closeSheet.addEventListener("click", closeSheets);
  els.openArchive.addEventListener("click", openArchiveSheet);
  els.closeArchive.addEventListener("click", closeSheets);
  els.openReminders.addEventListener("click", openReminderSheet);
  els.closeReminders.addEventListener("click", closeSheets);
  els.backdrop.addEventListener("click", closeSheets);

  els.habitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveHabitFromForm();
  });

  els.archiveHabit.addEventListener("click", () => {
    const habit = findHabit(editingHabitId);
    if (!habit) return;
    habit.archived = true;
    saveState();
    closeSheets();
    renderAll();
  });

  els.deleteHabit.addEventListener("click", () => {
    const habit = findHabit(editingHabitId);
    if (!habit) return;
    const ok = window.confirm(`Delete "${habit.name}" and its history?`);
    if (!ok) return;
    deleteHabit(habit.id);
    closeSheets();
    renderAll();
  });

  els.enableNotifications.addEventListener("click", requestNotificationPermission);
  els.exportProgress.addEventListener("click", exportProgress);
  els.importProgress.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importProgressFromFile);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const viewName = tab.dataset.view;
      els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      els.views.forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}View`));
    });
  });

  els.prevMonth.addEventListener("click", () => {
    selectedMonth = clampMonth(addMonths(selectedMonth, -1));
    renderMonth();
    renderStats();
  });

  els.nextMonth.addEventListener("click", () => {
    selectedMonth = clampMonth(addMonths(selectedMonth, 1));
    renderMonth();
    renderStats();
  });
}

function renderAll() {
  renderToday();
  renderMonth();
  renderStats();
}

function renderToday() {
  const key = iso(selectedDate);
  const habits = activeHabitsForDate(selectedDate);
  const entries = state.entries[key] || [];
  const complete = habits.filter((habit) => entries.includes(habit.id)).length;
  const total = habits.length;
  const score = total ? complete / total : 0;

  els.todayLabel.textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  els.scoreNumber.textContent = `${complete}/${total}`;
  els.scoreRing.style.setProperty("--score", `${Math.round(score * 360)}deg`);
  els.habitList.replaceChildren(...renderSectionedHabits(habits, key));
}

function renderSectionedHabits(habits, key) {
  if (!habits.length) return [emptyState("No habits scheduled", "Add one or edit schedules to make this day active.")];
  const nodes = [];
  sectionOrder.forEach((section) => {
    const group = habits.filter((habit) => habit.section === section);
    if (!group.length) return;
    nodes.push(sectionHeader(section, group));
    group.forEach((habit) => nodes.push(renderHabitRow(habit, key)));
  });
  return nodes;
}

function sectionHeader(section, habits) {
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<span>${section}</span><em>${habits.length}</em>`;
  return header;
}

function renderHabitRow(habit, key) {
  const node = els.habitTemplate.content.firstElementChild.cloneNode(true);
  const done = isDone(key, habit.id);
  const monthCount = countHabitInMonth(habit.id, selectedDate);
  const streak = currentStreak(habit.id, selectedDate);

  node.classList.toggle("is-done", done);
  node.setAttribute("aria-pressed", String(done));
  node.querySelector(".habit-section").textContent = `${habit.section}${habit.reminder ? ` / ${formatTime(habit.reminder)}` : ""}`;
  node.querySelector(".habit-name").textContent = habit.name;
  node.querySelector(".habit-meta").textContent = streak ? `${streak} day streak` : scheduleLabel(habit);
  node.querySelector(".habit-count").textContent = `${monthCount}/${scheduledDaysInMonth(habit, selectedDate)}`;
  node.addEventListener("click", () => {
    toggleHabit(key, habit.id);
    renderAll();
  });
  node.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleHabit(key, habit.id);
    renderAll();
  });
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openHabitSheet(habit.id);
  });
  let pressTimer = null;
  node.addEventListener("touchstart", () => {
    pressTimer = window.setTimeout(() => openHabitSheet(habit.id), 520);
  }, { passive: true });
  node.addEventListener("touchend", () => window.clearTimeout(pressTimer));
  node.addEventListener("touchmove", () => window.clearTimeout(pressTimer));

  const edit = document.createElement("button");
  edit.className = "mini-edit";
  edit.type = "button";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit ${habit.name}`);
  edit.addEventListener("click", (event) => {
    event.stopPropagation();
    openHabitSheet(habit.id);
  });
  node.append(edit);
  return node;
}

function renderMonth() {
  els.monthTitle.textContent = selectedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  els.prevMonth.disabled = sameMonth(selectedMonth, rangeStart);
  els.nextMonth.disabled = sameMonth(selectedMonth, rangeEnd);
  renderMonthStrip();
  renderCalendarGrid();
}

function renderMonthStrip() {
  const months = monthRange(rangeStart, rangeEnd);
  els.monthStrip.replaceChildren(...months.map((month) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-pill";
    button.classList.toggle("is-active", sameMonth(month, selectedMonth));
    button.textContent = month.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    button.addEventListener("click", () => {
      selectedMonth = month;
      renderMonth();
      renderStats();
      button.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    return button;
  }));
}

function renderCalendarGrid() {
  const habits = visibleHabitsForMonth(selectedMonth);
  els.calendarGrid.replaceChildren(...habits.map((habit) => {
    const card = document.createElement("article");
    card.className = "calendar-card";
    if (habit.archived) card.classList.add("is-archived");

    const head = document.createElement("div");
    head.className = "calendar-head";
    const title = document.createElement("h3");
    title.textContent = habit.name;
    const count = document.createElement("span");
    count.className = "calendar-count";
    count.textContent = `${countHabitInMonth(habit.id, selectedMonth)} / ${scheduledDaysInMonth(habit, selectedMonth)}`;
    head.append(title, count);

    const grid = document.createElement("div");
    grid.className = "day-dots";
    for (let day = 1; day <= daysInMonth(selectedMonth); day += 1) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
      const key = iso(date);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";
      cell.textContent = day;
      cell.disabled = !isScheduled(habit, date);
      cell.classList.toggle("is-done", isDone(key, habit.id));
      cell.classList.toggle("is-today", sameDate(date, today));
      cell.setAttribute("aria-label", `${habit.name}, ${date.toDateString()}`);
      cell.addEventListener("click", () => {
        toggleHabit(key, habit.id);
        renderAll();
      });
      grid.append(cell);
    }

    card.append(head, grid);
    return card;
  }));
}

function renderStats() {
  els.statsTitle.textContent = selectedMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const habits = visibleHabitsForMonth(selectedMonth);
  els.statsList.replaceChildren(...habits.map((habit) => {
    const totalDays = scheduledDaysInMonth(habit, selectedMonth);
    const count = countHabitInMonth(habit.id, selectedMonth);
    const pct = totalDays ? Math.round((count / totalDays) * 100) : 0;
    const streak = currentStreak(habit.id, selectedDate);
    const card = document.createElement("article");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-copy">
        <h3>${escapeHtml(habit.name)}</h3>
        <p class="stat-sub">${habit.archived ? "archived" : streak ? `${streak} day streak` : scheduleLabel(habit)}</p>
      </div>
      <div>
        <div class="stat-value">${pct}%</div>
        <div class="stat-meter" aria-hidden="true"><span style="--pct:${pct}%"></span></div>
      </div>
    `;
    return card;
  }));
}

function openHabitSheet(habitId = null) {
  editingHabitId = habitId;
  const habit = habitId ? findHabit(habitId) : null;
  els.habitForm.reset();
  els.sheetMode.textContent = habit ? "Refine ritual" : "New ritual";
  els.sheetTitle.textContent = habit ? "Edit Habit" : "Add Habit";
  els.habitName.value = habit?.name || "";
  els.habitReminder.value = habit?.reminder || "";
  setRadio("section", habit?.section || "Morning");
  setRadio("scheduleMode", habit?.schedule?.mode || "daily");
  setWeekdays(habit?.schedule?.days || [0, 1, 2, 3, 4, 5, 6]);
  els.archiveHabit.hidden = !habit || habit.archived;
  els.deleteHabit.hidden = !habit;
  els.notificationNotice.textContent = notificationMessage();
  showSheet(els.habitSheet);
  window.setTimeout(() => els.habitName.focus(), 120);
}

function saveHabitFromForm() {
  const form = new FormData(els.habitForm);
  const name = String(form.get("name") || "").trim();
  if (!name) return;
  const scheduleMode = String(form.get("scheduleMode") || "daily");
  const selectedDays = [...els.habitForm.querySelectorAll("input[name='weekday']:checked")].map((input) => Number(input.value));
  const payload = {
    name,
    section: String(form.get("section") || "Day"),
    schedule: {
      mode: scheduleMode,
      days: scheduleMode === "daily" ? [0, 1, 2, 3, 4, 5, 6] : selectedDays,
    },
    reminder: String(form.get("reminder") || ""),
  };

  if (editingHabitId) {
    Object.assign(findHabit(editingHabitId), payload);
  } else {
    state.habits.push({
      id: uniqueHabitId(name),
      ...payload,
      archived: false,
      createdAt: new Date().toISOString(),
    });
  }
  saveState();
  closeSheets();
  scheduleReminderCheck();
  renderAll();
}

function openArchiveSheet() {
  renderArchive();
  showSheet(els.archiveSheet);
}

function renderArchive() {
  const archived = state.habits.filter((habit) => habit.archived);
  els.archiveList.replaceChildren(...(archived.length ? archived.map((habit) => {
    const row = document.createElement("div");
    row.className = "archive-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(habit.name)}</strong>
        <span>${escapeHtml(habit.section)} / ${scheduleLabel(habit)}</span>
      </div>
    `;
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "ghost-button";
    restore.textContent = "Restore";
    restore.addEventListener("click", () => {
      habit.archived = false;
      saveAndRender();
      renderArchive();
    });
    row.append(restore);
    return row;
  }) : [emptyState("Archive is empty", "Retired habits will live here without losing history.")]));
}

function openReminderSheet() {
  renderReminders();
  showSheet(els.reminderSheet);
}

function renderReminders() {
  els.reminderCopy.textContent = notificationMessage();
  const hasNotifications = "Notification" in window;
  els.enableNotifications.disabled = !hasNotifications || Notification.permission === "granted";
  els.enableNotifications.textContent = hasNotifications && Notification.permission === "granted" ? "Notifications Enabled" : "Enable Notifications";
  if (!els.testNotification) {
    els.testNotification = document.createElement("button");
    els.testNotification.type = "button";
    els.testNotification.className = "ghost-button";
    els.testNotification.textContent = "Test Notification";
    els.testNotification.addEventListener("click", sendTestNotification);
    els.enableNotifications.insertAdjacentElement("afterend", els.testNotification);
  }
  els.testNotification.disabled = !hasNotifications || Notification.permission !== "granted";
  const habits = state.habits.filter((habit) => !habit.archived && habit.reminder);
  els.reminderList.replaceChildren(...(habits.length ? habits.map((habit) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "reminder-row";
    row.innerHTML = `<span>${escapeHtml(habit.name)}</span><strong>${formatTime(habit.reminder)}</strong>`;
    row.addEventListener("click", () => openHabitSheet(habit.id));
    return row;
  }) : [emptyState("No reminders set", "Add a time to any habit to make it show up here.")]));
}

async function exportProgress() {
  const backup = {
    app: "Habit Noir",
    backupVersion,
    exportedAt: new Date().toISOString(),
    state,
  };
  const json = JSON.stringify(backup, null, 2);
  const filename = `habit-noir-backup-${iso(new Date())}.json`;
  const file = new File([json], filename, { type: "application/json" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Habit Noir Backup",
        text: "Habit Noir progress backup",
        files: [file],
      });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importProgressFromFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedState = extractImportedState(payload);
    if (!importedState) throw new Error("Invalid backup file");

    const ok = window.confirm("Replace the current progress with this backup?");
    if (!ok) return;

    state = normalizeState(importedState);
    saveState();
    closeSheets();
    scheduleReminderCheck();
    renderAll();
  } catch (error) {
    window.alert("That backup file could not be imported.");
  } finally {
    event.target.value = "";
  }
}

function extractImportedState(payload) {
  if (payload?.state?.habits && payload?.state?.entries) return payload.state;
  if (payload?.habits && payload?.entries) return payload;
  return null;
}

function showSheet(sheet) {
  activeSheet = sheet;
  els.backdrop.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  sheet.classList.add("is-open");
  document.body.classList.add("sheet-open");
}

function closeSheets() {
  editingHabitId = null;
  activeSheet = null;
  els.backdrop.hidden = true;
  [els.habitSheet, els.archiveSheet, els.reminderSheet].forEach((sheet) => {
    sheet.setAttribute("aria-hidden", "true");
    sheet.classList.remove("is-open");
  });
  document.body.classList.remove("sheet-open");
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    renderReminders();
    return;
  }
  Notification.requestPermission().then((permission) => {
    state.notificationsEnabled = permission === "granted";
    saveState();
    scheduleReminderCheck();
    renderReminders();
  });
}

async function sendTestNotification() {
  if (!("Notification" in window)) {
    window.alert("This browser does not support notifications here.");
    return;
  }
  if (Notification.permission !== "granted") {
    await requestNotificationPermission();
    if (Notification.permission !== "granted") return;
  }
  new Notification("Habit Noir", {
    body: "This is a test reminder from your Home Screen app.",
    icon: "icon.svg",
  });
}

function scheduleReminderCheck() {
  window.clearInterval(notificationTimer);
  notificationTimer = window.setInterval(checkReminders, 60000);
  checkReminders();
}

function checkReminders() {
  if (!state.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const key = iso(now);
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const due = state.habits.filter((habit) => !habit.archived && habit.reminder === hm && isScheduled(habit, now) && !isDone(key, habit.id));
  if (!due.length) return;
  const notificationKey = `${key}-${hm}-${due.map((habit) => habit.id).join(".")}`;
  if (state.lastNotificationKey === notificationKey) return;
  state.lastNotificationKey = notificationKey;
  saveState();
  new Notification("Habit Noir", {
    body: due.length === 1 ? `${due[0].name} is waiting.` : `${due.length} habits are waiting.`,
    icon: "icon.svg",
  });
}

function notificationMessage() {
  if (!("Notification" in window)) return "This browser does not expose web notifications here. Reminder times still save with each habit.";
  if (location.protocol === "file:") return "Reminder settings save locally. Browser notifications may be limited from a local file, especially on iPhone.";
  if (Notification.permission === "granted") return "This tab can notify you while the app is allowed to run.";
  if (Notification.permission === "denied") return "Notifications are blocked for this app in the browser.";
  return "Enable browser notifications to get reminder nudges when this app is allowed to run. Then tap Test Notification to confirm it works.";
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter((habit) => habit.id !== habitId);
  Object.keys(state.entries).forEach((date) => {
    state.entries[date] = state.entries[date].filter((id) => id !== habitId);
    if (!state.entries[date].length) delete state.entries[date];
  });
  saveState();
}

function toggleHabit(key, habitId) {
  const list = new Set(state.entries[key] || []);
  if (list.has(habitId)) list.delete(habitId);
  else list.add(habitId);
  state.entries[key] = [...list];
  saveState();
}

function saveAndRender() {
  saveState();
  renderAll();
}

function activeHabitsForDate(date) {
  return sortHabits(state.habits.filter((habit) => !habit.archived && isScheduled(habit, date)));
}

function visibleHabitsForMonth(date) {
  return sortHabits(state.habits.filter((habit) => !habit.archived || countHabitInMonth(habit.id, date)));
}

function sortHabits(habits) {
  return [...habits].sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.name.localeCompare(b.name));
}

function findHabit(id) {
  return state.habits.find((habit) => habit.id === id);
}

function isScheduled(habit, date) {
  return habit.schedule.days.includes(date.getDay());
}

function isDone(key, habitId) {
  return (state.entries[key] || []).includes(habitId);
}

function countHabitInMonth(habitId, date) {
  let total = 0;
  for (let day = 1; day <= daysInMonth(date); day += 1) {
    if (isDone(iso(new Date(date.getFullYear(), date.getMonth(), day)), habitId)) total += 1;
  }
  return total;
}

function scheduledDaysInMonth(habit, date) {
  let total = 0;
  for (let day = 1; day <= daysInMonth(date); day += 1) {
    if (isScheduled(habit, new Date(date.getFullYear(), date.getMonth(), day))) total += 1;
  }
  return total;
}

function currentStreak(habitId, date) {
  let total = 0;
  let cursor = new Date(date);
  const habit = findHabit(habitId);
  while (cursor >= rangeStart) {
    if (!habit || !isScheduled(habit, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (!isDone(iso(cursor), habitId)) break;
    total += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return total;
}

function scheduleLabel(habit) {
  if (habit.schedule.mode === "daily") return "every day";
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return habit.schedule.days.sort((a, b) => a - b).map((day) => labels[day]).join(" ");
}

function setRadio(name, value) {
  const input = els.habitForm.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function setWeekdays(days) {
  els.habitForm.querySelectorAll("input[name='weekday']").forEach((input) => {
    input.checked = days.includes(Number(input.value));
  });
}

function emptyState(title, detail) {
  const node = document.createElement("div");
  node.className = "empty-state";
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
  return node;
}

function uniqueHabitId(name) {
  const base = createId(name);
  let id = base;
  let i = 2;
  while (findHabit(id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  return id;
}

function createId(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `habit-${Date.now()}`;
}

function monthRange(start, end) {
  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function clampMonth(date) {
  const min = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const max = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function clampDate(date, min, max) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function sameDate(a, b) {
  return iso(a) === iso(b);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function iso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("sw.js").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}
