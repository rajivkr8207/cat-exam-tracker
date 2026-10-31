
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function getRecommendations({ tasks, topics, revisions, mocks, today }) {
  const suggestions = [];

  const dueRevisions = revisions.filter(
    (r) =>
      r.date &&
      r.date <= today &&
      r.result !== "Correct independently"
  );

  const weakTopics = topics.filter((t) =>
    ["Weak", "Learning", "Practising"].includes(t.status)
  );

  const pendingTasks = tasks.filter(
    (t) =>
      t.date < today &&
      ["Not started", "In progress", "Partly done", "Not done", "Rescheduled"].includes(t.status)
  );

  const todayTasks = tasks.filter((t) => t.date === today);

  // Revision priority
  if (dueRevisions.length > 0) {
    suggestions.push({
      type: "revision",
      priority: "High",
      icon: "🔁",
      title: "Revision should come first",
      reason: `${dueRevisions.length} revision item(s) are due or overdue.`,
      action: "Choose your 1–3 most important revision items. Solve them independently before checking the answers.",
    });
  }

  // Weak topics
  if (weakTopics.length > 0) {
    suggestions.push({
      type: "topic",
      priority: "High",
      icon: "🎯",
      title: "Improve your weak topics",
      reason: weakTopics
        .slice(0, 4)
        .map((t) => `${t.name} (${t.section})`)
        .join(", "),
      action: "Choose one weak topic. Revise its concept, solve practice questions and record your mistakes.",
    });
  }

  // Pending tasks
  if (pendingTasks.length > 0) {
    suggestions.push({
      type: "backlog",
      priority: "Medium",
      icon: "📌",
      title: "Clear your important backlog",
      reason: `${pendingTasks.length} unfinished task(s) are from earlier dates.`,
      action: "Reschedule only the important tasks. Avoid moving your entire backlog to today.",
    });
  }

  // Today's plan
  if (todayTasks.length === 0) {
    suggestions.push({
      type: "planning",
      priority: "High",
      icon: "📝",
      title: "Create today's study plan",
      reason: "No tasks have been added for today.",
      action: "Add 2–4 specific tasks with a clear target and realistic time estimate.",
    });
  } else {
    const sections = new Set(todayTasks.map((t) => t.section));

    ["VARC", "DILR", "Quant"].forEach((section) => {
      if (!sections.has(section)) {
        suggestions.push({
          type: "balance",
          priority: "Medium",
          icon: "⚖️",
          title: `${section} is missing from today's plan`,
          reason: `No ${section} task is currently planned for today.`,
          action: `Consider adding a short ${section} practice session if it fits your current priorities.`,
        });
      }
    });

    if (todayTasks.length > 7) {
      suggestions.push({
        type: "workload",
        priority: "High",
        icon: "⚠️",
        title: "Your workload may be too high",
        reason: `${todayTasks.length} tasks are planned for today.`,
        action: "Prioritise the most valuable tasks. Keep enough time for practice analysis and breaks.",
      });
    }

    const mustDoCount = todayTasks.filter(
      (t) => t.priority === "Must do"
    ).length;

    if (mustDoCount > 4) {
      suggestions.push({
        type: "priority",
        priority: "Medium",
        icon: "⭐",
        title: "Reduce your Must do list",
        reason: `You have ${mustDoCount} Must do tasks.`,
        action: "Keep only the most important tasks as Must do. Move the remaining tasks to a later date.",
      });
    }
  }

  // Latest mock test
  const latestMock = [...mocks]
    .filter((m) => m.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  if (latestMock?.loss || latestMock?.action) {
    suggestions.push({
      type: "mock",
      priority: "Medium",
      icon: "📊",
      title: "Follow up on your latest mock test",
      reason: latestMock.loss || "You have recorded a mock test action.",
      action: latestMock.action || "Review your incorrect and unattempted questions.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: "general",
      priority: "Medium",
      icon: "✅",
      title: "Keep your preparation consistent",
      reason: "No major issues were identified from your saved data.",
      action: "Complete one focused practice block, analyse your mistakes and update your study tracker.",
    });
  }

  return suggestions;
}

export default function NextStudyPlan() {
  const today = useMemo(() => getToday(), []);

  const [tasks, setTasks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [mocks, setMocks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [tasksRes, topicsRes, revisionsRes, mocksRes] =
        await Promise.all([
          requestJson("/api/preparation/tasks?limit=500"),
          requestJson("/api/preparation/topics"),
          requestJson("/api/preparation/revisions"),
          requestJson("/api/preparation/mock-tests"),
        ]);

      setTasks(tasksRes.tasks || []);
      setTopics(topicsRes.topics || []);
      setRevisions(revisionsRes.revisions || []);
      setMocks(mocksRes.mockTests || []);
    } catch (err) {
      setError(err.message || "Could not load study recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recommendations = useMemo(
    () =>
      getRecommendations({
        tasks,
        topics,
        revisions,
        mocks,
        today,
      }),
    [tasks, topics, revisions, mocks, today, refreshCount]
  );

  const highPriority = recommendations.filter(
    (item) => item.priority === "High"
  ).length;

  const report = useMemo(() => {
    return [
      `CAT 2027 NEXT STUDY PLAN — ${formatDate(today)}`,
      "",
      "RECOMMENDED ACTIONS:",
      ...recommendations.map(
        (item, index) =>
          `${index + 1}. ${item.title}\nPriority: ${item.priority}\nReason: ${item.reason}\nAction: ${item.action}`
      ),
      "",
      "TODAY'S TASKS:",
      ...(
        tasks
          .filter((t) => t.date === today)
          .map((t, index) =>
            `${index + 1}. ${t.section}: ${t.title} — ${t.planned || 0} minutes (${t.status})`
          ).length
          ? tasks
            .filter((t) => t.date === today)
            .map((t, index) =>
              `${index + 1}. ${t.section}: ${t.title} — ${t.planned || 0} minutes (${t.status})`
            )
          : ["No tasks added."]
      ),
      "",
      "Please review this study plan and suggest realistic improvements without overloading my day.",
    ].join("\n");
  }, [recommendations, tasks, today]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the report. Please copy it manually.");
    }
  }

  return (
    <section className="diary-panel next-study-plan">
      <div className="nsp-header">
        <div>
          <span className="nsp-eyebrow">PERSONALISED STUDY GUIDANCE</span>
          <h2>✨ What should I study next?</h2>
          <p>
            Recommendations based on your saved tasks, revisions,
            topic mastery and mock tests.
          </p>
        </div>

        <button
          type="button"
          className="diary-primary"
          onClick={() => {
            setRefreshCount((n) => n + 1);
            loadData();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "↻ Refresh plan"}
        </button>
      </div>

      <div className="nsp-summary">
        <div className="nsp-summary-card">
          <span>Today's date</span>
          <strong>{formatDate(today)}</strong>
        </div>
        <div className="nsp-summary-card">
          <span>Recommendations</span>
          <strong>{recommendations.length}</strong>
        </div>
        <div className="nsp-summary-card">
          <span>High priority</span>
          <strong>{highPriority}</strong>
        </div>
        <div className="nsp-summary-card">
          <span>Saved tasks</span>
          <strong>{tasks.length}</strong>
        </div>
      </div>

      {error && <p className="diary-error">{error}</p>}

      {loading ? (
        <p className="diary-muted">Analysing your study progress…</p>
      ) : (
        <>
          <div className="nsp-list">
            {recommendations.map((item, index) => (
              <article
                className={`nsp-card nsp-${item.type}`}
                key={`${item.type}-${index}`}
              >
                <div className="nsp-card-top">
                  <div className="nsp-card-title">
                    <span className="nsp-icon">{item.icon}</span>
                    <h3>{item.title}</h3>
                  </div>

                  <span
                    className={`nsp-priority ${item.priority === "High" ? "is-high" : "is-medium"
                      }`}
                  >
                    {item.priority}
                  </span>
                </div>

                <p className="nsp-reason">{item.reason}</p>

                <div className="nsp-action">
                  <strong>Recommended action</strong>
                  <p>{item.action}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="nsp-footer">
            <div>
              <strong>Ready for your next study session?</strong>
              <p>Follow the high-priority actions first.</p>
            </div>

            <button type="button" onClick={copyReport}>
              {copied ? "✓ Copied" : "📋 Copy report"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
