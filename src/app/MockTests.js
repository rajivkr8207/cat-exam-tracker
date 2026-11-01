"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api-client";

const SECTIONS = ["VARC", "DILR", "Quant"];

function localDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value || typeof value !== "string" || !value.includes("-")) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const EMPTY_SECTION_FORM = {
  total: "",
  attempted: "",
  correct: "",
  wrongNeg: "",
  wrongNoNeg: "",
};

function calcSection(secForm) {
  const n = (x) => (x === "" || x == null ? null : Number(x));
  const total = n(secForm?.total);
  const attempted = n(secForm?.attempted);
  const correct = n(secForm?.correct);
  const wrongNeg = n(secForm?.wrongNeg);
  const wrongNoNeg = n(secForm?.wrongNoNeg);

  const hasAny = [total, attempted, correct, wrongNeg, wrongNoNeg].some((x) => x !== null);
  if (!hasAny) return null;

  const cor = correct ?? 0;
  const wn = wrongNeg ?? 0;
  const wnn = wrongNoNeg ?? 0;
  const att = attempted ?? (cor + wn + wnn);
  const incorrect = wn + wnn;
  const unattempted = total === null ? null : Math.max(0, total - att);
  const accuracy = att > 0 ? (cor / att) * 100 : null;
  const score = 3 * cor - wn;

  return {
    total,
    attempted: att,
    correct: cor,
    wrongNeg: wn,
    wrongNoNeg: wnn,
    incorrect,
    unattempted,
    accuracy,
    score,
  };
}

export default function MockTests() {
  const [mocks, setMocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Form State
  const [editingId, setEditingId] = useState("");
  const [mode, setMode] = useState("full"); // "full" or "sectional"
  const [testSection, setTestSection] = useState("VARC");
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(() => localDateString());
  const [percentile, setPercentile] = useState("");
  const [loss, setLoss] = useState("");
  const [action, setAction] = useState("");

  // Section inputs
  const [sectionInputs, setSectionInputs] = useState({
    VARC: { ...EMPTY_SECTION_FORM, total: "24" },
    DILR: { ...EMPTY_SECTION_FORM, total: "20" },
    Quant: { ...EMPTY_SECTION_FORM, total: "22" },
  });

  // Load Mock Tests from API
  const loadMocks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await requestJson("/api/preparation/mock-tests");
      if (res?.mockTests) {
        setMocks(res.mockTests);
      }
    } catch (err) {
      setError(err.message || "Could not load mock tests. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMocks();
  }, [loadMocks]);

  // Section field changes
  function updateSectionField(sec, field, value) {
    setSectionInputs((prev) => ({
      ...prev,
      [sec]: {
        ...prev[sec],
        [field]: value,
      },
    }));
  }

  // Calculated Section Summaries
  const calculatedSummaries = useMemo(() => {
    const res = {};
    for (const sec of SECTIONS) {
      res[sec] = calcSection(sectionInputs[sec]);
    }
    return res;
  }, [sectionInputs]);

  // Calculated Overall Score and Total Attempts for Form
  const formOverall = useMemo(() => {
    const activeSections = mode === "full" ? SECTIONS : [testSection];
    let totalScore = 0;
    let totalAttempts = 0;
    let hasAnyData = false;

    for (const sec of activeSections) {
      const st = calculatedSummaries[sec];
      if (st) {
        hasAnyData = true;
        totalScore += st.score;
        totalAttempts += st.attempted;
      }
    }

    return {
      score: hasAnyData ? totalScore : "",
      attempts: hasAnyData ? totalAttempts : "",
    };
  }, [mode, testSection, calculatedSummaries]);

  // Reset form
  function resetForm() {
    setEditingId("");
    setMode("full");
    setTestSection("VARC");
    setTestName("");
    setTestDate(localDateString());
    setPercentile("");
    setLoss("");
    setAction("");
    setSectionInputs({
      VARC: { ...EMPTY_SECTION_FORM, total: "24" },
      DILR: { ...EMPTY_SECTION_FORM, total: "20" },
      Quant: { ...EMPTY_SECTION_FORM, total: "22" },
    });
    setError("");
  }

  // Edit mock
  function startEdit(mock) {
    setEditingId(mock._id);
    const mType = mock.type || "full";
    setMode(mType);
    setTestSection(mock.testSection || "VARC");
    setTestName(mock.name || "");
    setTestDate(mock.date || localDateString());
    setPercentile(mock.percentile != null ? String(mock.percentile) : "");
    setLoss(mock.loss || "");
    setAction(mock.action || "");

    const newSecInputs = {
      VARC: { ...EMPTY_SECTION_FORM, total: "24" },
      DILR: { ...EMPTY_SECTION_FORM, total: "20" },
      Quant: { ...EMPTY_SECTION_FORM, total: "22" },
    };

    for (const sec of SECTIONS) {
      const raw = mock.sections?.[sec];
      if (raw) {
        newSecInputs[sec] = {
          total: raw.total != null ? String(raw.total) : "",
          attempted: raw.attempted != null ? String(raw.attempted) : "",
          correct: raw.correct != null ? String(raw.correct) : "",
          wrongNeg: raw.wrongNeg != null ? String(raw.wrongNeg) : "",
          wrongNoNeg: raw.wrongNoNeg != null ? String(raw.wrongNoNeg) : "",
        };
      }
    }
    setSectionInputs(newSecInputs);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Helper for displaying and scrolling to errors
  function triggerError(msg) {
    setError(msg);
    setTimeout(() => {
      document.getElementById("mockFormError")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  // Form submit
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!testName.trim()) {
      triggerError("Please enter a test name (e.g. AIMCAT 01, SIMCAT 02, or Sectional Practice).");
      return;
    }
    if (!testDate) {
      triggerError("Please select or enter a valid test date.");
      return;
    }

    if (percentile !== "") {
      const p = Number(percentile);
      if (isNaN(p) || p < 0 || p > 100) {
        triggerError("Percentile must be a number between 0 and 100.");
        return;
      }
    }

    const activeSections = mode === "full" ? SECTIONS : [testSection];

    // Client-side validation per active section
    for (const sec of activeSections) {
      const inp = sectionInputs[sec];
      const countFields = [
        ["total", "total questions"],
        ["attempted", "attempted questions"],
        ["correct", "correct answers"],
        ["wrongNeg", "negative-marked incorrect answers"],
        ["wrongNoNeg", "non-negative-marked incorrect answers"],
      ];

      for (const [key, label] of countFields) {
        if (inp[key] === "") {
          triggerError(`${sec}: please enter ${label} (enter 0 if none).`);
          return;
        }
        const val = Number(inp[key]);
        if (!Number.isInteger(val) || val < 0) {
          triggerError(`${sec}: ${label} must be a non-negative whole number (0 or higher).`);
          return;
        }
      }

      const tot = Number(inp.total);
      const att = Number(inp.attempted);
      const cor = Number(inp.correct);
      const wn = Number(inp.wrongNeg);
      const wnn = Number(inp.wrongNoNeg);

      if (tot > 0 && att > tot) {
        triggerError(`${sec}: Attempted questions (${att}) cannot be greater than Total questions (${tot}).`);
        return;
      }

      const sum = cor + wn + wnn;
      if (sum !== att) {
        if (sum < att) {
          triggerError(
            `${sec}: You attempted ${att} questions, but only ${sum} are accounted for (${cor} correct + ${wn} negative-marked + ${wnn} non-negative = ${sum}). Please add the remaining ${att - sum} incorrect or unclassified question(s).`,
          );
        } else {
          triggerError(
            `${sec}: The sum of Correct (${cor}) + Negative-marked (${wn}) + Non-negative (${wnn}) = ${sum}, which is more than your Attempted count (${att}). Please adjust the counts.`,
          );
        }
        return;
      }
    }

    // Build payload
    const sectionsPayload = {};
    for (const sec of activeSections) {
      sectionsPayload[sec] = {
        total: Number(sectionInputs[sec].total),
        attempted: Number(sectionInputs[sec].attempted),
        correct: Number(sectionInputs[sec].correct),
        wrongNeg: Number(sectionInputs[sec].wrongNeg),
        wrongNoNeg: Number(sectionInputs[sec].wrongNoNeg),
      };
    }

    const payload = {
      name: testName.trim(),
      date: testDate,
      type: mode,
      testSection: mode === "sectional" ? testSection : "",
      percentile: percentile !== "" ? Number(percentile) : null,
      loss: loss.trim(),
      action: action.trim(),
      sections: sectionsPayload,
    };

    setSaving(true);
    try {
      if (editingId) {
        const res = await requestJson(`/api/preparation/mock-tests/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMocks((prev) =>
          prev.map((m) => (m._id === editingId ? res.mockTest : m)),
        );
        setNotice("Mock test updated successfully.");
      } else {
        const res = await requestJson("/api/preparation/mock-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMocks((prev) => [res.mockTest, ...prev]);
        setNotice("Mock test saved successfully.");
      }

      resetForm();
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      triggerError(err.message || "Failed to save mock test. Please check your network and try again.");
    } finally {
      setSaving(false);
    }
  }

  // Delete mock test
  async function deleteMock(id) {
    if (!window.confirm("Are you sure you want to remove this test?")) return;
    setSaving(true);
    setError("");
    setNotice("");

    const previous = [...mocks];
    setMocks((prev) => prev.filter((m) => m._id !== id));

    try {
      await requestJson(`/api/preparation/mock-tests/${id}`, {
        method: "DELETE",
      });
      setNotice("Mock test removed.");
      window.setTimeout(() => setNotice(""), 3500);
    } catch (err) {
      setMocks(previous);
      setError(err.message || "Failed to delete mock test.");
    } finally {
      setSaving(false);
    }
  }

  // Filtered & sorted lists
  const sortedMocks = useMemo(() => {
    return [...mocks].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [mocks]);

  const fullMocks = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "full");
  }, [sortedMocks]);

  const sectionalVARC = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "VARC");
  }, [sortedMocks]);

  const sectionalDILR = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "DILR");
  }, [sortedMocks]);

  const sectionalQuant = useMemo(() => {
    return sortedMocks.filter((m) => m.type === "sectional" && m.testSection === "Quant");
  }, [sortedMocks]);

  // Overall Statistics for Top Row
  const topStats = useMemo(() => {
    const totalCount = mocks.length;
    const fullCount = fullMocks.length;
    const fullScores = fullMocks.map((m) => m.score).filter((s) => s != null);
    const avgFullScore = fullScores.length
      ? (fullScores.reduce((a, b) => a + b, 0) / fullScores.length).toFixed(1)
      : "—";

    let maxFullScore = "—";
    if (fullScores.length) {
      maxFullScore = Math.max(...fullScores);
    }

    const percentiles = fullMocks.map((m) => m.percentile).filter((p) => p != null);
    const maxPercentile = percentiles.length
      ? `${Math.max(...percentiles).toFixed(1)}%ile`
      : "—";

    // Overall Accuracy across all mocks
    let allAttempts = 0;
    let allCorrect = 0;
    for (const m of mocks) {
      if (m.sections) {
        for (const sec of SECTIONS) {
          const s = m.sections[sec];
          if (s) {
            allAttempts += s.attempted || 0;
            allCorrect += s.correct || 0;
          }
        }
      }
    }
    const overallAcc = allAttempts > 0
      ? `${((allCorrect / allAttempts) * 100).toFixed(1)}%`
      : "—";

    return {
      totalCount,
      fullCount,
      avgFullScore,
      maxFullScore,
      maxPercentile,
      overallAcc,
    };
  }, [mocks, fullMocks]);

  // Helper for rendering a mock card
  function renderMockCard(m) {
    const isFull = m.type === "full";
    const tone = isFull
      ? "mock-full"
      : m.testSection === "VARC"
        ? "mock-varc"
        : m.testSection === "DILR"
          ? "mock-dilr"
          : "mock-quant";

    const secs = isFull ? SECTIONS : [m.testSection || "VARC"];

    // Aggregated stats from sections if available
    let totalQuestions = 0;
    let totalAttempted = 0;
    let totalUnattempted = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let hasSectionDetails = false;

    for (const sec of secs) {
      const s = m.sections?.[sec];
      if (s) {
        hasSectionDetails = true;
        totalQuestions += s.total || 0;
        totalAttempted += s.attempted || 0;
        totalCorrect += s.correct || 0;
        const wn = s.wrongNeg || 0;
        const wnn = s.wrongNoNeg || 0;
        totalIncorrect += wn + wnn;
        totalUnattempted += Math.max(0, (s.total || 0) - (s.attempted || 0));
      }
    }

    const accuracy = totalAttempted > 0
      ? `${((totalCorrect / totalAttempted) * 100).toFixed(1)}%`
      : null;

    return (
      <article
        key={m._id}
        id={`mock-card-${m._id}`}
        className={`task mock-saved-card ${tone}`}
      >
        <div className="badge-status">
          {m.score != null ? `${m.score} pts` : "—"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tasktitle">
            <strong>{m.name}</strong>{" "}
            <span className="muted small">· {formatDate(m.date)}</span>
          </div>

          <div className="diary-meta mock-meta" style={{ marginTop: "8px" }}>
            <span className="diary-pill">
              {isFull ? "Full-length mock" : `Sectional · ${m.testSection}`}
            </span>
            {hasSectionDetails && totalQuestions > 0 ? (
              <span className="diary-pill">Total Q: {totalQuestions}</span>
            ) : null}
            <span className="diary-pill">
              Attempted: {hasSectionDetails ? totalAttempted : m.attempts ?? "—"}
            </span>
            {hasSectionDetails ? (
              <span className="diary-pill">Unattempted: {totalUnattempted}</span>
            ) : null}
            {hasSectionDetails ? (
              <span className="diary-pill diary-pill-done">Correct: {totalCorrect}</span>
            ) : null}
            {hasSectionDetails ? (
              <span className="diary-pill diary-pill-high">Incorrect: {totalIncorrect}</span>
            ) : null}
            {accuracy ? (
              <span className="diary-pill">Accuracy: {accuracy}</span>
            ) : null}
            {m.percentile != null ? (
              <span className="diary-pill mock-percentile-pill">Percentile: {m.percentile}%ile</span>
            ) : null}
          </div>

          {/* Detailed Section Lines */}
          <div className="mock-sections-detail" style={{ marginTop: "10px" }}>
            {secs.map((sec) => {
              const s = m.sections?.[sec];
              if (!s) {
                const secScore = m[sec.toLowerCase()];
                return (
                  <div key={sec} className={`mock-sec-strip tone-${sec.toLowerCase()}`}>
                    <strong className="mock-sec-name">{sec}</strong>
                    <span>{secScore != null ? `${secScore} pts` : "details not entered"}</span>
                  </div>
                );
              }
              const secAtt = s.attempted || 0;
              const secCor = s.correct || 0;
              const secInc = (s.wrongNeg || 0) + (s.wrongNoNeg || 0);
              const secUnatt = Math.max(0, (s.total || 0) - secAtt);
              const secAcc = secAtt > 0 ? `${((secCor / secAtt) * 100).toFixed(1)}%` : "—";
              const secScore = 3 * secCor - (s.wrongNeg || 0);

              return (
                <div key={sec} className={`mock-sec-strip tone-${sec.toLowerCase()}`}>
                  <strong className="mock-sec-name">{sec}</strong>
                  <div className="mock-sec-chips">
                    <span>Attempted: <b>{secAtt}</b></span>
                    <span>Unattempted: <b>{secUnatt}</b></span>
                    <span className="mock-cor">Correct: <b>{secCor}</b></span>
                    <span className="mock-inc">Incorrect: <b>{secInc}</b></span>
                    <span>Accuracy: <b>{secAcc}</b></span>
                    <span className="mock-score-badge">Score: <b>{secScore} pts</b></span>
                  </div>
                </div>
              );
            })}
          </div>

          {m.loss ? (
            <div className="tasknotes mock-notes" style={{ marginTop: "9px" }}>
              <b>What went wrong / marks lost:</b> {m.loss}
            </div>
          ) : null}
          {m.action ? (
            <div className="tasknotes mock-notes" style={{ marginTop: "5px" }}>
              <b>Next action:</b> {m.action}
            </div>
          ) : null}
        </div>

        <div className="taskbuttons">
          <button type="button" onClick={() => startEdit(m)} disabled={saving}>
            Edit
          </button>
          <button
            type="button"
            className="danger diary-danger"
            onClick={() => deleteMock(m._id)}
            disabled={saving}
          >
            Remove
          </button>
        </div>
      </article>
    );
  }

  // Render score trend chart bars
  function renderBarChart(items, fillClass) {
    if (!items.length) {
      return <div className="empty">No scores recorded yet.</div>;
    }

    // Chronological order for chart
    const chronItems = [...items].reverse().slice(-8);
    const vals = chronItems.map((m) => ({
      label: formatDate(m.date),
      value: Number(m.score) || 0,
      name: m.name || "",
    }));

    const max = Math.max(1, ...vals.map((x) => x.value));

    return (
      <div className="ha-bars">
        {vals.map((x, i) => (
          <div key={i} className="ha-bar-row">
            <span className="ha-bar-label" title={`${x.name} · ${x.label}`}>
              {x.label}
            </span>
            <div className="ha-bar-track">
              <div
                className={`ha-bar-fill ${fillClass}`}
                style={{
                  width: `${Math.max(0, Math.min(100, (x.value / max) * 100))}%`,
                }}
              />
            </div>
            <span className="ha-bar-value">{x.value} pts</span>
          </div>
        ))}
      </div>
    );
  }

  // Trend insight text
  const fullMockTrendInsight = useMemo(() => {
    if (fullMocks.length >= 2) {
      const chron = [...fullMocks].reverse();
      const first = chron[0];
      const last = chron[chron.length - 1];
      if (first && last && first._id !== last._id) {
        return `Full mocks only: score ${first.score ?? "—"} on ${formatDate(first.date)} → score ${last.score ?? "—"} on ${formatDate(last.date)}. Review the errors and test conditions before judging the trend.`;
      }
    }
    return "Log at least two full mocks with overall scores to compare change. Sectional scores are never mixed into the full-mock chart.";
  }, [fullMocks]);

  return (
    <section id="view-mocks" className="panel diary-panel">
      {/* Top Header */}
      <div className="topbar diary-topbar">
        <div>
          <h2>📊 Mock analysis</h2>
          <p className="diary-muted diary-small">
            Choose one test type first. Full-length mocks and sectional tests are stored and compared separately.
          </p>
        </div>
        <button
          type="button"
          onClick={loadMocks}
          disabled={loading}
          style={{ fontSize: "13px", padding: "6px 12px" }}
        >
          ↻ Refresh Mocks
        </button>
      </div>



      {/* Mode Picker (Full-length vs Sectional) */}
      <div className="mock-mode-picker" role="group" aria-label="Choose test type">
        <button
          type="button"
          className={`mock-mode-choice${mode === "full" ? " active" : ""}`}
          data-mock-mode="full"
          onClick={() => setMode("full")}
        >
          Full-length test
          <span>Enter VARC, DILR and Quant results</span>
        </button>
        <button
          type="button"
          className={`mock-mode-choice${mode === "sectional" ? " active" : ""}`}
          data-mock-mode="sectional"
          onClick={() => setMode("sectional")}
        >
          Sectional test
          <span>Choose one section: VARC, DILR or Quant</span>
        </button>
      </div>

      {/* Form */}
      <form id="mockForm" onSubmit={handleSubmit}>
        <div className="mock-common-grid">
          <div>
            <label htmlFor="mockName">Test name *</label>
            <input
              id="mockName"
              required
              maxLength={200}
              placeholder="AIMCAT 01 / VARC practice test"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="mockDate">Date (DD/MM/YYYY) *</label>
            <div>
              <input
                id="mockDate"
                type="date"
                lang="en-GB"
                required
                aria-label="Test date (DD/MM/YYYY)"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
              <div className="date-format-hint">Enter DD/MM/YYYY</div>
            </div>
          </div>
          <div>
            <label htmlFor="mockPercentile">Percentile (if available)</label>
            <input
              id="mockPercentile"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0–100"
              value={percentile}
              onChange={(e) => setPercentile(e.target.value)}
            />
          </div>
        </div>

        {/* Section Picker for Sectional Mocks */}
        {mode === "sectional" ? (
          <div id="mockSectionPickerWrap" style={{ margin: "14px 0" }}>
            <h3 className="mock-section-heading">Choose the sectional test</h3>
            <div className="mock-section-picker" role="group" aria-label="Choose section">
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`mock-section-choice${testSection === sec ? " active" : ""}`}
                  data-mock-section={sec}
                  onClick={() => setTestSection(sec)}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Section Question Input Panels */}
        <div className="stats-section" style={{ marginTop: "16px" }}>
          <h3 id="mockEntryHeading">
            {mode === "full"
              ? "Enter results for all three sections"
              : `Enter results for ${testSection} only`}
          </h3>
          <div className="notice" style={{ margin: "8px 0 14px" }}>
            Enter total questions, attempted, correct, and both types of incorrect answers. Unattempted,
            accuracy and score calculate automatically. Scoring: <b>+3 correct</b>, <b>−1 negative-marked incorrect</b>,{" "}
            <b>0 unattempted or non-negative-marked incorrect</b>.
          </div>

          {SECTIONS.map((sec) => {
            const isVisible = mode === "full" || testSection === sec;
            if (!isVisible) return null;

            const inp = sectionInputs[sec];
            const st = calculatedSummaries[sec];
            const pId = sec === "VARC" ? "v" : sec === "DILR" ? "d" : "q";

            return (
              <div
                key={sec}
                id={`mockPanel-${sec}`}
                className="mock-analysis-panel mock-analysis-panel-section"
              >
                <h3>{sec}</h3>
                <div className="formgrid">
                  <div>
                    <label htmlFor={`${pId}Total`}>Total questions</label>
                    <input
                      id={`${pId}Total`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder={sec === "VARC" ? "24" : sec === "DILR" ? "20" : "22"}
                      value={inp.total}
                      onChange={(e) => updateSectionField(sec, "total", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}Attempted`}>Attempted</label>
                    <input
                      id={`${pId}Attempted`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.attempted}
                      onChange={(e) => updateSectionField(sec, "attempted", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}Correct`}>Correct</label>
                    <input
                      id={`${pId}Correct`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.correct}
                      onChange={(e) => updateSectionField(sec, "correct", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}WrongNeg`}>Incorrect (−1 marking)</label>
                    <input
                      id={`${pId}WrongNeg`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.wrongNeg}
                      onChange={(e) => updateSectionField(sec, "wrongNeg", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${pId}WrongNoNeg`}>Incorrect (no negative mark)</label>
                    <input
                      id={`${pId}WrongNoNeg`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={inp.wrongNoNeg}
                      onChange={(e) => updateSectionField(sec, "wrongNoNeg", e.target.value)}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                    <label>Section summary & question check</label>
                    <div className="diary-pill" id={`${pId}Summary`} style={{ display: "inline-block", padding: "6px 12px" }}>
                      {st
                        ? `Unattempted: ${st.unattempted ?? "—"} · Accuracy: ${st.accuracy == null ? "—" : st.accuracy.toFixed(1) + "%"} · Score: ${st.score} pts`
                        : "Unattempted: — · Accuracy: — · Score: —"}
                    </div>
                    {inp.attempted !== "" ? (() => {
                      const att = Number(inp.attempted) || 0;
                      const cor = Number(inp.correct) || 0;
                      const wn = Number(inp.wrongNeg) || 0;
                      const wnn = Number(inp.wrongNoNeg) || 0;
                      const sum = cor + wn + wnn;
                      if (sum === att) {
                        return (
                          <div className="mock-live-balance match">
                            ✓ {sec} questions balanced: {sum} of {att} attempted accounted for
                          </div>
                        );
                      }
                      return (
                        <div className="mock-live-balance mismatch">
                          ⚠️ {sec}: {sum < att ? `Missing ${att - sum} question(s). Correct (${cor}) + Incorrect (${wn + wnn}) = ${sum}, but Attempted is ${att}.` : `Overcounted by ${sum - att}. Correct (${cor}) + Incorrect (${wn + wnn}) = ${sum}, but Attempted is only ${att}.`}
                        </div>
                      );
                    })() : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calculated score and attempts row */}
        <div
          className="mock-common-grid"
          style={{ margin: "14px 0 10px", gridTemplateColumns: "1fr 1fr" }}
        >
          <div>
            <label htmlFor="mockScore">Calculated score</label>
            <input
              id="mockScore"
              type="number"
              step="any"
              readOnly
              placeholder="Calculated automatically"
              value={formOverall.score}
            />
          </div>
          <div>
            <label htmlFor="mockAttempts">Attempted (total)</label>
            <input
              id="mockAttempts"
              type="number"
              min="0"
              readOnly
              placeholder="Calculated automatically"
              value={formOverall.attempts}
            />
          </div>
        </div>

        {/* What went wrong & Next action textareas */}
        <div style={{ marginTop: "12px" }}>
          <label htmlFor="mockLoss">What went wrong / marks lost (optional)</label>
          <textarea
            id="mockLoss"
            maxLength={5000}
            placeholder="Concept gaps, misreading, poor question selection, time pressure, calculation errors"
            value={loss}
            onChange={(e) => setLoss(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label htmlFor="mockAction">What will I change before the next test? (optional)</label>
          <textarea
            id="mockAction"
            maxLength={5000}
            placeholder="Specific actions to take before your next test"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        {/* Prominent High-Visibility Error Banner */}
        {error ? (
          <div id="mockFormError" className="mock-error-alert" role="alert">
            <span className="mock-error-icon" aria-hidden="true">⚠️</span>
            <div className="mock-error-content">
              <strong>Unable to save test</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="mock-error-close"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Success Notice Banner */}
        {notice ? (
          <div className="mock-success-alert" role="status">
            <span className="mock-success-icon" aria-hidden="true">✓</span>
            <div className="mock-success-content">{notice}</div>
          </div>
        ) : null}

        {/* Form Actions */}
        <div className="formactions diary-formactions" style={{ marginTop: "14px" }}>
          <button className="primary diary-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save test"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} disabled={saving}>
              Cancel edit
            </button>
          ) : null}
          <button type="button" onClick={resetForm} disabled={saving}>
            Clear form
          </button>
        </div>
      </form>

      {/* SAVED FULL-LENGTH TESTS */}
      <div className="stats-section mock-section-block mock-full-block" style={{ marginTop: "28px" }}>
        <div className="mock-section-block-head">
          <div className="mock-section-block-title-wrap">
            <span className="mock-sec-badge-icon icon-full" aria-hidden="true">🎯</span>
            <div>
              <h3 className="mock-section-block-title">Saved full-length tests</h3>
              <p className="diary-muted diary-small">
                3-section composite CAT mocks (VARC + DILR + Quant) compared together.
              </p>
            </div>
          </div>
          <span className="mock-count-pill pill-full">
            {fullMocks.length} {fullMocks.length === 1 ? "mock" : "mocks"} recorded
          </span>
        </div>

        <div id="fullMockList" className="mock-list-wrapper" style={{ marginTop: "14px" }}>
          {fullMocks.length > 0 ? (
            <div className="tasklist">{fullMocks.map(renderMockCard)}</div>
          ) : (
            <div className="mock-empty-box mock-empty-full">
              <div className="mock-empty-icon-wrap">
                <span className="mock-empty-icon" aria-hidden="true">🎯</span>
              </div>
              <div className="mock-empty-details">
                <h4 className="mock-empty-title">No full-length tests recorded yet</h4>
                <p className="mock-empty-desc">
                  Log complete 3-section CAT mock tests above to track your composite score, sectional accuracy, and percentile rank.
                </p>
                <span className="mock-empty-hint">
                  💡 Tip: Select &quot;Full-length test&quot; at the top of the form to log your first full mock.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SAVED SECTIONAL TESTS */}
      <div className="stats-section mock-section-block" style={{ marginTop: "32px" }}>
        <div className="mock-section-block-head">
          <div className="mock-section-block-title-wrap">
            <span className="mock-sec-badge-icon icon-sectional" aria-hidden="true">📊</span>
            <div>
              <h3 className="mock-section-block-title">Saved sectional tests</h3>
              <p className="diary-muted diary-small">
                Each section is tracked independently and compared only within its subject domain.
              </p>
            </div>
          </div>
          <span className="mock-count-pill pill-sectional">
            {sectionalVARC.length + sectionalDILR.length + sectionalQuant.length} sectionals recorded
          </span>
        </div>

        {/* 3-Column Sectional Grid */}
        <div className="mock-sectionals-grid" style={{ marginTop: "16px" }}>
          {/* VARC Section */}
          <div className="mock-sec-panel mock-sec-panel-varc">
            <div className="mock-sec-panel-head">
              <div className="mock-sec-panel-title-area">
                <span className="mock-sec-mini-badge badge-varc" aria-hidden="true">📖</span>
                <div>
                  <h4 className="mock-sec-panel-name">VARC sectionals</h4>
                  <span className="mock-sec-panel-tag">Verbal Ability & RC · 24 Q</span>
                </div>
              </div>
              <span className="mock-sec-pill pill-varc">{sectionalVARC.length} tests</span>
            </div>

            <div id="sectionalVARCList" className="mock-sec-content">
              {sectionalVARC.length > 0 ? (
                <div className="tasklist mock-sublist">{sectionalVARC.map(renderMockCard)}</div>
              ) : (
                <div className="mock-empty-box mock-empty-varc">
                  <div className="mock-empty-icon-wrap">
                    <span className="mock-empty-icon" aria-hidden="true">📖</span>
                  </div>
                  <div className="mock-empty-details">
                    <h5 className="mock-empty-title">No VARC tests yet</h5>
                    <p className="mock-empty-desc">
                      Log your 40-minute VARC sectionals to analyze reading speed, RC accuracy, and VA performance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DILR Section */}
          <div className="mock-sec-panel mock-sec-panel-dilr">
            <div className="mock-sec-panel-head">
              <div className="mock-sec-panel-title-area">
                <span className="mock-sec-mini-badge badge-dilr" aria-hidden="true">🧩</span>
                <div>
                  <h4 className="mock-sec-panel-name">DILR sectionals</h4>
                  <span className="mock-sec-panel-tag">Data Interpretation & LR · 20 Q</span>
                </div>
              </div>
              <span className="mock-sec-pill pill-dilr">{sectionalDILR.length} tests</span>
            </div>

            <div id="sectionalDILRList" className="mock-sec-content">
              {sectionalDILR.length > 0 ? (
                <div className="tasklist mock-sublist">{sectionalDILR.map(renderMockCard)}</div>
              ) : (
                <div className="mock-empty-box mock-empty-dilr">
                  <div className="mock-empty-icon-wrap">
                    <span className="mock-empty-icon" aria-hidden="true">🧩</span>
                  </div>
                  <div className="mock-empty-details">
                    <h5 className="mock-empty-title">No DILR tests yet</h5>
                    <p className="mock-empty-desc">
                      Log your 40-minute DILR sectionals to track set selection strategy, puzzle completion, and score trends.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quant Section */}
          <div className="mock-sec-panel mock-sec-panel-quant">
            <div className="mock-sec-panel-head">
              <div className="mock-sec-panel-title-area">
                <span className="mock-sec-mini-badge badge-quant" aria-hidden="true">📐</span>
                <div>
                  <h4 className="mock-sec-panel-name">Quant sectionals</h4>
                  <span className="mock-sec-panel-tag">Quantitative Aptitude · 22 Q</span>
                </div>
              </div>
              <span className="mock-sec-pill pill-quant">{sectionalQuant.length} tests</span>
            </div>

            <div id="sectionalQuantList" className="mock-sec-content">
              {sectionalQuant.length > 0 ? (
                <div className="tasklist mock-sublist">{sectionalQuant.map(renderMockCard)}</div>
              ) : (
                <div className="mock-empty-box mock-empty-quant">
                  <div className="mock-empty-icon-wrap">
                    <span className="mock-empty-icon" aria-hidden="true">📐</span>
                  </div>
                  <div className="mock-empty-details">
                    <h5 className="mock-empty-title">No Quant tests yet</h5>
                    <p className="mock-empty-desc">
                      Log your 40-minute QA sectionals across Arithmetic, Algebra, Geometry, and Modern Math.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
