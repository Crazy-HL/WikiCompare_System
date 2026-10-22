const assert = require("assert");
const {
	calculateExperimentResultStats,
	calculateQ6InsightStats,
	calculateQuestionnaireStats,
	conditionQuestionAccuracy,
	conditionQuestionAnswerTime,
	conditionQuestionSourceUsage,
	generatePaperDraftSections,
	paperResultHighlights,
	questionnaireSubmissions,
	answerValue,
	normalizeExperimentSource,
} = require("../src/experiment/questionnaireAnalytics.js");
const { QUESTIONNAIRE_ITEMS } = require("../src/experiment/postQuestionnaire.js");

const questionnaire = (participantCode, susScore, cmp1 = 4, group = "S1", wikiDuration = 600000, gptDuration = 500000) => ({
	participantCode,
	experimentId: `exp-20260807-${participantCode.toLowerCase().padEnd(8, "0").slice(0, 8)}`,
	assignmentGroup: group,
	totalDurationMs: wikiDuration + gptDuration + 100000,
	stages: [
		{ stageIndex: 1, condition: "wikicompare", materialId: "M1", stageDurationMs: wikiDuration, answers: [{ durationMs: 1000 }, { durationMs: 3000 }] },
		{ stageIndex: 2, condition: "chatgpt", materialId: "M2", stageDurationMs: gptDuration, answers: [{ durationMs: 2000 }, { durationMs: 4000 }] },
	],
	postQuestionnaire: {
		durationMs: 100000,
		susScore,
		answers: QUESTIONNAIRE_ITEMS.map(item => ({
			questionId: item.id,
			questionText: item.questionText,
			questionType: item.questionType,
			answer: item.id === "CMP1" ? String(cmp1) : item.questionType === "open" ? "反馈" : "4",
			durationMs: 1000,
		})),
	},
});

const submissions = [questionnaire("P01", 75, 5, "S1", 600000, 500000), questionnaire("P02", 85, 3, "S2", 700000, 550000), { participantCode: "P03" }];
const questionnaireRows = questionnaireSubmissions(submissions);
assert.strictEqual(questionnaireRows.length, 2, "only submissions with postQuestionnaire are included");
assert.strictEqual(answerValue(questionnaireRows[0].postQuestionnaire, "CMP1"), "5");

const stats = calculateQuestionnaireStats(submissions);
assert.strictEqual(stats.count, 2);
assert.strictEqual(stats.averageSus, 80);
assert.strictEqual(stats.medianSus, 80);
assert.strictEqual(stats.minSus, 75);
assert.strictEqual(stats.maxSus, 85);
assert.strictEqual(stats.susHistogram.find(bin => bin.label === "70-79").count, 1);
assert.strictEqual(stats.susHistogram.find(bin => bin.label === "80-100").count, 1);
assert.strictEqual(stats.comparisonMeans.find(item => item.id === "CMP1").mean, 4);
assert.strictEqual(stats.itemDistributions.find(item => item.id === "SUS1").counts[4], 2);

const resultStats = calculateExperimentResultStats(submissions);
assert.strictEqual(resultStats.submissionCount, 3);
assert.strictEqual(resultStats.questionnaireCount, 2);
assert.strictEqual(resultStats.assignmentDistribution.find(row => row.group === "S1").count, 1);
assert.strictEqual(resultStats.assignmentDistribution.find(row => row.group === "S2").count, 1);
assert.strictEqual(resultStats.conditionDurations.find(row => row.condition === "wikicompare").mean, 650000);
assert.strictEqual(resultStats.conditionDurations.find(row => row.condition === "chatgpt").mean, 525000);
assert.strictEqual(resultStats.pairedDurationDifference.meanDifferenceMs, 125000);
assert.strictEqual(resultStats.taskAccuracy.scoredCount, 0);
assert.strictEqual(resultStats.taskAccuracy.accuracyPercent, null);

const metricSubmission = {
	participantCode: "P10",
	experimentId: "exp-metrics",
	stages: [
		{
			stageIndex: 1,
			condition: "wikicompare",
			materialId: "M1",
			stageDurationMs: 500000,
			answers: [
				{ questionId: "Q1", primarySource: "T", score: 1, durationMs: 10000 },
				{ questionId: "Q2", primarySource: "A", score: 0.5, durationMs: 20000 },
				{ questionId: "Q3", primarySource: "M", correctness: "wrong", durationMs: 30000 },
				{ questionId: "Q4", primarySource: "table", correctness: "correct", durationMs: 40000 },
				{ questionId: "Q5", primarySource: "article", durationMs: 50000 },
				{ questionId: "Q6", durationMs: 60000, coding: { findings: [{ valid: true, source: "T" }, { valid: false, source: "A" }], questions: [{ valid: true, source: "A" }] } },
			],
		},
		{
			stageIndex: 2,
			condition: "chatgpt",
			materialId: "M2",
			stageDurationMs: 600000,
			answers: [
				{ questionId: "Q1", primarySource: "M", score: 1, durationMs: 15000 },
				{ questionId: "Q2", primarySource: "M", score: 1, durationMs: 25000 },
				{ questionId: "Q3", primarySource: "A", score: 0.5, durationMs: 35000 },
				{ questionId: "Q4", primarySource: "T", score: 1, durationMs: 45000 },
				{ questionId: "Q5", primarySource: "left", correctness: true, durationMs: 55000 },
				{ questionId: "Q6", durationMs: 65000, q6Coding: { validFindings: 2, validQuestions: 1, sourceCounts: { M: 2, T: 1 } } },
			],
		},
	],
};

assert.strictEqual(normalizeExperimentSource("table"), "T");
assert.strictEqual(normalizeExperimentSource("left"), "A");
assert.strictEqual(normalizeExperimentSource("GPT"), "M");

const metricStats = calculateExperimentResultStats([metricSubmission]);
assert.strictEqual(metricStats.taskAccuracy.totalAnswerCount, 10);
assert.strictEqual(metricStats.taskAccuracy.scoredCount, 9);
assert.strictEqual(metricStats.taskAccuracy.unscoredCount, 1);
assert.strictEqual(metricStats.taskAccuracy.accuracyPercent, 77.8);
assert.strictEqual(metricStats.taskAccuracy.byCondition.find(row => row.condition === "wikicompare").accuracyPercent, 62.5);
assert.strictEqual(metricStats.taskAccuracy.byQuestion.find(row => row.questionId === "Q3").accuracyPercent, 25);
assert.strictEqual(metricStats.sourceUsage.totalCount, 10);
assert.strictEqual(metricStats.sourceUsage.overall.find(row => row.source === "M").count, 3);
assert.strictEqual(metricStats.sourceUsage.overall.find(row => row.source === "A").count, 4);
assert.strictEqual(metricStats.sourceUsage.overall.find(row => row.source === "T").count, 3);
assert.strictEqual(metricStats.q6Insights.q6AnswerCount, 2);
assert.strictEqual(metricStats.q6Insights.codedAnswerCount, 2);
assert.strictEqual(metricStats.q6Insights.validFindings, 3);
assert.strictEqual(metricStats.q6Insights.validQuestions, 2);
assert.strictEqual(metricStats.q6Insights.validTotal, 5);
assert.strictEqual(metricStats.q6Insights.sourceUsage.overall.find(row => row.source === "T").count, 2);
assert.strictEqual(metricStats.answerTime.byQuestion.find(row => row.questionId === "Q1").mean, 12500);
assert.strictEqual(metricStats.answerTime.q1ToQ5ByCondition.find(row => row.condition === "chatgpt").mean, 35000);
assert.strictEqual(metricStats.answerTime.q6ByCondition.find(row => row.condition === "wikicompare").mean, 60000);

const rawQ6Stats = calculateQ6InsightStats([{
	participantCode: "P20",
	stages: [{
		condition: "wikicompare",
		answers: [{
			questionId: "Q6",
			answer: "发现内容：India 面积更大但 Indonesia 海岸线更长。\n主要来源：A 文章原文\n\n问题内容：哪一侧净迁移率更高？\n主要触发来源：T",
		}],
	}, {
		condition: "chatgpt",
		answers: [{ questionId: "Q6", answer: "无" }],
	}],
}]);
assert.strictEqual(rawQ6Stats.q6AnswerCount, 2);
assert.strictEqual(rawQ6Stats.codedAnswerCount, 2);
assert.strictEqual(rawQ6Stats.validFindings, 1);
assert.strictEqual(rawQ6Stats.validQuestions, 1);
assert.strictEqual(rawQ6Stats.validTotal, 2);
assert.strictEqual(rawQ6Stats.sourceUsage.overall.find(row => row.source === "A").count, 1);
assert.strictEqual(rawQ6Stats.sourceUsage.overall.find(row => row.source === "T").count, 1);
assert.strictEqual(rawQ6Stats.byCondition.find(row => row.condition === "chatgpt").validTotal, 0);

const implicitTableQ6Stats = calculateQ6InsightStats([{
	participantCode: "P21",
	stages: [{
		condition: "wikicompare",
		answers: [{
			questionId: "Q6",
			answer: "基于顶部对齐的属性，GDP增长：左为1.4%（2023年）2.3%（2024年）；右边是1.5%（2023年）0.8%（2024年）0.6%（2025年）。",
		}],
	}],
}]);
assert.strictEqual(implicitTableQ6Stats.validFindings, 1);
assert.strictEqual(implicitTableQ6Stats.sourceUsage.overall.find(row => row.source === "T").count, 1);
assert.strictEqual(implicitTableQ6Stats.sourceUsage.overall.find(row => row.source === "Other").count, 0);

const matrixAccuracy = conditionQuestionAccuracy([metricSubmission]);
assert.strictEqual(matrixAccuracy.find(row => row.questionId === "Q1").wikicompare.accuracyPercent, 100);
assert.strictEqual(matrixAccuracy.find(row => row.questionId === "Q2").wikicompare.accuracyPercent, 50);
assert.strictEqual(matrixAccuracy.find(row => row.questionId === "Q3").chatgpt.accuracyPercent, 50);
assert.strictEqual(matrixAccuracy.find(row => row.questionId === "Q5").wikicompare.accuracyPercent, null);

const matrixSources = conditionQuestionSourceUsage([metricSubmission]);
assert.strictEqual(matrixSources.find(row => row.questionId === "Q1").wikicompare.sources.find(source => source.source === "T").percent, 100);
assert.strictEqual(matrixSources.find(row => row.questionId === "Q5").chatgpt.dominantSource, "A");

const matrixTime = conditionQuestionAnswerTime([metricSubmission]);
assert.strictEqual(matrixTime.find(row => row.questionId === "Q1").wikicompare.mean, 10000);
assert.strictEqual(matrixTime.find(row => row.questionId === "Q1").differenceMs, -5000);
assert.strictEqual(matrixTime.find(row => row.questionId === "Q6").chatgpt.mean, 65000);

const highlights = paperResultHighlights([metricSubmission]);
assert.strictEqual(highlights.submissionCount, 1);
assert.strictEqual(highlights.hasMockData, false);
assert.ok(highlights.accuracySentence.includes("WikiCompare"));
assert.ok(highlights.sourceSentence.includes("M"));
assert.ok(Array.isArray(highlights.paperMetricRows));
assert.ok(highlights.paperMetricRows.some(row => row.metric === "Q1-Q5 accuracy"));

const mockHighlights = paperResultHighlights([{ ...metricSubmission, mockData: true }]);
assert.strictEqual(mockHighlights.hasMockData, true);

const draft = generatePaperDraftSections([metricSubmission]);
assert.ok(draft.study.includes("within-subject"));
assert.ok(draft.results.includes("Across 1 completed submissions"));
assert.ok(!draft.results.includes("mock submissions"));
assert.ok(draft.results.includes("62.5"));
assert.ok(draft.discussion.includes("traceable"));
assert.strictEqual(draft.paperTitleZh, "5 系统评估");
assert.strictEqual(draft.paperTitleEn, "5 System Evaluation");
assert.ok(Array.isArray(draft.paperSectionsZh));
assert.strictEqual(draft.paperSectionsZh.length, 4);
assert.strictEqual(draft.paperSectionsZh[0].label, "5.1");
assert.ok(draft.latex.includes("\\subsection{5.1 Participants and study design}"));
assert.ok(draft.warning.includes("real participant data"));
assert.ok(draft.studyZh.includes("被试内实验"));
assert.ok(draft.resultsZh.includes("图 7"));
assert.ok(draft.resultsZh.includes("图 8"));
assert.ok(draft.resultsZh.includes("图 9"));
assert.ok(draft.resultsZh.includes("图 10"));
assert.ok(draft.resultsZh.includes("在 1 份已完成提交数据中"));
assert.ok(draft.discussionZh.includes("可追踪"));
assert.ok(draft.latexZh.includes("\\subsection{5.1 参与者与实验设计}"));
assert.strictEqual(draft.paperFigures.figure7.labelZh, "图 7");
assert.strictEqual(draft.paperFigures.figure7.labelEn, "Fig. 7");
assert.strictEqual(draft.paperViewStyle, "system-evaluation");
assert.ok(draft.paperSectionsEn.find(section => section.label === "5.3")?.subsections?.some(section => section.title.includes("Task Accuracy")));
assert.ok(draft.resultsZh.includes("如图 7 所示"));

const mockDraft = generatePaperDraftSections([{ ...metricSubmission, mockData: true }]);
assert.ok(mockDraft.results.includes("mock/test submissions"));
assert.ok(mockDraft.latex.includes("Mock/test-data draft"));

const fs = require("fs");
const path = require("path");
const adminSubmissionsVue = fs.readFileSync(path.join(__dirname, "../src/components/experiment/AdminSubmissions.vue"), "utf8");
assert.ok(adminSubmissionsVue.includes("论文结果视图 · System Evaluation"));
assert.ok(adminSubmissionsVue.includes('<details class="paper-admin-details">'));
assert.ok(adminSubmissionsVue.includes(".figure-only-mode .paper-admin-details"), "screenshot mode hides the admin-only metric/audit block");
assert.ok(/\.paper-preview\s*\{[^}]*box-shadow:\s*none/s.test(adminSubmissionsVue), "paper preview should use paper-like flat styling rather than dashboard shadows");
assert.ok(/\.paper-draft-card\s*\{[^}]*border-radius:\s*4px/s.test(adminSubmissionsVue), "paper draft card should use restrained paper-style corners");
assert.ok(adminSubmissionsVue.includes("Fig. 7–Fig. 10"));

const {
	buildSubmissionDataAudit,
	conditionTaskQuestionAnswerTime,
} = require("../src/experiment/questionnaireAnalytics.js");

const auditSubmissionA = {
	participantCode: "P01",
	experimentId: "exp-20260813-audit000",
	savedAt: "2026-08-13T10:30:00.000Z",
	stages: [{ condition: "wikicompare", answers: [
		{ questionId: "Q1", score: 1 },
		{ questionId: "Q2", correctness: "wrong" },
		{ questionId: "Q6", answer: "开放回答" },
	] }],
	postQuestionnaire: { answers: [] },
};
const auditSubmissionB = {
	participantCode: "P02",
	experimentId: "exp-20260814-audit001",
	savedAt: "2026-08-14T01:06:00.000Z",
	mockDataWarning: "old warning",
	stages: [{ condition: "chatgpt", answers: [
		{ questionId: "Q1", correctness: "correct", durationMs: 1000 },
		{ questionId: "Q6", answer: "开放回答", durationMs: 2000 },
	] }],
};
const audit = buildSubmissionDataAudit([auditSubmissionB, auditSubmissionA]);
assert.strictEqual(audit.submissionCount, 2);
assert.deepStrictEqual(audit.participantCodes, ["P01", "P02"]);
assert.strictEqual(audit.mockFlagCount, 1);
assert.strictEqual(audit.taskAnswerCount, 3);
assert.strictEqual(audit.scoredTaskAnswerCount, 3);
assert.strictEqual(audit.q6AnswerCount, 2);
assert.strictEqual(audit.questionnaireCount, 1);
assert.strictEqual(audit.latestSavedAt, "2026-08-14T01:06:00.000Z");

const taskOnlyTime = conditionTaskQuestionAnswerTime([metricSubmission]);
assert.deepStrictEqual(taskOnlyTime.map(row => row.questionId), ["Q1", "Q2", "Q3", "Q4", "Q5"]);
assert.ok(!taskOnlyTime.some(row => row.questionId === "Q6"));

console.log("questionnaire analytics tests passed");
