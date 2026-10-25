# 🎯 CAT Exam Preparation Diary & Analytics Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9.11-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-2.13-764ABC?style=for-the-badge&logo=redux)](https://redux-toolkit.js.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![JWT Auth](https://img.shields.io/badge/Auth-JWT_%2B_Bcrypt-blueviolet?style=for-the-badge&logo=jsonwebtokens)](https://jwt.io/)

A comprehensive, full-stack preparation companion built specifically for **CAT (Common Admission Test)** aspirants. It combines daily task scheduling, reflection journaling, spaced-repetition revision queues, topic-level practice tracking, deep mock test analysis, and consistency analytics into a single modern dashboard.


## 💡 Overview

Preparing for CAT demands continuous discipline, strategic revision, and honest self-assessment. Standard to-do lists fall short because they do not track section-wise accuracy, mock test trends, or spaced revision intervals.

**CAT Exam Prep Diary** provides a data-driven system to:
1. **Plan & Execute**: Break down daily goals by section (VARC, DILR, Quant) and priority.
2. **Reflect Honestly**: Daily journals to log hours, focus score (1–5), wins, and areas to improve.
3. **Master the Syllabus**: Track individual subtopics from "Not Started" to "Mastered".
4. **Analyze Mocks**: Pinpoint strengths, weak areas, and time allocation across test series.
5. **Never Forget**: Automated revision queue to revisit critical concepts before exam day.

---

## ✨ Key Features

### 📅 1. Daily Study Diary & Task Planner
- **Section Categorization**: Tag tasks under `VARC`, `Quant`, `DILR`, `Revision`, `Mock test`, `Analysis`, or `Other`.
- **Priority & Time Slots**: Assign priorities (`Must do`, `Should do`, `Bonus`) with target start/end times.
- **Accuracy Tracking**: Record questions attempted vs. correct to instantly calculate accuracy percentages.
- **Status Workflow**: Filter and update tasks (`Not started`, `In progress`, `Done`, `Partly done`, `Skipped`, `Rescheduled`).
- **Data Export**: Single-click **CSV Export** and **Print / Save as PDF** for offline revision sheets.
- **AI / Mentor Review Prompt**: One-click copy tool that formats your day's schedule into a structured prompt for ChatGPT/Claude or human mentors to critique.

### 🪞 2. Daily Reflection Journal
- Document top priorities vs. actual completion.
- Track focused study hours and self-rate energy/focus levels (1 to 5).
- Capture "Best thing learned today" and "Biggest weakness/distraction" to fuel continuous improvement.

### 📚 3. Full CAT Syllabus Tracker
- Hierarchical syllabus tracking for **Quantitative Aptitude**, **DILR**, and **VARC**.
- Mark progress: `Not started` ➔ `In progress` ➔ `Completed` ➔ `Mastered`.
- Track revision counts, last reviewed dates, and personal study notes per topic.

### 📈 4. Topic Dashboard & Practice Sessions
- Log timed practice sessions for specific subtopics.
- Monitor question counts, accuracy rate, speed (minutes per question), and difficulty levels.
- Evaluate your mastery score per topic to eliminate blind spots.

### 🔁 5. Spaced Repetition Revision Queue
- Automatic scheduling for topics requiring revision.
- Avoid the "forgetting curve" with intervals based on confidence levels and recency.
- Mark topics as revised directly from the queue.

### 📊 6. Mock Test Logger & In-Depth Analysis
- Log mock tests (e.g., SIMCAT, AIMCAT, CL Prime, Sectionals).
- Record sectional breakdown: Score, Percentile, Attempted, Accuracy, and Time Spent for VARC, DILR, and QA.
- Analyze test strategy errors: silly mistakes, poor question selection, or concept gaps.

### 📜 7. History & Preparation Analytics
- Study streak calculation to build consistency.
- Historical completion rates, sectional time distribution, and overall study trends over time.

### ⏱️ 8. Study Timer & Exam Countdown
- Integrated **Pomodoro Timer** and stopwatch with customizable focus durations.
- Live countdown clock displaying days, hours, and minutes remaining until the CAT exam.
- Direct logging of completed timer intervals as practice sessions.

### 🔒 9. Secure Multi-User Authentication
- JWT-based authentication using **Access Tokens** and **Refresh Tokens**.
- Secure password hashing with `bcryptjs`.
- User profiles with password change and email OTP reset flows (via Nodemailer).

### 🌓 10. Design & Accessibility
- Clean, distraction-free interface with instant **Dark Mode / Light Mode** switching.
- Responsive design tailored for desktops, tablets, and smartphones.
- Scoped styling powered by Tailwind CSS v4 and optimized modern CSS tokens.

### 💾 11. Data Portability & Settings
- Full JSON export of user data (tasks, reflections, topics, syllabus progress, mocks, revisions).
- Safe JSON import/restore functionality.

---



## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:
- **Node.js**: `v18.18.0` or later (Node.js 20+ recommended)
- **npm**, **yarn**, or **pnpm**
- **MongoDB**: A running local MongoDB instance or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI.

---

### Installation

2. **Install dependencies:**
   ```bash
   npm install
   ```

---

### Environment Variables

Create a `.env` file in the root directory by copying the sample:

```bash
cp .env.example .env
```

Configure your variables as follows:

```env
# Database
MONGO_URI=mongodb://localhost:27017/cat_exam

# JWT Secrets
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_ACCESS_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_REFRESH_EXPIRES_IN=60d

# Node Environment
NODE_ENV=development

# SMTP Email Setup (Required for password reset / OTP features)
STTP_HOST=smtp.gmail.com
SMTP_PORT=587
STTP_USER=your_email@gmail.com
STTP_PASS=your_gmail_app_password
```


### Running the App

#### Development Mode (with Turbopack)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.



## 🎯 CAT Exam Sections Supported

The platform is designed around the three pillars of the CAT examination:

1. **VARC (Verbal Ability & Reading Comprehension)**:
   - Reading Comprehension (RC passages across philosophy, science, sociology, economics)
   - Parajumbles, Summary Completion, Odd Sentence Out, Sentence Placement
2. **DILR (Data Interpretation & Logical Reasoning)**:
   - Data Interpretation (Tables, Bar/Line Graphs, Pie Charts, Radar, Scatter Plots)
   - Logical Reasoning (Arrangements, Games & Tournaments, Matrix Puzzles, Networks, Venn Diagrams)
3. **QA (Quantitative Aptitude)**:
   - Arithmetic (Percentages, Profit & Loss, Ratio, TSD, Time & Work, Averages, Mixtures)
   - Algebra (Linear/Quadratic Equations, Polynomials, Inequalities, Logarithms, Functions, Sequences)
   - Geometry & Mensuration (Triangles, Circles, Polygons, Coordinate Geometry, Trigonometry)
   - Modern Math (Permutations & Combinations, Probability, Set Theory)
   - Number System (Remainders, Factors, Base System, Divisibility)



<p align="center">
  <b>Built with ❤️ for every CAT aspirant aiming for 99+ percentile. Keep practicing, keep analyzing, and ace the exam! 🚀</b>
</p>
