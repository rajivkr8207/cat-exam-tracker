"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { requestJson } from "@/lib/api-client";
import WeeklyReview from "./WeeklyReview";
import MonthlyReview from "./MonthlyReview";
import TopicDashboard from "./TopicDashboard";
import SyllabusTracker from "./SyllabusTracker";
import RevisionQueue from "./RevisionQueue";
import MockTests from "./MockTests";
import Dashboard from "./Dashboard";
import HistoryAnalytics from "./HistoryAnalytics";
import StudyTimer from "./StudyTimer";
import BackupSettings from "./BackupSettings";
import StudyPlan from "./NextStudyPlan";
import "./task-diary.css";
import "./navbar.css"
const SECTIONS = ["VARC", "Quant", "DILR", "Revision", "Mock test", "Analysis", "Other"];
const PRIORITIES = ["Must do", "Should do", "Bonus"];
const STATUSES = [
  "Not started",
  "In progress",
  "Done",
  "Partly done",
  "Not done",
  "Skipped",
  "Rescheduled",
];
const DEFAULT_FORM = {
  title: "",
  section: "VARC",
  priority: "Must do",
  planned: "",
  startTime: "",
  endTime: "",
  status: "Not started",
  attempted: "",
  correct: "",
  actual: "",
  notes: "",
};
const DEFAULT_REFLECTION = {
  plan: "",
  actual: "",
  hours: "",
  focus: "",
  win: "",
  weak: "",
  tomorrow: "",
};
const FIELD_NAMES = [
  "title",
  "section",
  "priority",
  "planned",
  "startTime",
  "endTime",
  "status",
  "attempted",
  "correct",
  "actual",
  "notes",
];
const DEFAULT_TASK_PRACTICE = {
  enabled: false,
  topic: "",
  section: "VARC",
  date: "",
  total: "",
  attempted: "",
  correct: "",
  minutes: "",
  mistake: "",
  revisionDate: "",
  notes: "",
};

function subscribeToTheme(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("cat-diary-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cat-diary-theme-change", callback);
  };
}

function getThemeSnapshot() {
  try {
    return window.localStorage.getItem("catDiaryTheme") === "dark";
  } catch {
    return false;
  }
}

function getServerThemeSnapshot() {
  return false;
}

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}



function changeDate(value) {
  if (!value) {
    setError("Choose a valid date.");
    return;
  }
  setSelectedDate(value);
}

function addDays(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function timeToMinutes(value) {
  if (!value) return 99999;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return 99999;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

function normalizeTime(value) {
  if (!value.trim()) return "";
  let match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${match[2]} ${match[3].toUpperCase()}`;
  }

  match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function toApiPayload(form, date) {
  const payload = { ...form, date };
  for (const field of ["planned", "attempted", "correct", "actual"]) {
    payload[field] = form[field] === "" ? null : Number(form[field]);
  }
  return payload;
}

function taskOrder(a, b) {
  return (
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
    timeToMinutes(a.endTime) - timeToMinutes(b.endTime)
  );
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DailyDiary({ user, onSignOut }) {
  const [selectedDate, setSelectedDate] = useState(() => localDateString());
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [taskPractice, setTaskPractice] = useState(DEFAULT_TASK_PRACTICE);
  const [editingId, setEditingId] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reflection, setReflection] = useState(DEFAULT_REFLECTION);
  const [reflectionId, setReflectionId] = useState("");
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionNotice, setReflectionNotice] = useState("");
  const [reflectionError, setReflectionError] = useState("");
  const [currentView, setCurrentView] = useState("diary");
  const [profileOpen, setProfileOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdError, setPwdError] = useState("");
  const [pwdNotice, setPwdNotice] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const darkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  function toggleTheme() {
    try {
      window.localStorage.setItem("catDiaryTheme", darkMode ? "light" : "dark");
      window.dispatchEvent(new Event("cat-diary-theme-change"));
    } catch {
      setError("Theme preference could not be saved in this browser.");
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdError("");
    setPwdNotice("");
    if (pwdForm.next.length < 6) { setPwdError("New password must be at least 6 characters."); return; }
    if (pwdForm.next !== pwdForm.confirm) { setPwdError("New passwords do not match."); return; }
    setPwdSaving(true);
    try {
      await requestJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
      });
      setPwdNotice("Password changed! Please sign in again.");
      setPwdForm({ current: "", next: "", confirm: "" });
      window.setTimeout(() => { setShowChangePwd(false); onSignOut?.(); }, 1800);
    } catch (err) {
      setPwdError(err.message || "Could not change password.");
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    onSignOut?.();
  }

  const loadReflection = useCallback(async (date) => {
    setReflectionError("");
    setReflectionNotice("");
    try {
      const result = await requestJson(
        `/api/preparation/reflections?date=${encodeURIComponent(date)}`,
      );
      if (result.reflection) {
        setReflectionId(result.reflection._id);
        setReflection({
          plan: result.reflection.plan || "",
          actual: result.reflection.actual || "",
          hours: result.reflection.hours != null ? String(result.reflection.hours) : "",
          focus: result.reflection.focus || "",
          win: result.reflection.win || "",
          weak: result.reflection.weak || "",
          tomorrow: result.reflection.tomorrow || "",
        });
      } else {
        setReflectionId("");
        setReflection(DEFAULT_REFLECTION);
      }
    } catch {
      setReflectionId("");
      setReflection(DEFAULT_REFLECTION);
    }
  }, []);

  const loadTasks = useCallback(async (date, { keepNotice = false } = {}) => {
    setLoading(true);
    setError("");
    if (!keepNotice) setNotice("");
    try {
      const result = await requestJson(
        `/api/preparation/tasks?date=${encodeURIComponent(date)}&limit=500`,
      );
      setTasks(result.tasks);
    } catch (loadError) {
      setTasks([]);
      setError(loadError.message || "Could not load tasks. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTasks(selectedDate);
      loadReflection(selectedDate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReflection, loadTasks, selectedDate]);

  const dayTasks = useMemo(
    () => tasks.filter((task) => task.date === selectedDate),
    [selectedDate, tasks],
  );
  const visibleTasks = useMemo(() => {
    return dayTasks
      .filter((task) => sectionFilter === "All" || task.section === sectionFilter)
      .filter((task) => statusFilter === "All" || task.status === statusFilter)
      .slice()
      .sort(taskOrder);
  }, [dayTasks, sectionFilter, statusFilter]);

  const completed = dayTasks.filter((task) => task.status === "Done").length;
  const completion = dayTasks.length
    ? Math.round((completed / dayTasks.length) * 100)
    : 0;
  const partlyDone = dayTasks.filter((task) => task.status === "Partly done").length;
  const skipped = dayTasks.filter((task) => task.status === "Skipped").length;

  function resetForm() {
    setForm(DEFAULT_FORM);
    setTaskPractice(DEFAULT_TASK_PRACTICE);
    setEditingId("");
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateTaskPractice(event) {
    const { name, value, checked, type } = event.target;
    setTaskPractice((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function saveTask(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const startTime = normalizeTime(form.startTime);
    const endTime = normalizeTime(form.endTime);
    if (startTime === null) {
      setError("Enter start time like 07:00 AM or 12:30 PM.");
      return;
    }
    if (endTime === null) {
      setError("Enter end time like 09:00 AM or 01:30 PM.");
      return;
    }
    if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError("End time must be later than start time.");
      return;
    }
    if (
      form.attempted !== "" &&
      form.correct !== "" &&
      Number(form.correct) > Number(form.attempted)
    ) {
      setError("Correct answers cannot exceed questions attempted.");
      return;
    }

    const payload = toApiPayload({ ...form, startTime, endTime }, selectedDate);
    let savedTask = null;
    setSaving(true);
    try {
      if (editingId) {
        const result = await requestJson(`/api/preparation/tasks/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        savedTask = result.task;
      } else {
        const result = await requestJson("/api/preparation/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        savedTask = result.task;
      }

      if (taskPractice.enabled) {
        const practicePayload = {
          topic: taskPractice.topic.trim(),
          section: taskPractice.section,
          date: taskPractice.date,
          total: Number(taskPractice.total),
          attempted: Number(taskPractice.attempted),
          correct: Number(taskPractice.correct),
          minutes: taskPractice.minutes === "" ? "" : Number(taskPractice.minutes),
          mistake: taskPractice.mistake,
          revisionDate: taskPractice.revisionDate,
          notes: taskPractice.notes,
          relatedTaskId: savedTask._id,
        };
        await requestJson("/api/preparation/topic-sessions", {
          method: "POST",
          body: JSON.stringify(practicePayload),
        });
      }

      setNotice(taskPractice.enabled
        ? "Task and practice session saved."
        : editingId ? "Task changes saved." : "Task added.");
      resetForm();
      await loadTasks(selectedDate, { keepNotice: true });
    } catch (saveError) {
      if (savedTask) {
        setEditingId(savedTask._id);
        await loadTasks(selectedDate, { keepNotice: true });
        setError(`Task saved, but its practice session was not: ${saveError.message || "please check the practice details and retry."}`);
      } else {
        setError(saveError.message || "Could not save this task. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function editTask(task) {
    setEditingId(task._id);
    setForm(
      Object.fromEntries(
        FIELD_NAMES.map((field) => [
          field,
          task[field] == null ? "" : String(task[field]),
        ]),
      ),
    );
    setTaskPractice({
      ...DEFAULT_TASK_PRACTICE,
      topic: task.title || "",
      section: ["VARC", "DILR", "Quant"].includes(task.section) ? task.section : "VARC",
      date: task.date || selectedDate,
      attempted: task.attempted == null ? "" : String(task.attempted),
      correct: task.correct == null ? "" : String(task.correct),
      minutes: task.actual == null ? "" : String(task.actual),
    });
    setError("");
    setNotice("");
    try {
      const result = await requestJson(
        `/api/preparation/topic-sessions?relatedTaskId=${encodeURIComponent(task._id)}&limit=1`,
      );
      const session = result.sessions?.[0];
      if (session) {
        setTaskPractice({
          enabled: true,
          topic: session.topic || task.title || "",
          section: session.section || "VARC",
          date: session.date || task.date || selectedDate,
          total: String(session.total ?? ""),
          attempted: String(session.attempted ?? ""),
          correct: String(session.correct ?? ""),
          minutes: session.minutes == null ? "" : String(session.minutes),
          mistake: session.mistake || "",
          revisionDate: session.revisionDate || "",
          notes: session.notes || "",
        });
      }
    } catch (lookupError) {
      setError(`Could not check for a linked practice session: ${lookupError.message}`);
    }
    document.getElementById("taskTitle")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateTask(id, updates, successMessage) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/preparation/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setNotice(successMessage);
      await loadTasks(selectedDate, { keepNotice: true });
    } catch (updateError) {
      setError(updateError.message || "Could not update this task. Try again.");
      await loadTasks(selectedDate, { keepNotice: true });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm("Remove this task?")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/preparation/tasks/${task._id}`, { method: "DELETE" });
      if (editingId === task._id) resetForm();
      setNotice("Task removed.");
      await loadTasks(selectedDate, { keepNotice: true });
    } catch (deleteError) {
      setError(deleteError.message || "Could not remove this task. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDayTasks() {
    if (!dayTasks.length || !window.confirm("Delete all tasks for this date?")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await Promise.all(
        dayTasks.map((task) =>
          requestJson(`/api/preparation/tasks/${task._id}`, { method: "DELETE" }),
        ),
      );
      resetForm();
      setNotice("Tasks for this date were deleted.");
      await loadTasks(selectedDate, { keepNotice: true });
    } catch (deleteError) {
      setError(
        `${deleteError.message || "Could not delete every task."} The list has been refreshed; check which tasks remain.`,
      );
      await loadTasks(selectedDate, { keepNotice: true });
    } finally {
      setSaving(false);
    }
  }

  async function exportTasksCsv() {
    setError("");
    setNotice("");
    try {
      const allTasks = [];
      let page = 1;
      let pages = 1;
      do {
        const result = await requestJson(`/api/preparation/tasks?page=${page}&limit=500`);
        allTasks.push(...result.tasks);
        pages = result.pagination.pages;
        page += 1;
      } while (page <= pages);
      const headers = [
        "date", "task", "section", "priority", "start_time", "end_time",
        "planned_minutes", "status", "attempted", "correct", "actual_minutes", "notes",
      ];
      const rows = allTasks.map((task) => {
        const values = {
          date: task.date,
          task: task.title,
          section: task.section,
          priority: task.priority,
          start_time: task.startTime,
          end_time: task.endTime,
          planned_minutes: task.planned,
          status: task.status,
          attempted: task.attempted,
          correct: task.correct,
          actual_minutes: task.actual,
          notes: task.notes,
        };
        return headers
          .map((header) => `"${String(values[header] ?? "").replace(/"/g, '""')}"`)
          .join(",");
      });
      download(
        "CAT_2027_Tasks.csv",
        [headers.join(","), ...rows].join("\r\n"),
        "text/csv;charset=utf-8;",
      );
      setNotice("Task CSV downloaded.");
    } catch (exportError) {
      setError(exportError.message || "Could not export tasks. Try again.");
    }
  }

  function updateReflectionField(event) {
    const { name, value } = event.target;
    setReflection((current) => ({ ...current, [name]: value }));
  }

  async function saveDailyReflection(event) {
    event.preventDefault();
    setReflectionSaving(true);
    setReflectionError("");
    setReflectionNotice("");

    if (reflection.hours !== "" && reflection.hours != null) {
      const num = Number(reflection.hours);
      if (isNaN(num) || num < 0 || Math.abs(Math.round(num * 4) - num * 4) > 1e-9) {
        setReflectionError(
          "Focused study hours must use quarter-hour increments (e.g., 0.25, 0.5, 1.75).",
        );
        setReflectionSaving(false);
        return;
      }
    }

    try {
      const payload = {
        date: selectedDate,
        plan: reflection.plan,
        actual: reflection.actual,
        hours: reflection.hours === "" ? null : Number(reflection.hours),
        focus: reflection.focus,
        win: reflection.win,
        weak: reflection.weak,
        tomorrow: reflection.tomorrow,
      };

      const result = await requestJson("/api/preparation/reflections", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.reflection) {
        setReflectionId(result.reflection._id);
        setReflection({
          plan: result.reflection.plan || "",
          actual: result.reflection.actual || "",
          hours:
            result.reflection.hours != null ? String(result.reflection.hours) : "",
          focus: result.reflection.focus || "",
          win: result.reflection.win || "",
          weak: result.reflection.weak || "",
          tomorrow: result.reflection.tomorrow || "",
        });
      }
      setReflectionNotice("Saved ✓");
      window.setTimeout(() => setReflectionNotice(""), 3500);
    } catch (saveError) {
      setReflectionError(saveError.message || "Could not save daily reflection.");
    } finally {
      setReflectionSaving(false);
    }
  }

  async function clearDailyReflection() {
    if (!window.confirm("Delete daily reflection for this date?")) return;
    setReflectionSaving(true);
    setReflectionError("");
    setReflectionNotice("");
    try {
      if (reflectionId) {
        await requestJson(`/api/preparation/reflections/${reflectionId}`, {
          method: "DELETE",
        });
      } else {
        await requestJson(
          `/api/preparation/reflections?date=${encodeURIComponent(selectedDate)}`,
          { method: "DELETE" },
        );
      }
      setReflection(DEFAULT_REFLECTION);
      setReflectionId("");
      setReflectionNotice("Daily reflection deleted.");
      window.setTimeout(() => setReflectionNotice(""), 3500);
    } catch (deleteError) {
      setReflectionError(deleteError.message || "Could not delete daily reflection.");
    } finally {
      setReflectionSaving(false);
    }
  }

  async function copyPlan() {
    const text = [
      `CAT 2027 study plan — ${formatDate(selectedDate)}`,
      dayTasks.length
        ? dayTasks
          .slice()
          .sort(taskOrder)
          .map((task, i) => {
            const time =
              task.startTime || task.endTime
                ? `[${task.startTime || "—"}–${task.endTime || "—"}] `
                : "";
            return `${i + 1}. ${time}[${task.section}] ${task.title} — ${task.planned || 0} min; priority: ${task.priority}; status: ${task.status}`;
          })
          .join("\n")
        : "No tasks added yet.",
      "",
      `Available/focused hours: ${reflection.hours || "not entered"}`,
      `My priorities: ${reflection.plan || "not entered"}`,
      "",
      "Critique this plan honestly for my current CAT preparation level. Is it enough? What should I add, remove, or change? Check balance, realistic workload, practice, revision, and analysis. Ask for missing context rather than assuming.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setNotice("Plan copied to clipboard.");
      setError("");
    } catch {
      setError("Could not copy the plan. Check clipboard permissions.");
    }
  }

  return (
    <div className={`cat-diary${darkMode ? " cat-diary-dark" : ""}`}>
      <header className="diary-header">
        <div className="diary-wrap diary-header-content">
          <div>
            <h1>CAT 2027 · Preparation Diary</h1>
            <p>A colorful, editable study planner, performance diary, revision system and CAT adviser dashboard.</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Theme toggle */}
            <button
              type="button"
              className="diary-theme-toggle"
              aria-pressed={darkMode}
              onClick={toggleTheme}
              title={darkMode ? "Switch to Light mode" : "Switch to Dark mode"}
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>

            {/* Profile dropdown */}
            <div className="profile-dropdown-wrap" style={{ position: "relative" }}>
              <button
                type="button"
                className="diary-theme-toggle profile-btn"
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                id="profileMenuBtn"
              >
                👤 {user?.fullName || user?.username || "Account"} ▾
              </button>

              {profileOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 199 }}
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="profile-menu" role="menu" aria-labelledby="profileMenuBtn">
                    <div className="profile-menu-header">
                      <div className="profile-avatar">
                        {(user?.fullName || user?.username || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="profile-name">{user?.fullName || user?.username || "User"}</div>
                        {user?.email ? <div className="profile-email">{user.email}</div> : null}
                      </div>
                    </div>
                    <hr className="profile-divider" />
                    <button
                      type="button"
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => { setProfileOpen(false); toggleTheme(); }}
                    >
                      {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}
                    </button>
                    <button
                      type="button"
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => { setProfileOpen(false); setPwdError(""); setPwdNotice(""); setPwdForm({ current: "", next: "", confirm: "" }); setShowChangePwd(true); }}
                    >
                      🔑 Change password
                    </button>
                    <hr className="profile-divider" />
                    <button
                      type="button"
                      className="profile-menu-item profile-menu-signout"
                      role="menuitem"
                      onClick={() => { setProfileOpen(false); handleSignOut(); }}
                    >
                      🚪 Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Change Password Modal */}
          {showChangePwd && (
            <div className="cpwd-overlay" role="dialog" aria-modal="true" aria-label="Change password">
              <div className="cpwd-modal">
                <div className="cpwd-header">
                  <h2>🔑 Change Password</h2>
                  <button type="button" className="cpwd-close" onClick={() => setShowChangePwd(false)} aria-label="Close">✕</button>
                </div>
                <form onSubmit={handleChangePassword}>
                  <div className="cpwd-field">
                    <label htmlFor="cpwdCurrent">Current password</label>
                    <input
                      id="cpwdCurrent"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={pwdForm.current}
                      onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
                      placeholder="Your current password"
                    />
                  </div>
                  <div className="cpwd-field">
                    <label htmlFor="cpwdNew">New password</label>
                    <input
                      id="cpwdNew"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={pwdForm.next}
                      onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="cpwd-field">
                    <label htmlFor="cpwdConfirm">Confirm new password</label>
                    <input
                      id="cpwdConfirm"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={pwdForm.confirm}
                      onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))}
                      placeholder="Repeat new password"
                    />
                  </div>
                  {pwdError && <p className="cpwd-error" role="alert">{pwdError}</p>}
                  {pwdNotice && <p className="cpwd-notice" role="status">{pwdNotice}</p>}
                  <div className="cpwd-actions">
                    <button type="submit" className="diary-primary" disabled={pwdSaving}>
                      {pwdSaving ? "Saving…" : "Change password"}
                    </button>
                    <button type="button" onClick={() => setShowChangePwd(false)} disabled={pwdSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="diary-main">
        <Dashboard />
        <nav className="tabs" role="tablist" aria-label="Preparation views">
          <button
            type="button"
            className={`tab${currentView === "diary" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "diary"}
            onClick={() => setCurrentView("diary")}
          >
            Daily diary
          </button>

          <button
            type="button"
            className={`tab${currentView === "week" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "week"}
            onClick={() => setCurrentView("week")}
          >
            Weekly review
          </button>
          <button
            type="button"
            className={`tab${currentView === "month" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "month"}
            onClick={() => setCurrentView("month")}
          >
            Monthly review
          </button>
          <button
            type="button"
            className={`tab${currentView === "topicdash" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "topicdash"}
            onClick={() => setCurrentView("topicdash")}
          >
            📈 Topic dashboard
          </button>
          <button
            type="button"
            className={`tab${currentView === "syllabus" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "syllabus"}
            onClick={() => setCurrentView("syllabus")}
          >
            📚 Full CAT syllabus
          </button>
          <button
            type="button"
            className={`tab${currentView === "revision" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "revision"}
            onClick={() => setCurrentView("revision")}
          >
            🔁 Revision queue
          </button>
          <button
            type="button"
            className={`tab${currentView === "mocks" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "mocks"}
            onClick={() => setCurrentView("mocks")}
          >
            📊 Mock analysis
          </button>
          <button
            type="button"
            className={`tab${currentView === "history" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "history"}
            onClick={() => setCurrentView("history")}
          >
            📜 History & analytics
          </button>
          <button
            type="button"
            className={`tab${currentView === "studyplan" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "studyplan"}
            onClick={() => setCurrentView("studyplan")}
          >
            📅 Next Study plan
          </button>
          <button
            type="button"
            className={`tab${currentView === "clock" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "clock"}
            onClick={() => setCurrentView("clock")}
          >
            ⏱️ Clock & timer
          </button>
          <button
            type="button"
            className={`tab${currentView === "settings" ? " active" : ""}`}
            role="tab"
            aria-selected={currentView === "settings"}
            onClick={() => setCurrentView("settings")}
          >
            ⚙️ Backup & settings
          </button>
        </nav>

        {currentView === "studyplan" ? (
          <StudyPlan
            onOpenDate={(d) => {
              setSelectedDate(d);
              setCurrentView("diary");
            }}
          />
        ) : currentView === "history" ? (
          <HistoryAnalytics
            onOpenDate={(d) => {
              setSelectedDate(d);
              setCurrentView("diary");
            }}
          />
        ) : currentView === "clock" ? (
          <StudyTimer />
        ) : currentView === "settings" ? (
          <BackupSettings
            onDataReset={() => {
              loadTasks(selectedDate);
              loadReflection(selectedDate);
            }}
          />
        ) : currentView === "week" ? (
          <WeeklyReview />
        ) : currentView === "month" ? (
          <MonthlyReview />
        ) : currentView === "topicdash" ? (
          <TopicDashboard />
        ) : currentView === "syllabus" ? (
          <SyllabusTracker />
        ) : currentView === "revision" ? (
          <RevisionQueue />
        ) : currentView === "mocks" ? (
          <MockTests />
        ) : (
          <>
            <section className="diary-stats" aria-label="Daily task statistics">
              <div className="diary-stat"><small>Tasks today</small><strong>{dayTasks.length}</strong></div>
              <div className="diary-stat"><small>Completed today</small><strong>{completed}</strong></div>
              <div className="diary-stat"><small>Completion</small><strong>{completion}%</strong></div>
              <div className="diary-stat"><small>Focused hours today</small><strong id="hoursToday">{reflection.hours !== "" && reflection.hours != null ? reflection.hours : "0"}</strong></div>
            </section>

            <section className="diary-panel">
              <div className="diary-topbar diary-day-topbar">
                <h2>Daily diary</h2>
                <div className="diary-controls diary-day-navigation" role="group" aria-label="Daily diary date navigation">
                  <button type="button" className="diary-day-nav-btn" onClick={() => setSelectedDate((date) => addDays(date, -1))}>← Previous day</button>
                  <div className="diary-day-date-control">
                    <label htmlFor="dayDate">Selected date</label>
                    <input
                      id="dayDate"
                      type="date"
                      lang="en-GB"
                      aria-label="Selected date (DD/MM/YYYY)"
                      value={selectedDate}
                      onChange={(event) => changeDate(event.target.value)}
                    />
                    <div className="diary-date-format-hint">DD/MM/YYYY · Choose any date</div>
                  </div>
                  <button type="button" className="diary-day-nav-btn" onClick={() => setSelectedDate((date) => addDays(date, 1))}>Next day →</button>
                  <button type="button" className="diary-primary" onClick={() => setSelectedDate(localDateString())}>Today</button>
                </div>
              </div>
              <div className="diary-notice diary-small">
                At the end of the day, use ✓ Done for completed tasks or ✕ Not done for tasks you did not complete. Keep tasks specific. After entering your plan, you can copy it and ask ChatGPT whether the workload is enough.
              </div>
              <div className="diary-progressbar" aria-label={`${completion}% tasks completed`}>
                <span style={{ width: `${completion}%` }} />
              </div>
              <p className="diary-muted diary-small">
                {dayTasks.length
                  ? `${completed} of ${dayTasks.length} tasks completed (${completion}%). ${partlyDone} partly done, ${skipped} skipped.`
                  : "No tasks yet."}
              </p>

              <h2 className="diary-form-heading">Add a task / edit selected task</h2>
              <form onSubmit={saveTask}>
                <div className="diary-formgrid">
                  <div className="diary-wide">
                    <label htmlFor="taskTitle">Task *</label>
                    <input id="taskTitle" name="title" required maxLength={300} value={form.title} onChange={updateField} placeholder="e.g., Solve 15 Time & Work questions and review errors" />
                  </div>
                  <div>
                    <label htmlFor="taskSection">Section</label>
                    <select id="taskSection" name="section" value={form.section} onChange={updateField}>{SECTIONS.map((section) => <option key={section}>{section}</option>)}</select>
                  </div>
                  <div>
                    <label htmlFor="taskPriority">Priority</label>
                    <select id="taskPriority" name="priority" value={form.priority} onChange={updateField}>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
                  </div>
                  <div>
                    <label htmlFor="taskMinutes">Planned minutes</label>
                    <input id="taskMinutes" name="planned" type="number" min="0" step="1" value={form.planned} onChange={updateField} placeholder="45" />
                  </div>
                  <div>
                    <label htmlFor="taskStartTime">Start time (optional)</label>
                    <input id="taskStartTime" name="startTime" type="text" value={form.startTime} onChange={updateField} placeholder="07:00 AM" inputMode="text" aria-describedby="taskTimeHint" />
                  </div>
                  <div>
                    <label htmlFor="taskEndTime">End time (optional)</label>
                    <input id="taskEndTime" name="endTime" type="text" value={form.endTime} onChange={updateField} placeholder="09:00 AM" inputMode="text" aria-describedby="taskTimeHint" />
                  </div>
                  <div className="diary-wide diary-small diary-muted" id="taskTimeHint">Use 12-hour format with AM/PM, e.g. 07:00 AM. Tasks sort from earliest to latest; unscheduled tasks appear afterwards.</div>
                  <div>
                    <label htmlFor="taskStatus">Status</label>
                    <select id="taskStatus" name="status" value={form.status} onChange={updateField}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
                  </div>
                  <div>
                    <label htmlFor="taskAttempted">Questions attempted</label>
                    <input id="taskAttempted" name="attempted" type="number" min="0" step="1" value={form.attempted} onChange={updateField} placeholder="0" />
                  </div>
                  <div>
                    <label htmlFor="taskCorrect">Correct answers</label>
                    <input id="taskCorrect" name="correct" type="number" min="0" step="1" value={form.correct} onChange={updateField} placeholder="0" />
                  </div>
                  <div>
                    <label htmlFor="taskActual">Actual minutes</label>
                    <input id="taskActual" name="actual" type="number" min="0" step="1" value={form.actual} onChange={updateField} placeholder="0" />
                  </div>
                  <div className="diary-wide">
                    <label htmlFor="taskNotes">Notes / mistakes / next action</label>
                    <textarea id="taskNotes" name="notes" maxLength={5000} value={form.notes} onChange={updateField} placeholder="What was difficult? What should you revise?" />
                  </div>
                  <div className="diary-wide">
                    <label className="diary-practice-toggle">
                      <input
                        type="checkbox"
                        name="enabled"
                        checked={taskPractice.enabled}
                        onChange={updateTaskPractice}
                      />
                      Also log this practice in Topic Dashboard
                    </label>
                    <p className="diary-muted diary-small">
                      Only enable this after practice has happened. Existing linked sessions are updated rather than duplicated.
                    </p>
                  </div>
                  {taskPractice.enabled ? (
                    <>
                      <div>
                        <label htmlFor="taskPracticeTopic">Topic *</label>
                        <input id="taskPracticeTopic" name="topic" required maxLength={200} value={taskPractice.topic || form.title} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeSection">Practice section *</label>
                        <select id="taskPracticeSection" name="section" required value={taskPractice.section} onChange={updateTaskPractice}>
                          {["VARC", "DILR", "Quant"].map((section) => <option key={section}>{section}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="taskPracticeDate">Practice date *</label>
                        <input id="taskPracticeDate" name="date" type="date" required value={taskPractice.date || selectedDate} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeTotal">Total questions *</label>
                        <input id="taskPracticeTotal" name="total" type="number" min="1" step="1" required value={taskPractice.total} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeAttempted">Questions attempted *</label>
                        <input id="taskPracticeAttempted" name="attempted" type="number" min="0" step="1" required value={taskPractice.attempted} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeCorrect">Correct answers *</label>
                        <input id="taskPracticeCorrect" name="correct" type="number" min="0" step="1" required value={taskPractice.correct} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeMinutes">Time taken (minutes)</label>
                        <input id="taskPracticeMinutes" name="minutes" type="number" min="0" step="1" value={taskPractice.minutes} onChange={updateTaskPractice} />
                      </div>
                      <div>
                        <label htmlFor="taskPracticeMistake">Main difficulty</label>
                        <select id="taskPracticeMistake" name="mistake" value={taskPractice.mistake} onChange={updateTaskPractice}>
                          {["", "Concept not clear", "Calculation error", "Misread question", "Time pressure", "Guessing / poor elimination", "Forgot method", "Careless error", "Other"].map((mistake) => <option key={mistake} value={mistake}>{mistake || "Choose if useful"}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="taskPracticeRevision">Next revision (optional)</label>
                        <input id="taskPracticeRevision" name="revisionDate" type="date" value={taskPractice.revisionDate} onChange={updateTaskPractice} />
                      </div>
                      <div className="diary-wide">
                        <label htmlFor="taskPracticeNotes">Practice notes (optional)</label>
                        <textarea id="taskPracticeNotes" name="notes" maxLength={5000} value={taskPractice.notes} onChange={updateTaskPractice} />
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="diary-formactions">
                  <button className="diary-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "＋ Add task"}</button>
                  {editingId ? <button type="button" disabled={saving} onClick={resetForm}>Cancel edit</button> : null}
                  <button type="button" disabled={saving} onClick={resetForm}>Clear form</button>
                </div>
              </form>

              <div className="diary-topbar diary-task-heading">
                <h2>Tasks for this date</h2>
                <div className="diary-controls">
                  <select aria-label="Filter tasks by section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                    <option value="All">All sections</option>{SECTIONS.map((section) => <option key={section}>{section}</option>)}
                  </select>
                  <select aria-label="Filter tasks by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="All">All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <button type="button" disabled={!dayTasks.length} onClick={copyPlan}>Copy plan for ChatGPT</button>
                  <button type="button" className="diary-danger" disabled={!dayTasks.length || saving} onClick={deleteDayTasks}>Delete day&apos;s tasks</button>
                </div>
              </div>

              {loading ? <div className="diary-empty" role="status">Loading tasks…</div> : null}
              {!loading && visibleTasks.length === 0 ? <div className="diary-empty">No tasks match this date/filter. Add your first task above.</div> : null}
              {!loading && visibleTasks.length ? (
                <div className="diary-tasklist">
                  {visibleTasks.map((task) => (
                    <article key={task._id} className={`diary-task${task.status === "Done" ? " diary-task-done" : task.status === "Not done" ? " diary-task-notdone" : ""}`}>
                      <input
                        type="checkbox"
                        aria-label={`Mark ${task.title} done`}
                        checked={task.status === "Done"}
                        disabled={saving}
                        onChange={(event) => updateTask(task._id, { status: event.target.checked ? "Done" : "Not started" }, event.target.checked ? "Task marked done." : "Task marked not started.")}
                      />
                      <div>
                        <div className="diary-task-title">{task.title}</div>
                        <div className="diary-meta">
                          <span className="diary-pill">{task.section}</span>
                          <span className={`diary-pill${task.priority === "Must do" ? " diary-pill-high" : ""}`}>{task.priority}</span>
                          <span className="diary-pill">{task.planned || 0} planned min</span>
                          {task.startTime || task.endTime ? <span className="diary-pill">🕒 {task.startTime || "—"}–{task.endTime || "—"}</span> : null}
                          <span className={`diary-pill${task.status === "Done" ? " diary-pill-done" : ""}`}>{task.status}</span>
                          {task.attempted != null ? <span className="diary-pill">{task.correct || 0}/{task.attempted} correct</span> : null}
                          {task.actual ? <span className="diary-pill">{task.actual} actual min</span> : null}
                        </div>
                        {task.notes ? <div className="diary-task-notes">{task.notes}</div> : null}
                      </div>
                      <div className="diary-task-buttons">
                        <button type="button" className="diary-mark-done" disabled={saving} onClick={() => updateTask(task._id, { status: "Done" }, "Task marked done.")}>✓ Done</button>
                        <button type="button" className="diary-mark-notdone" disabled={saving} onClick={() => updateTask(task._id, { status: "Not done" }, "Task marked not done.")}>✕ Not done</button>
                        <button type="button" disabled={saving} onClick={() => editTask(task)}>Edit</button>
                        <button type="button" className="diary-danger" disabled={saving} onClick={() => deleteTask(task)}>Remove</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {error ? <p className="diary-feedback diary-feedback-error" role="alert">{error}</p> : null}
              {error && !loading ? <button type="button" onClick={() => loadTasks(selectedDate)}>Reload tasks</button> : null}
              {notice ? <p className="diary-feedback" role="status">{notice}</p> : null}

              <h2 style={{ marginTop: "24px" }}>Daily reflection</h2>
              <form onSubmit={saveDailyReflection}>
                <div className="journalgrid">
                  <div>
                    <label htmlFor="reflectionPlan">Top 3 priorities</label>
                    <textarea
                      id="reflectionPlan"
                      name="plan"
                      placeholder="What mattered most today?"
                      value={reflection.plan}
                      onChange={updateReflectionField}
                    />
                  </div>
                  <div>
                    <label htmlFor="reflectionActual">What did I actually complete?</label>
                    <textarea
                      id="reflectionActual"
                      name="actual"
                      placeholder="Be factual, not optimistic."
                      value={reflection.actual}
                      onChange={updateReflectionField}
                    />
                  </div>
                  <div>
                    <label htmlFor="reflectionHours">Focused study hours</label>
                    <input
                      id="reflectionHours"
                      name="hours"
                      type="number"
                      min="0"
                      step=".25"
                      placeholder="e.g., 5.5"
                      value={reflection.hours}
                      onChange={updateReflectionField}
                    />
                  </div>
                  <div>
                    <label htmlFor="reflectionFocus">Focus / energy (1–5)</label>
                    <select
                      id="reflectionFocus"
                      name="focus"
                      value={reflection.focus}
                      onChange={updateReflectionField}
                    >
                      <option value="">Choose</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reflectionWin">Best thing learned</label>
                    <textarea
                      id="reflectionWin"
                      name="win"
                      value={reflection.win}
                      onChange={updateReflectionField}
                    />
                  </div>
                  <div>
                    <label htmlFor="reflectionWeak">Biggest weakness / distraction</label>
                    <textarea
                      id="reflectionWeak"
                      name="weak"
                      value={reflection.weak}
                      onChange={updateReflectionField}
                    />
                  </div>
                  <div className="wide">
                    <label htmlFor="reflectionTomorrow">What to change tomorrow</label>
                    <textarea
                      id="reflectionTomorrow"
                      name="tomorrow"
                      value={reflection.tomorrow}
                      onChange={updateReflectionField}
                    />
                  </div>
                </div>
                <div className="formactions diary-formactions">
                  <button
                    className="primary diary-primary"
                    type="submit"
                    disabled={reflectionSaving}
                  >
                    {reflectionSaving ? "Saving…" : "Save daily reflection"}
                  </button>
                  {reflectionId ? (
                    <button
                      type="button"
                      className="diary-danger"
                      disabled={reflectionSaving}
                      onClick={clearDailyReflection}
                    >
                      Delete reflection
                    </button>
                  ) : null}
                  {reflectionNotice ? (
                    <span
                      className="diary-small diary-muted"
                      style={{ alignSelf: "center", color: "#216b3a", fontWeight: 600 }}
                      role="status"
                    >
                      {reflectionNotice}
                    </span>
                  ) : null}
                </div>
                {reflectionError ? (
                  <p className="diary-feedback diary-feedback-error" role="alert">
                    {reflectionError}
                  </p>
                ) : null}
              </form>

              <p className="diary-small diary-muted diary-migration-note">
                Topic Dashboard-linked practice and Monthly review are separate modules and are not part of this phase.
              </p>
              <div className="diary-footer-actions">
                <button type="button" onClick={exportTasksCsv}>Export tasks CSV</button>
                <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function AuthenticationGate({ onAuthenticated }) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (isRegister) {
        const result = await requestJson("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ fullName, username, email, password }),
        });
        onAuthenticated(result.user);
      } else {
        const result = await requestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ identifier, password }),
        });
        onAuthenticated(result.user);
      }
    } catch (authError) {
      setError(authError.message || (isRegister ? "Could not register account." : "Could not sign in."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="diary-auth-screen">
      <form className="diary-auth-card" onSubmit={handleSubmit}>
        <span className="diary-auth-kicker">CAT PREP · PREPARATION DIARY</span>
        <h1>{isRegister ? "Create your account." : "Pick up your pace."}</h1>
        <p>{isRegister ? "Sign up to start tracking your CAT preparation." : "Sign in to load your saved study tasks."}</p>
        {isRegister ? (
          <>
            <label htmlFor="regFullName">Full name</label>
            <input
              id="regFullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
            <label htmlFor="regUsername">Username</label>
            <input
              id="regUsername"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <label htmlFor="regEmail">Email address</label>
            <input
              id="regEmail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </>
        ) : (
          <>
            <label htmlFor="authIdentifier">Email or username</label>
            <input
              id="authIdentifier"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </>
        )}
        <label htmlFor="authPassword">Password</label>
        <input
          id="authPassword"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p className="diary-feedback-error" role="alert">{error}</p> : null}
        <button className="diary-primary" disabled={submitting}>
          {submitting ? "One moment…" : isRegister ? "Create account" : "Sign in"}
        </button>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#68708a", textAlign: "center" }}>
          {isRegister ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#5b4bc4",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
              fontWeight: 600,
            }}
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
      </form>
    </main>
  );
}

export default function Home() {
  const [authState, setAuthState] = useState({ status: "checking", user: null, error: "" });

  const loadSession = useCallback(async () => {
    try {
      const result = await requestJson("/api/auth/me");
      setAuthState({ status: "authenticated", user: result.user, error: "" });
    } catch (error) {
      if (error.status === 401) {
        setAuthState({ status: "unauthenticated", user: null, error: "" });
      } else {
        setAuthState({ status: "error", user: null, error: error.message || "Could not verify your session." });
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadSession, 0);
    return () => window.clearTimeout(timer);
  }, [loadSession]);

  if (authState.status === "checking") {
    return <main className="diary-session-state" role="status">Checking your session…</main>;
  }
  if (authState.status === "error") {
    return (
      <main className="diary-session-state" role="alert">
        <p>{authState.error}</p>
        <button type="button" onClick={loadSession}>Try again</button>
      </main>
    );
  }
  if (authState.status === "unauthenticated") {
    return <AuthenticationGate onAuthenticated={(user) => setAuthState({ status: "authenticated", user, error: "" })} />;
  }
  return (
    <DailyDiary
      key={authState.user?.id || "authenticated"}
      user={authState.user}
      onSignOut={() => setAuthState({ status: "unauthenticated", user: null, error: "" })}
    />
  );
}
