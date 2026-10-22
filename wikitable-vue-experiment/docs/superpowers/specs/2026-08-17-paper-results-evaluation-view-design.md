# Paper Results Evaluation View Design

## Goal
Redesign the admin result presentation so the paper text and charts match the restrained ACM-style `System Evaluation` section in the existing WikiCompare paper, while keeping raw data editing and audit tools available below the paper view.

## Source Style
The reference paper uses a formal section hierarchy (`5 System Evaluation`, `5.1 Participants`, `5.2 Exploratory Procedure`, `5.3 Evaluation Results`, `5.3.x Findings`, `6 Discussion and Limitations`), compact serif typography, white figure backgrounds, thin axes, low-saturation colors, multi-panel figures, and figure captions written in paper prose rather than dashboard labels.

## User Requirements
- The admin backend should still display generated paper content directly.
- The style should align with the original paper's `System Evaluation` chapter.
- Result charts should be suitable for screenshots and direct use in the paper.
- The top of the admin page should avoid dashboard clutter; raw data/audit/editing can remain in lower collapsed sections.
- Charts and text must update from the latest local experiment submissions.

## Proposed UX
Add a dedicated paper-evaluation mode at the top of the submissions page. The mode contains:
1. A paper toolbar with refresh, copy Chinese draft, and focus/screenshot toggle.
2. A paper-like article panel with section numbering and formal Chinese/English draft text.
3. A compact figure strip using Fig. 7-Fig. 10.
4. Paper figures rendered as white figure canvases with captions.
5. Existing data audit and participant editing tools moved below a divider and not visually competing with the paper view.

## Figure Design
- Fig. 7: Task accuracy by question type, grouped bars, WikiCompare vs GPT.
- Fig. 8: Multi-panel reading strategy figure: (A) answer time by question, (B) primary source composition.
- Fig. 9: Q6 exploratory findings/questions by condition.
- Fig. 10: Post-study questionnaire, SUS histogram and selected comparison item means.

## Constraints
- Do not introduce new chart dependencies.
- Reuse existing analytics data structures where possible.
- Keep admin data editing behavior intact.
- Avoid changing stored experiment data.
