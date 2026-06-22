# CDS6324: Data Visualization — Project Requirements
**Trimester 2610 | Project – Interactive Data Visualization**

## Instructions

- This project carries **40%** of the coursework assessment.
- This is a **group project** consisting of **THREE (3) students** per group.
- Submission deadlines:
  - **Project proposal:** Week 11, 12th June 2026, 11:59 PM
  - **Final project:** Week 14, 5th July 2026, 11:59 PM
- Late submission will be subjected to a deduction of **20% of the total marks per day**.
- Students are allowed to use AI tools **ONLY as support**, but all submitted work must reflect their own understanding and originality.
- If plagiarism or academic misconduct is detected, the project **WILL be awarded 0% with no negotiation**.

---

## 1. Project Overview

In this project, you will design and implement an interactive data visualization dashboard using D3.js. The project theme will be selected from the options provided in Section 3.1, and your work should present interactive charts that effectively communicate insights derived from real-world datasets related to the chosen theme.

The goal of this project is to provide hands-on experience in building interactive visualizations and to help you design effective visuals that clearly communicate meaningful insights and support data-driven decisions.

This is a group project consisting of three students. Each group is required to develop **at least six meaningful interactive visualizations**, which will be integrated into a cohesive dashboard. **D3.js must be used as the primary visualization library.** However, you are encouraged to enhance the overall user experience by incorporating additional technologies, as specified in Section 3.4.

---

## 2. Group Structure and Responsibilities

- **Team Members:** 3 students (from the same tutorial section, the same group as for assignment)
- **Individual Tasks:**
  - Each student will create **2 distinct interactive visualizations**.
  - Each visualization must be based on data relevant to the assigned SDG theme.
  - The visualizations should be designed to communicate meaningful insights and support data exploration.
- **Group Task:**
  - All visualizations will be integrated into a single interactive dashboard.
- **Contribution Requirement:**
  - Each student is expected to contribute equally, and individual contributions should be clearly reflected in the final submission.

---

## 3. Project Requirements

### 3.1. Themes and Dataset

The Sustainable Development Goals (SDGs) are a set of 17 global goals established by the United Nations to address key challenges such as poverty, health, education, inequality, and environmental sustainability. These goals provide a common framework for understanding and solving real-world problems through data-driven approaches. Students are encouraged to explore the SDGs to better understand the context of their assigned theme: https://sdgs.un.org/goals

Each tutorial section will be assigned a specific SDG as the theme for their project. All teams within the same tutorial section must work on the assigned SDG theme but may use different datasets and analytical focus.

**Assigned themes:**

| Tutorial Section | SDG Theme | Example Datasets |
|---|---|---|
| TT1L | SDG 2 — Zero Hunger | FAO Food Security Dataset; Global Hunger Index Dataset |
| **TT2L** | **SDG 3 — Good Health & Wellbeing** | WHO Global Health Observatory; Our World in Data – COVID-19 Dataset |
| TT3L | SDG 4 — Quality Education | UNESCO Education Dataset; World Bank Education Statistics |
| TT4L | SDG 5 — Gender Equality | World Bank Gender Statistics; UN Women Global Gender Data |
| TT5L | SDG 6 — Clean Water & Sanitation | WHO/UNICEF JMP Dataset; World Bank Water Indicators |
| TT6L | SDG 7 — Affordable & Clean Energy | International Energy Agency (IEA) Dataset; Our World in Data – Energy Dataset |
| TT7L | SDG 11 — Sustainable Cities & Communities | WHO Air Quality Dataset; Global Urban Mobility Dataset (Kaggle) |
| TT8L | SDG 13 — Climate Action | NOAA Climate Data Online; Our World in Data – CO₂ Emissions Dataset |

> **Our group (TT2L) is assigned SDG 3 — Good Health & Wellbeing.**

### 3.2. Dataset Requirements

The chosen dataset(s) must:
- Contain **at least 3,000 records** and a **minimum of 10 attributes**
- Include a **temporal or spatial dimension** (e.g., time, location)

You may combine multiple datasets if needed.

### 3.3. Expected Outcome

Each group is expected to:
- Select dataset(s) relevant to the assigned SDG
- Develop visualizations that provide meaningful insights related to the theme
- Support data exploration, analysis, and decision-making through interactive features
- Clearly define and answer **at least three analytical questions**

No more than **three groups** within the same tutorial section may use the same dataset. Groups are expected to select alternative datasets if the limit has been reached.

### 3.4. Tools and Technologies

**Required:**
- **D3.js:** The primary library for creating interactive data visualizations. All visualizations must be implemented using D3.js.
- **HTML/CSS:** Used for structuring and styling the web page and dashboard layout.
- **JavaScript:** Used to integrate D3.js visualizations, handle user interactions, and ensure smooth data flow within the dashboard.

**Optional:**
- **GitHub:** For version control and collaborative development. Groups are encouraged to use GitHub to manage their code and track individual contributions.
- **Data Preprocessing Tools** (e.g., Python, Excel, R, or Power Query) may be used for data cleaning, transformation, and preparation prior to visualization.

### 3.5. Interactivity Requirements

All dashboards must include the following interactive features:

- **Hover Tooltips:** Display additional information when users hover over data points.
- **Filtering:** Allow users to filter data based on attributes (e.g., time, category, region).
- **Zooming / Panning:** Enable users to explore data at different levels of detail.
- **Linked Interactions (Dynamic Updates):** Visualizations should be connected such that interactions in one chart (e.g., selecting a time range or category) update other charts accordingly.
- **Animation:** At least one visualization must include animation driven by temporal or spatial data (e.g., time or location) to show meaningful changes or progression. The animation should be interactive and **not purely decorative**.

---

## 4. Project Deliverables

### 4.1. Source Code

**Individual Visualizations (2 charts per student):**
- Total charts: **Minimum 6** (2 per student × 3 students).
- Visualizations should be designed for clarity, interactivity, and user engagement (e.g., hover, zoom, filtering).
- Each visualization must be based on data relevant to the assigned SDG theme and should support meaningful insight generation.

**Dashboard:**
- The individual charts will be combined into one interactive dashboard.
- The dashboard should present a cohesive, interactive user experience, where users can explore data by interacting with different visualizations (e.g., through filtering, zooming, or clicking).
- The dashboard should provide insight into the assigned SDG and allow for seamless interaction between charts (e.g., selecting a category or time period updates multiple views).

> Please ensure that the source code submitted is in working condition. If any special instructions are required for building or running your project, these should be included in the report or provided in a README file. **Marks for coding-related criteria will not be awarded for code that does not work.**

### 4.2. Documentation

A written report documenting the following:

- **Data Sources:** Brief explanation of the dataset(s) used and their relevance to the assigned SDG (~1 page).
- **Analytical Questions:** Clearly defined questions that guide the analysis and justify the choice of visualizations (~1 page).
- **Visualizations:** A description of the purpose and key insights of each visualization (~3 pages, including charts/dashboard).
- **Interactivity:** Explanation of the interactive features integrated into the visualizations (~1 page).
- **Best Data Visualization Practices:** State the visualization design principles (e.g., Shaffer's 4Cs or Cole Nussbaumer's 4As) used to guide your design and describe how the visualizations fulfil these principles (<1 page).
- **Challenges & Solutions:** Any issues faced during development and how they were addressed (<1 page).
- **Development Process and Group Contribution:** A summary of the development process, including task distribution, collaboration approach, time spent, and key challenges (<1 page).

---

## 5. Project Milestones

### 5.1. Project Proposal

Your project proposal should include the following:
- Project Members
- Project Title
- Assigned SDG Theme
- Proposed Dataset(s) and Attributes
- **Project Description:** A storyboard or outline of the planned visualizations and dashboard interface. Describe the intended features of your dashboard and justify the choice of visualization and interaction techniques in the context of your data and analytical goals.

**Project proposal submission:**

| | |
|---|---|
| File name | `StudentID1_StudentID2_StudentID3.zip` |
| Submission platform | eBwise |
| File size | 2MB (maximum) |
| Submission deadline | Week 11, **12th June 2026, 11:59 PM** |
| Assessment marks | **5%** |
| Late submission | Deduction of 10% from total marks gained per day late |

### 5.2. Final Project

**Proposed Timeline (4 weeks):**
- **Week 1:** Identify and prepare dataset(s). Begin developing individual visualizations using D3.js with basic functionality.
- **Week 2:** Enhance visualizations with interactivity features and refine design.
- **Week 3:** Integrate individual visualizations into a single cohesive dashboard. Implement linked interactions where appropriate.
- **Week 4:** Perform testing (functionality, interactivity, usability). Finalize dashboard and complete documentation.

**Final project submission:**

| | |
|---|---|
| File name | `StudentID1_StudentID2_StudentID3.zip` |
| Submission platform | eBwise |
| File size | 2MB (maximum) |
| Submission deadline | Week 14, **5th July 2026, 11:59 PM** |
| Assessment marks | **30%** |
| Late submission | Deduction of 10% from total marks gained per day late |

**Peer Evaluation:** To ensure fair and transparent assessment of individual contributions, peer evaluation will be conducted for each group. Each student is required to submit the peer evaluation form to the tutor.

### 5.3. Project Presentation

A final presentation summarizing the project and demonstrating the dashboard is expected. It should demonstrate the functionality of the interactive features and explain the key insights derived from the visualizations in relation to the analytical questions.

All group members are expected to participate in the presentation. **Absence from the presentation will result in no marks awarded.** The presentation duration should be between **5 to 10 minutes**.

- Presentation schedule: Week 14
- Assessment marks: **5%**

---

## 6. Academic Integrity and Use of AI Tools

Students may use AI tools as a supporting resource, for example to clarify concepts or improve wording. However, all submitted work must reflect your own understanding. You are expected to fully understand your dataset, your transformations, your visualizations, and your conclusions.

---

## Appendix 1: Project Rubrics

> See `rubrics.md` for the full breakdown (Proposal 5%, Project 30%, Presentation 5%).

## Appendix 2: Peer Evaluation

**Evaluation Scheme**

Let:
- *n* = number of group members who submitted the peer evaluation form
- *Pᵢ* ∈ [0, 20] = marks given to a student by each peer

The peer evaluation score (PE) for a student is calculated as:

```
PE = ( (1/n) × Σ Pᵢ ) / 10
```

The resulting score contributes a maximum of **2%** to the overall project marks.

**Notes:**
- A student who does **NOT** submit the peer evaluation form will receive: **PE = 0%**
- All submitted evaluations must reflect genuine individual contributions.

**Example (3-Student Group):**
- Number of group members: 3
- Number of peers: 2
- Maximum marks per peer: 20

Marks received:
- Peer 1: 16
- Peer 2: 14

If the student submits the peer evaluation form:
```
PE = (16 + 14) / 2 ÷ 10 = 1.5%
```
If the student does NOT submit: `PE = 0%`

## Appendix 3: Cover Page Template

```
CDS 6324
DATA VISUALIZATION
PROJECT (40%)
Lecture Section: TXXL
Tutorial Section: TXXL
Group Number: TXXL_GXX
Submitted to: [lecturer name]

| Student ID | Student Name | Email & Contact No |
|---|---|---|
| | | |
| | | |
| | | |
```
