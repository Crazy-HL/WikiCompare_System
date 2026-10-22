const LIKERT_OPTIONS = [
	{ value: 1, label: "非常不同意" },
	{ value: 2, label: "不同意" },
	{ value: 3, label: "一般" },
	{ value: 4, label: "同意" },
	{ value: 5, label: "非常同意" },
];

const SUS_ITEMS = [
	{ id: "SUS1", questionType: "sus", reverse: false, questionText: "我愿意经常使用 WikiCompare 来完成类似的比较阅读任务。" },
	{ id: "SUS2", questionType: "sus", reverse: true, questionText: "我觉得 WikiCompare 不必要地复杂。" },
	{ id: "SUS3", questionType: "sus", reverse: false, questionText: "我觉得 WikiCompare 使用起来比较容易。" },
	{ id: "SUS4", questionType: "sus", reverse: true, questionText: "我认为我需要他人帮助才能顺利使用 WikiCompare。" },
	{ id: "SUS5", questionType: "sus", reverse: false, questionText: "我觉得 WikiCompare 的各项功能整合得较好。" },
	{ id: "SUS6", questionType: "sus", reverse: true, questionText: "我觉得 WikiCompare 中存在较多不一致的地方。" },
	{ id: "SUS7", questionType: "sus", reverse: false, questionText: "我相信大多数人可以很快学会使用 WikiCompare。" },
	{ id: "SUS8", questionType: "sus", reverse: true, questionText: "我觉得 WikiCompare 使用起来比较繁琐。" },
	{ id: "SUS9", questionType: "sus", reverse: false, questionText: "我在使用 WikiCompare 时感到比较有信心。" },
	{ id: "SUS10", questionType: "sus", reverse: true, questionText: "我需要先学习很多东西，才能开始使用 WikiCompare。" },
];

const COMPARISON_ITEMS = [
	{ id: "CMP1", questionType: "comparison", questionText: "相比 GPT 网页，我认为 WikiCompare 更适合完成这类双文档比较阅读任务。" },
	{ id: "CMP2", questionType: "comparison", questionText: "相比 GPT 网页，WikiCompare 更容易帮助我找到支持答案的证据。" },
	{ id: "CMP3", questionType: "comparison", questionText: "相比 GPT 网页，WikiCompare 更容易帮助我理解两篇文章之间的相同点和差异。" },
	{ id: "CMP4", questionType: "comparison", questionText: "在完成本实验这类任务时，我更偏好使用 WikiCompare。" },
];

const OPEN_FEEDBACK_ITEMS = [
	{ id: "WF_HELPFUL", questionType: "open", questionText: "你认为 WikiCompare 最有帮助的地方是什么？" },
	{ id: "WF_IMPROVE", questionType: "open", questionText: "你认为 WikiCompare 最需要改进的地方是什么？" },
];

const QUESTIONNAIRE_ITEMS = [...SUS_ITEMS, ...COMPARISON_ITEMS, ...OPEN_FEEDBACK_ITEMS];

const normalizeResponseValue = value => String(value ?? "").trim();
const isLikertValue = value => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;
};

const createQuestionnaireRecord = (question, timing, value) => ({
	questionId: question.id,
	questionText: question.questionText,
	questionType: question.questionType,
	answer: normalizeResponseValue(value),
	answerStartedAtMs: timing.startedAtMs,
	submittedAtMs: timing.submittedAtMs,
	durationMs: timing.durationMs,
});

const recordsFromAnswerMap = answers => QUESTIONNAIRE_ITEMS.map(question => ({
	questionId: question.id,
	questionText: question.questionText,
	questionType: question.questionType,
	answer: answers?.[question.id],
}));

const normalizeQuestionnaireAnswers = answers => Array.isArray(answers) ? answers : recordsFromAnswerMap(answers || {});

const validatePostExperimentQuestionnaire = answers => {
	answers = normalizeQuestionnaireAnswers(answers);
	if (!Array.isArray(answers) || answers.length !== QUESTIONNAIRE_ITEMS.length) {
		return `事后问卷需要提交 ${QUESTIONNAIRE_ITEMS.length} 条答案。`;
	}
	for (let index = 0; index < QUESTIONNAIRE_ITEMS.length; index += 1) {
		const question = QUESTIONNAIRE_ITEMS[index];
		const answer = answers[index];
		if (!answer || answer.questionId !== question.id) {
			return `事后问卷缺少 ${question.id}。`;
		}
		if (!normalizeResponseValue(answer.answer)) {
			return `${question.id} 答案不能为空。`;
		}
		if (question.questionType !== "open" && !isLikertValue(answer.answer)) {
			return `${question.id} 需要 1 到 5 的量表分值。`;
		}
	}
	return "";
};

const susScoreFromAnswers = answers => {
	answers = normalizeQuestionnaireAnswers(answers);
	const answerMap = new Map();
	for (const answer of answers || []) {
		if (answer && answer.questionId) {
			answerMap.set(answer.questionId, Number(answer.answer));
		}
	}
	let rawTotal = 0;
	for (const item of SUS_ITEMS) {
		const value = answerMap.get(item.id);
		if (!Number.isFinite(value)) {
			return null;
		}
		rawTotal += item.reverse ? 5 - value : value - 1;
	}
	return rawTotal * 2.5;
};

const buildPostExperimentQuestionnairePayload = (answers, startedAtMs, submittedAtMs) => ({
	startedAtMs,
	submittedAtMs,
	durationMs: Number.isFinite(startedAtMs) && Number.isFinite(submittedAtMs) ? Math.max(0, submittedAtMs - startedAtMs) : 0,
	susScore: susScoreFromAnswers(answers),
	answers,
});

const calculateSusScore = susScoreFromAnswers;

module.exports = {
	COMPARISON_ITEMS,
	LIKERT_OPTIONS,
	OPEN_FEEDBACK_ITEMS,
	QUESTIONNAIRE_ITEMS,
	SUS_ITEMS,
	buildPostExperimentQuestionnairePayload,
	calculateSusScore,
	createQuestionnaireRecord,
	susScoreFromAnswers,
	validatePostExperimentQuestionnaire,
};
