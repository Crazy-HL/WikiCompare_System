const assert = require("assert");
const fs = require("fs");
const path = require("path");

const apiSource = fs.readFileSync(path.join(__dirname, "../src/experiment/experimentApi.js"), "utf8");
assert(!apiSource.includes("http://localhost:8888"), "experiment API must not hardcode localhost");
assert(apiSource.includes("VUE_APP_EXPERIMENT_API_BASE"), "experiment API should support an env-configured API base");
assert(apiSource.includes("getStaticTable"), "participant API should expose static-table fetch");
assert(apiSource.includes("adminStaticTable"), "admin API should expose static-table management");
assert(apiSource.includes("...(rawQuestions === undefined ? {} : { rawQuestions })"), "question generation API should allow backend auto-generation without rawQuestions");

const shellSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/ExperimentShell.vue"), "utf8");
assert(shellSource.includes("getStaticTable"), "ExperimentShell should fetch frozen static table data");
assert(shellSource.includes(":frozen-rows=\"staticTableRows\""), "ExperimentShell should pass frozen rows to ChatGptCondition");
assert(shellSource.includes("stage.condition === 'chatgpt'") && shellSource.includes("当前 ChatGPT 阅读表格尚未冻结"), "ChatGPT stages should be blocked when the static table is unavailable");
assert(shellSource.includes("payload.frozen"), "ExperimentShell should guard against unfrozen public question payloads");

const chatSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/ChatGptCondition.vue"), "utf8");
assert(chatSource.includes("frozenRows"), "ChatGptCondition should render only frozen rows supplied by participant API");
assert(chatSource.includes("activeTab"), "ChatGptCondition should expose a tabbed GPT/material browser interface");
for (const expectedTab of ["GPT", "材料 1", "材料 2"]) {
	assert(chatSource.includes(expectedTab), `ChatGptCondition should include ${expectedTab} tab label`);
}
assert(chatSource.includes("role=\"tablist\"") && chatSource.includes("role=\"tabpanel\""), "ChatGptCondition should use accessible tab markup");
assert(chatSource.includes("ParentComponent") && chatSource.includes('side="left"') && chatSource.includes('side="right"'), "ChatGptCondition should render each material article in its own tab");
assert(chatSource.includes(':show-outline="false"'), "ChatGptCondition should hide the article outline in material tabs");
assert(chatSource.includes("chatgpt-toolbar") && chatSource.includes("chatgpt-transcript") && chatSource.includes("composer-shell"), "ChatGptCondition should use a ChatGPT-like chat layout");
assert(chatSource.includes('postJson("api/ask"'), "ChatGptCondition should keep the ChatGPT follow-up question endpoint");
assert(!chatSource.includes("rankedRows"), "ChatGptCondition must not derive rows from live WikiCompare state");

const adminQuestionsSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/AdminQuestions.vue"), "utf8");
assert(adminQuestionsSource.includes("adminStaticTable"), "AdminQuestions should manage static tables");
assert(adminQuestionsSource.includes("autoGenerateQuestions"), "AdminQuestions should offer a backend auto-generate action");
assert(adminQuestionsSource.includes("自动生成题目"), "AdminQuestions should label the auto-generate action for researchers");
assert(/questionPayload\?\.frozen[\s\S]*raw-questions-json/.test(adminQuestionsSource) || adminQuestionsSource.includes("questionsFrozen"), "AdminQuestions should disable question save while frozen");
assert(/staticTablePayload\?\.frozen/.test(adminQuestionsSource), "AdminQuestions should disable static-table save while frozen");
assert(adminQuestionsSource.includes("机器可判分") && adminQuestionsSource.includes("机器判分标准"), "AdminQuestions should expose machine-gradability and grading rubric to researchers");
assert(adminQuestionsSource.includes("grading_rubric") && adminQuestionsSource.includes("machine_gradable"), "AdminQuestions should preserve grading rubric and machine_gradable fields when editing questions");
assert(adminQuestionsSource.includes("question.machine_gradable === true") && adminQuestionsSource.includes("未设置：旧题需重新生成或手动补齐"), "AdminQuestions should not treat missing legacy machine_gradable as ready for formal use");
assert(adminQuestionsSource.includes("machine_gradable: question.machine_gradable === true"), "AdminQuestions edit drafts should not silently mark legacy questions as machine-gradable");
assert(adminQuestionsSource.includes("仅证据编号正确但答案内容错误"), "AdminQuestions should remind researchers that source IDs alone are insufficient for grading");


const answerPanelSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/AnswerPanel.vue"), "utf8");
assert(answerPanelSource.includes("answerOptions") && answerPanelSource.includes("isChoiceQuestion"), "AnswerPanel should detect generated fixed answer options");
assert(answerPanelSource.includes('type="radio"') && answerPanelSource.includes("choice-option"), "AnswerPanel should render deterministic questions as single-choice radio options");
assert(answerPanelSource.includes("v-else") && answerPanelSource.includes("textarea"), "AnswerPanel should keep a free-text textarea fallback for open questions");
assert(answerPanelSource.includes("请选择一个答案"), "AnswerPanel should label single-choice answers in Chinese");
assert(answerPanelSource.includes("inferDeterministicAnswerOptions") && answerPanelSource.includes("左侧材料中的对象"), "AnswerPanel should infer choices for legacy frozen deterministic comparison questions without stored answer_options");
assert(answerPanelSource.includes("requiresParticipantEvidence") && answerPanelSource.includes("participant_evidence_required"), "AnswerPanel should hide evidence boxes unless a question explicitly or semantically requires participant evidence");
assert(answerPanelSource.includes('v-if="requiresParticipantEvidence(question)"'), "AnswerPanel should conditionally render left/right evidence inputs");

const submissionsSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/AdminSubmissions.vue"), "utf8");
assert(submissionsSource.includes("expandedSubmissionId") && submissionsSource.includes("submission-detail-panel") && submissionsSource.includes("detail-toggle"), "AdminSubmissions should include expandable full-width detail panels");
assert(submissionsSource.includes("参与者完整记录") && submissionsSource.includes("selectedParticipantId") && submissionsSource.includes("participant-full-record-card"), "AdminSubmissions should provide a participant-centered full-record viewer");
assert(submissionsSource.includes("阶段答题完整记录") && submissionsSource.includes("事后问卷完整记录") && submissionsSource.includes("原始提交 JSON"), "AdminSubmissions should expose each participant stage answers, questionnaire, and raw JSON");
assert(submissionsSource.includes("@dblclick") && submissionsSource.includes("inline-edit-input") && submissionsSource.includes("双击可编辑"), "AdminSubmissions should support double-click inline editing");
for (const expected of ["主要参考来源", "左侧证据", "右侧证据", "答题用时", "阶段用时", "开始作答时间", "提交时间", "论文预览", "（a）SUS 分数分布", "数量"]) {
	assert(submissionsSource.includes(expected), `AdminSubmissions should display Chinese label ${expected}`);
}
for (const rawLabel of ["primarySource", "leftEvidence", "rightEvidence", "durationMs", "answerStartedAtMs", "submittedAtMs"]) {
	assert(!submissionsSource.includes(`<span>${rawLabel}</span>`), `AdminSubmissions must not render raw field label ${rawLabel}`);
}
assert(submissionsSource.includes("formatReadableTimestamp") && submissionsSource.includes("formatTimeRange") && submissionsSource.includes("formatRangeDuration"), "AdminSubmissions should render millisecond timestamps as readable Chinese date/time ranges");
assert(!submissionsSource.includes("http://localhost:8888"), "AdminSubmissions export links must not hardcode localhost");

console.log("experiment final review source tests passed");
