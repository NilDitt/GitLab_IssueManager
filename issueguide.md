## GitLab Issue Workflow Guide

This guide distills the teams workflow so future issues are complete, consistent, and immediately actionable. Follow the sections sequentially whenever you create or refine an issue.

### 1. Workflow at a Glance

1. **Pick or define the topic**: clarify whether its a bug, feature, question, or planning task.
2. **Open the issue modal and select the shared template** (see Section 4) before typing anything.
3. **Fill in the three template blocks in order**: description, definition of done, checklist.
4. **Label, size, and prioritize** using the taxonomies below so downstream filtering & time tracking work.
5. **Estimate effort/time** (even a rough sizing) and add the matching Zeiterfassung label.
6. **Link related epics** and, once ready to implement, **create a branch from the issue** so the MR auto-links back.
7. **Track time** within the issues Time Tracking panel whenever you work on it.
8. **Close via Merge Request** whenever possible; MRs must be reviewed by someone other than the author.

### 2. Label Taxonomy

| Category                              | Labels                                                                                        | When to use                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administration**                    | `Bug`, `Feature`, `Frage`                                                                     | Classify the nature of the work (defect, new scope, or question about planning/execution).                                                            |
| **Zeiterfassung / Projektaufteilung** | `Implementierung & Tests`, `Projektmanagement`, `Requirements Engineering`, `Softwareentwurf` | Required for time tracking. Pick the area that best matches the work youll log.                                                                       |
| **Aufwand**                           | `XS`, `S`, `M`, `L`, `XL`                                                                     | Estimate complexity/effort. Use `XS/S` for small tweaks, `M` for moderate analysis, `L/XL` for high-impact work (e.g., full subpage, major refactor). |
| **Wichtigkeit**                       | `priority 1`, `priority 2`, `priority 3`                                                      | Communicate urgency. `priority 1` blocks progress, `priority 2` should be scheduled within a few days, `priority 3` can wait.                         |

> Tip: Apply at least **one label from each category** (nature, time-tracking area, effort, priority). This keeps boards and reports filterable.

### 3. Epics Overview

Epics act like folders for long-running goals. Link every issue to the most relevant epic to keep progress visible.

`Test / Qualitätssicherung` · `Projektstrukturplan` · `Requirements Engineering` · `Projektmanagement` · `Entwicklung / Implementierung` · `Tickets, Fragen & Diskussion` · `Design / Programmentwurf`

### 4. Issue Template Anatomy

Each issue must use the shared template in this order:

1. **Beschreibung**  
   _One to three sentences summarising the problem/goal, why it matters, and any scope constraints._
2. **Definition of Done (DoD)**  
   _Bullet list describing the observable outcomes. Each bullet starts with a verb (e.g., "Document ...", "Implement ...", "Demo ...")._
3. **Checkliste**
   ```
   - [ ] Label hinzugefügt
   - [ ] Zeit vorher eingeschätzt
   - [ ] Definition of Done besteht aus Stichpunkten
   ```
   _Tick the items once satisfied. Extend the checklist with issue-specific guardrails if needed (tests, docs, review partner, etc.)._

### 5. Step-by-Step: Creating the Perfect Issue

1. **Gather input**: clarify requirements with stakeholders or the weekly meeting notes. Reference the correct epic.
2. **Open issue dialog → choose template**.
3. **Write the description** (11 sentences). Mention impacted component, current behaviour, desired outcome.
4. **Draft the DoD**. Use 35 bullet points covering implementation, validation (tests/review), and documentation.
5. **Add acceptance signals**: screenshots/mockups, links to user stories, or references to discussions if they exist.
6. **Apply labels** from each category (Section 2) plus any epic-specific labels.
7. **Estimate effort**: choose XSXL, then add a time estimate in hours if known so the Time Tracking view stays accurate.
8. **Assign Zeiterfassung label** matching where the logged time belongs (Implementierung & Tests, etc.).
9. **Set priority** based on urgency agreed in the weekly meeting.
10. **Create a branch directly from the issue** when you start implementation. Name suggestion: `<issue-number>-short-title`.
11. **Track time** inside the issue whenever you work on it. Include context in notes if the task spans multiple categories.
12. **Keep the issue updated**: comment major decisions, attach designs, and note blockers for the Scrum Master review.
13. **Close via MR**: when the branch is ready, open a Merge Request referencing the issue. Ensure another team member approves before merging; merging can auto-close the issue when "Closes #<iid>" is present in the MR description.

### 6. Additional Team Rituals

- **Scrum Master rotation**: ownership changes weekly. Mention in the issue if coordination with the current Scrum Master is required.
- **Weekly meeting & Statusreport**: bring open questions to the meeting; log decisions back into the relevant issues. When preparing the Reveal.js status report, follow the duplicate/rename/push workflow described in the team handbook.
- **Merge policy**: every MR must be reviewed by someone other than the author.
- **Time tracking enforcement**: if an issue lacks a Zeiterfassung label or estimate, its not ready to start.

### 7. Example Issue Skeleton

```
Beschreibung
Die Benutzer können aktuell keine PDFs exportieren. Wir müssen den Export-Flow an die neue CI/CD Pipeline anbinden, damit Statusreports automatisch erstellt werden.

Definition of Done
- Export-Button ruft den neuen Pipeline-Endpoint auf und zeigt Erfolgs-/Fehlermeldungen.
- CI/CD Pipeline erstelle Statusreport-PDF automatisch bei erfolgreichem Export.
- Dokumentation im README + kurze Demo-Notiz für das nächste Weekly.

Checkliste
- [x] Label hinzugefügt (Feature, Implementierung & Tests, M, priority 2)
- [x] Zeit vorher eingeschätzt (6h)
- [x] Definition of Done besteht aus Stichpunkten
```

Following these steps ensures every future issue contains the right context, structure, and metadata for smooth planning, implementation, and reporting.
