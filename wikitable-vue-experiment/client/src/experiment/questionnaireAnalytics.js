const {
	COMPARISON_ITEMS,
	QUESTIONNAIRE_ITEMS,
	SUS_ITEMS,
} = require("./postQuestionnaire.js");

const LIKERT_VALUES = [1, 2, 3, 4, 5];
const CONDITION_LABELS = {
	wikicompare: "WikiCompare",
	chatgpt: "GPT",
};
const SUS_BINS = [
	{ label: "0-39", min: 0, max: 39.999 },
	{ label: "40-49", min: 40, max: 49.999 },
	{ label: "50-59", min: 50, max: 59.999 },
	{ label: "60-69", min: 60, max: 69.999 },
	{ label: "70-79", min: 70, max: 79.999 },
	{ label: "80-100", min: 80, max: 100 },
];

const TASK_QUESTION_IDS = ["Q1", "Q2", "Q3", "Q4", "Q5"];
const ALL_EXPERIMENT_QUESTION_IDS = [...TASK_QUESTION_IDS, "Q6"];
const QUESTION_TYPE_LABELS = {
	Q1: "单维事实比较",
	Q2: "结构/组成/变化模式比较",
	Q3: "跨属性综合比较",
	Q4: "背景/过程/原因理解",
	Q5: "综合结论证据验证",
	Q6: "额外发现与问题记录",
};
const SOURCE_LABELS = {
	M: "M 大模型/系统回答",
	A: "A 文章原文",
	T: "T 三栏表格",
	Other: "未记录/其他",
};
const SOURCE_ORDER = ["M", "A", "T", "Other"];

const PAPER_FIGURES = {
	figure7: {
		labelEn: "Fig. 7",
		labelZh: "图 7",
		titleEn: "Condition × question-type accuracy",
		titleZh: "条件 × 题型准确率",
		captionEn: "Task accuracy across Q1-Q5 for the WikiCompare and GPT conditions.",
		captionZh: "WikiCompare 与 GPT 条件在 Q1-Q5 各题型上的任务准确率。",
	},
	figure8: {
		labelEn: "Fig. 8",
		labelZh: "图 8",
		titleEn: "Reading strategy and answer time",
		titleZh: "阅读策略与答题时间",
		captionEn: "Reading time and primary source use across the two reading conditions.",
		captionZh: "两种阅读条件下的答题时间与主要信息来源使用情况。",
	},
	figure9: {
		labelEn: "Fig. 9",
		labelZh: "图 9",
		titleEn: "Q6 exploratory findings and source usage",
		titleZh: "Q6 额外见解与来源",
		captionEn: "Exploratory findings and follow-up questions collected in Q6.",
		captionZh: "Q6 中记录的额外发现与后续问题。",
	},
	figure10: {
		labelEn: "Fig. 10",
		labelZh: "图 10",
		titleEn: "Post-study questionnaire",
		titleZh: "事后问卷",
		captionEn: "Post-study SUS distribution and selected questionnaire item means.",
		captionZh: "事后 SUS 分布与关键问卷题项均值。",
	},
};


const round = (value, digits = 1) => {
	if (!Number.isFinite(value)) return null;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
};

const numericAnswer = answer => {
	const value = Number(String(answer ?? "").trim());
	return Number.isFinite(value) ? value : null;
};

const questionnaireForSubmission = submission => submission?.postQuestionnaire || null;

const questionnaireSubmissions = submissions => (submissions || [])
	.filter(submission => questionnaireForSubmission(submission))
	.map(submission => ({ ...submission, postQuestionnaire: questionnaireForSubmission(submission) }));

const answersById = questionnaire => new Map(
	(questionnaire?.answers || [])
		.filter(answer => answer && answer.questionId)
		.map(answer => [answer.questionId, answer])
);

const answerValue = (questionnaire, questionId) => answersById(questionnaire).get(questionId)?.answer ?? "";

const cleanNumbers = values => (values || []).map(Number).filter(Number.isFinite);

const mean = values => {
	const clean = cleanNumbers(values);
	if (!clean.length) return null;
	return clean.reduce((sum, value) => sum + value, 0) / clean.length;
};

const median = values => {
	const clean = cleanNumbers(values).sort((a, b) => a - b);
	if (!clean.length) return null;
	const middle = Math.floor(clean.length / 2);
	return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
};

const sampleStdDev = values => {
	const clean = cleanNumbers(values);
	if (clean.length < 2) return null;
	const avg = mean(clean);
	const variance = clean.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (clean.length - 1);
	return Math.sqrt(variance);
};

const likertResponsesForItem = (questionnaires, itemId) => questionnaires
	.map(submission => numericAnswer(answerValue(submission.postQuestionnaire, itemId)))
	.filter(value => Number.isInteger(value) && value >= 1 && value <= 5);

const itemDistribution = (questionnaires, item) => {
	const values = likertResponsesForItem(questionnaires, item.id);
	const counts = Object.fromEntries(LIKERT_VALUES.map(value => [value, 0]));
	for (const value of values) {
		counts[value] += 1;
	}
	return {
		id: item.id,
		questionText: item.questionText,
		questionType: item.questionType,
		count: values.length,
		mean: round(mean(values), 2),
		counts,
		segments: LIKERT_VALUES.map(value => ({
			value,
			count: counts[value],
			percent: values.length ? round((counts[value] / values.length) * 100, 1) : 0,
		})),
	};
};

const susHistogram = scores => SUS_BINS.map(bin => {
	const count = scores.filter(score => score >= bin.min && score <= bin.max).length;
	return {
		...bin,
		count,
		percent: scores.length ? round((count / scores.length) * 100, 1) : 0,
	};
});

const durationFromStage = stage => {
	const explicit = Number(stage?.stageDurationMs);
	if (Number.isFinite(explicit)) return explicit;
	const start = Number(stage?.stageStartedAtMs);
	const end = Number(stage?.stageSubmittedAtMs);
	return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
};

const answerDurationFromStage = stage => mean((stage?.answers || []).map(answer => Number(answer?.durationMs)));

const normalizeQuestionId = answer => String(answer?.questionId || answer?.question_id || "").trim().toUpperCase();

const normalizeExperimentSource = value => {
	const raw = String(value ?? "").trim();
	if (!raw) return "Other";
	const normalized = raw.toLowerCase();
	if (["m", "model", "llm", "gpt", "chatgpt", "大模型", "系统回答", "system", "system_answer"].includes(normalized)) return "M";
	if (["a", "article", "articles", "original", "source", "text", "left", "right", "both", "原文", "文章原文"].includes(normalized)) return "A";
	if (["t", "table", "three-column", "three_column", "comparison_table", "三栏表格", "表格"].includes(normalized)) return "T";
	return "Other";
};

const experimentAnswerRows = (submissions, { includeQ6 = true } = {}) => (submissions || []).flatMap(submission => (submission?.stages || []).flatMap(stage => {
	const condition = stage?.condition || "";
	if (!condition) return [];
	return (stage.answers || []).map(answer => {
		const questionId = normalizeQuestionId(answer);
		return {
			experimentId: submission.experimentId || "",
			participantCode: submission.participantCode || "",
			assignmentGroup: submission.assignmentGroup || "",
			stageIndex: Number(stage.stageIndex),
			condition,
			conditionLabel: CONDITION_LABELS[condition] || condition,
			materialId: stage.materialId || "",
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId] || "未识别题型",
			answer,
			durationMs: Number(answer?.durationMs),
			primarySource: normalizeExperimentSource(answer?.primarySource),
		};
	}).filter(row => row.questionId && (includeQ6 || row.questionId !== "Q6"));
}));

const scoreFromAnswer = answer => {
	const explicitScore = Number(answer?.score);
	if (Number.isFinite(explicitScore)) return Math.max(0, Math.min(1, explicitScore));
	const correctness = answer?.correctness;
	if (typeof correctness === "boolean") return correctness ? 1 : 0;
	const numericCorrectness = Number(correctness);
	if (Number.isFinite(numericCorrectness)) return Math.max(0, Math.min(1, numericCorrectness));
	const normalized = String(correctness ?? "").trim().toLowerCase();
	if (["correct", "true", "yes", "right", "对", "正确"].includes(normalized)) return 1;
	if (["partial", "partially_correct", "half", "部分正确", "半对"].includes(normalized)) return 0.5;
	if (["wrong", "incorrect", "false", "no", "错", "错误"].includes(normalized)) return 0;
	return null;
};

const sourceCountsToRows = counts => SOURCE_ORDER.map(source => ({
	source,
	label: SOURCE_LABELS[source],
	count: counts[source] || 0,
	percent: round(Object.values(counts).reduce((sum, count) => sum + count, 0) ? ((counts[source] || 0) / Object.values(counts).reduce((sum, count) => sum + count, 0)) * 100 : 0, 1),
}));

const emptySourceCounts = () => Object.fromEntries(SOURCE_ORDER.map(source => [source, 0]));

const pushSourceCount = (counts, source, increment = 1) => {
	const normalized = SOURCE_ORDER.includes(source) ? source : normalizeExperimentSource(source);
	counts[normalized] = (counts[normalized] || 0) + increment;
};

const summarizeScoredRows = rows => {
	const scoredRows = rows.map(row => ({ ...row, score: scoreFromAnswer(row.answer) })).filter(row => Number.isFinite(row.score));
	const averageScore = mean(scoredRows.map(row => row.score));
	return {
		answerCount: rows.length,
		scoredCount: scoredRows.length,
		unscoredCount: rows.length - scoredRows.length,
		meanScore: round(averageScore, 3),
		accuracyPercent: Number.isFinite(averageScore) ? round(averageScore * 100, 1) : null,
	};
};

const calculateTaskAccuracyStats = submissions => {
	const rows = experimentAnswerRows(submissions, { includeQ6: false }).filter(row => TASK_QUESTION_IDS.includes(row.questionId));
	const byCondition = Object.keys(CONDITION_LABELS).map(condition => {
		const conditionRows = rows.filter(row => row.condition === condition);
		return { condition, label: CONDITION_LABELS[condition], ...summarizeScoredRows(conditionRows) };
	});
	const byQuestion = TASK_QUESTION_IDS.map(questionId => {
		const questionRows = rows.filter(row => row.questionId === questionId);
		return { questionId, questionTypeLabel: QUESTION_TYPE_LABELS[questionId], ...summarizeScoredRows(questionRows) };
	});
	const overall = summarizeScoredRows(rows);
	return {
		totalAnswerCount: overall.answerCount,
		scoredCount: overall.scoredCount,
		unscoredCount: overall.unscoredCount,
		meanScore: overall.meanScore,
		accuracyPercent: overall.accuracyPercent,
		byCondition,
		byQuestion,
	};
};

const sourceUsageFromRows = rows => {
	const counts = emptySourceCounts();
	for (const row of rows) pushSourceCount(counts, row.primarySource);
	return sourceCountsToRows(counts);
};

const calculateSourceUsageStats = submissions => {
	const rows = experimentAnswerRows(submissions, { includeQ6: false }).filter(row => TASK_QUESTION_IDS.includes(row.questionId));
	return {
		totalCount: rows.length,
		overall: sourceUsageFromRows(rows),
		byCondition: Object.keys(CONDITION_LABELS).map(condition => ({
			condition,
			label: CONDITION_LABELS[condition],
			totalCount: rows.filter(row => row.condition === condition).length,
			sources: sourceUsageFromRows(rows.filter(row => row.condition === condition)),
		})),
		byQuestion: TASK_QUESTION_IDS.map(questionId => ({
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId],
			totalCount: rows.filter(row => row.questionId === questionId).length,
			sources: sourceUsageFromRows(rows.filter(row => row.questionId === questionId)),
		})),
	};
};

const validSourceCount = value => {
	const count = Number(value);
	return Number.isFinite(count) && count > 0 ? count : 0;
};

const normalizeQ6Text = answer => String(answer?.answer ?? answer ?? "").trim();

const isEmptyQ6Answer = text => {
	const compact = String(text || "").replace(/[\s\u3000。.!！,，、；;：:]/g, "").toLowerCase();
	return !compact || ["无", "没有", "暂无", "无额外发现", "没有额外发现", "none", "no"].includes(compact);
};

const countQ6TextMatches = (text, patterns) => patterns.reduce((sum, pattern) => sum + (String(text || "").match(pattern) || []).length, 0);

const normalizeQ6SourceValue = value => {
	const raw = String(value || "").trim();
	if (/^M/i.test(raw) || /大模型|系统回答|GPT|ChatGPT/i.test(raw)) return "M";
	if (/^A/i.test(raw) || /文章原文|原文|左侧|右侧/i.test(raw)) return "A";
	if (/^T/i.test(raw) || /三栏表格|表格/i.test(raw)) return "T";
	return raw;
};

const inferQ6SourceFromText = text => {
	const raw = String(text || "");
	if (/顶部对齐|对齐的属性|基于顶部对齐|基于对齐的属性|按.*对齐|三栏表格|表格/.test(raw)) return "T";
	if (/文章原文|原文|左侧证据|右侧证据|左侧材料|右侧材料/.test(raw)) return "A";
	if (/大模型|系统回答|GPT|ChatGPT|模型生成/.test(raw)) return "M";
	return "Other";
};

const inferQ6SourceCountsFromText = (text, validTotal, fallbackSource) => {
	const counts = emptySourceCounts();
	const raw = String(text || "");
	const sourcePattern = /(?:主要(?:触发|参考)?来源|触发来源|信息来源|来源)\s*[：:]?\s*([^\n；;。]+)/g;
	let match;
	while ((match = sourcePattern.exec(raw)) !== null) {
		const value = normalizeQ6SourceValue(match[1]);
		if (!value) continue;
		pushSourceCount(counts, value, 1);
	}
	const mentionedCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
	if (mentionedCount > 0) {
		if (validTotal > mentionedCount) {
			const dominant = SOURCE_ORDER.reduce((best, source) => (counts[source] || 0) > (counts[best] || 0) ? source : best, "Other");
			pushSourceCount(counts, dominant, validTotal - mentionedCount);
		}
		return counts;
	}
	const inferredSource = inferQ6SourceFromText(text);
	if (inferredSource !== "Other") {
		pushSourceCount(counts, inferredSource, validTotal || 1);
		return counts;
	}
	if (validTotal > 0) pushSourceCount(counts, fallbackSource, validTotal);
	return counts;
};

const inferQ6CodingFromText = answer => {
	const text = normalizeQ6Text(answer);
	if (isEmptyQ6Answer(text)) return { validFindings: 0, validQuestions: 0, validTotal: 0, sourceCounts: emptySourceCounts(), inferredFromText: true };

	const findingMarkers = countQ6TextMatches(text, [/发现内容/g, /额外发现/g, /【额外发现】/g]);
	const explicitQuestionMarkers = countQ6TextMatches(text, [/问题内容/g, /额外问题/g, /【额外问题】/g]);
	const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
	const questionLikeLines = lines.filter(line => (
		/[？?]/.test(line)
		|| /^(哪一侧|为什么|为何|是否|能否|哪个|哪种|如何|怎么)/.test(line.replace(/^[-•*\s]+/, ""))
	) && !/当前材料能否回答/.test(line)).length;
	let validQuestions = Math.max(explicitQuestionMarkers, questionLikeLines);
	let validFindings = findingMarkers;

	if (validFindings === 0) {
		const substantiveParagraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(paragraph => {
			if (!paragraph || isEmptyQ6Answer(paragraph)) return false;
			if (/^(主要来源|主要触发来源|触发来源|当前材料能否回答|当前答案和证据|左侧证据|右侧证据)/.test(paragraph)) return false;
			return paragraph.length >= 8;
		});
		validFindings = Math.max(0, substantiveParagraphs.length - validQuestions);
	}
	if (validFindings === 0 && validQuestions === 0 && text.length >= 8) validFindings = 1;

	const validTotal = validFindings + validQuestions;
	return {
		validFindings,
		validQuestions,
		validTotal,
		sourceCounts: inferQ6SourceCountsFromText(text, validTotal, answer?.primarySource),
		inferredFromText: true,
	};
};

const parseQ6Coding = answer => {
	const coding = answer?.q6Coding || answer?.coding || answer?.insightCoding || null;
	if (!coding || typeof coding !== "object") return inferQ6CodingFromText(answer);
	const sourceCounts = emptySourceCounts();
	let validFindings = validSourceCount(coding.validFindings ?? coding.findingCount ?? coding.findingsCount);
	let validQuestions = validSourceCount(coding.validQuestions ?? coding.questionCount ?? coding.questionsCount);
	const addItems = (items, kind) => {
		if (!Array.isArray(items)) return;
		let validCount = 0;
		for (const item of items) {
			if (item?.valid === false) continue;
			validCount += 1;
			pushSourceCount(sourceCounts, item?.source || item?.primarySource || coding.source);
		}
		if (kind === "finding" && validFindings === 0) validFindings = validCount;
		if (kind === "question" && validQuestions === 0) validQuestions = validCount;
	};
	addItems(coding.findings, "finding");
	addItems(coding.questions, "question");
	for (const [source, count] of Object.entries(coding.sourceCounts || coding.sources || {})) {
		pushSourceCount(sourceCounts, source, validSourceCount(count));
	}
	if (!Object.values(sourceCounts).some(Boolean) && (validFindings || validQuestions)) {
		pushSourceCount(sourceCounts, coding.source || answer?.primarySource, validFindings + validQuestions);
	}
	return {
		validFindings,
		validQuestions,
		validTotal: validFindings + validQuestions,
		sourceCounts,
	};
};

const calculateQ6InsightStats = submissions => {
	const rows = experimentAnswerRows(submissions).filter(row => row.questionId === "Q6");
	const codedRows = rows.map(row => ({ ...row, coding: parseQ6Coding(row.answer) })).filter(row => row.coding);
	const sourceCounts = emptySourceCounts();
	let validFindings = 0;
	let validQuestions = 0;
	for (const row of codedRows) {
		validFindings += row.coding.validFindings;
		validQuestions += row.coding.validQuestions;
		for (const [source, count] of Object.entries(row.coding.sourceCounts)) pushSourceCount(sourceCounts, source, count);
	}
	return {
		q6AnswerCount: rows.length,
		codedAnswerCount: codedRows.length,
		uncodedAnswerCount: rows.length - codedRows.length,
		validFindings,
		validQuestions,
		validTotal: validFindings + validQuestions,
		meanValidTotalPerAnswer: round(mean(codedRows.map(row => row.coding.validTotal)), 2),
		sourceUsage: {
			totalCount: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0),
			overall: sourceCountsToRows(sourceCounts),
		},
		byCondition: Object.keys(CONDITION_LABELS).map(condition => {
			const conditionRows = codedRows.filter(row => row.condition === condition);
			const conditionSourceCounts = emptySourceCounts();
			for (const row of conditionRows) {
				for (const [source, count] of Object.entries(row.coding.sourceCounts)) pushSourceCount(conditionSourceCounts, source, count);
			}
			return {
				condition,
				label: CONDITION_LABELS[condition],
				answerCount: rows.filter(row => row.condition === condition).length,
				codedAnswerCount: conditionRows.length,
				validFindings: conditionRows.reduce((sum, row) => sum + row.coding.validFindings, 0),
				validQuestions: conditionRows.reduce((sum, row) => sum + row.coding.validQuestions, 0),
				validTotal: conditionRows.reduce((sum, row) => sum + row.coding.validTotal, 0),
				meanValidTotalPerAnswer: round(mean(conditionRows.map(row => row.coding.validTotal)), 2),
				sourceUsage: {
					totalCount: Object.values(conditionSourceCounts).reduce((sum, count) => sum + count, 0),
					overall: sourceCountsToRows(conditionSourceCounts),
				},
			};
		}),
	};
};

const summarizeDurationRows = rows => summarizeNumbers(rows.map(row => row.durationMs));

const calculateAnswerTimeStats = submissions => {
	const rows = experimentAnswerRows(submissions).filter(row => ALL_EXPERIMENT_QUESTION_IDS.includes(row.questionId) && Number.isFinite(row.durationMs));
	return {
		answerCount: rows.length,
		byQuestion: ALL_EXPERIMENT_QUESTION_IDS.map(questionId => ({
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId],
			...summarizeDurationRows(rows.filter(row => row.questionId === questionId)),
		})),
		q1ToQ5ByCondition: Object.keys(CONDITION_LABELS).map(condition => ({
			condition,
			label: CONDITION_LABELS[condition],
			...summarizeDurationRows(rows.filter(row => row.condition === condition && TASK_QUESTION_IDS.includes(row.questionId))),
		})),
		q6ByCondition: Object.keys(CONDITION_LABELS).map(condition => ({
			condition,
			label: CONDITION_LABELS[condition],
			...summarizeDurationRows(rows.filter(row => row.condition === condition && row.questionId === "Q6")),
		})),
		byConditionQuestion: Object.keys(CONDITION_LABELS).flatMap(condition => ALL_EXPERIMENT_QUESTION_IDS.map(questionId => ({
			condition,
			label: CONDITION_LABELS[condition],
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId],
			...summarizeDurationRows(rows.filter(row => row.condition === condition && row.questionId === questionId)),
		}))),
	};
};

const stageRowsForSubmissions = submissions => (submissions || []).flatMap(submission => (submission?.stages || [])
	.filter(stage => stage && stage.condition)
	.map(stage => ({
		experimentId: submission.experimentId || "",
		participantCode: submission.participantCode || "",
		assignmentGroup: submission.assignmentGroup || "",
		stageIndex: Number(stage.stageIndex),
		condition: stage.condition,
		conditionLabel: CONDITION_LABELS[stage.condition] || stage.condition,
		materialId: stage.materialId || "",
		durationMs: durationFromStage(stage),
		averageAnswerDurationMs: answerDurationFromStage(stage),
		answerCount: (stage.answers || []).length,
	})));

const summarizeNumbers = values => {
	const clean = cleanNumbers(values);
	return {
		count: clean.length,
		mean: round(mean(clean), 0),
		median: round(median(clean), 0),
		stdDev: round(sampleStdDev(clean), 0),
		min: clean.length ? Math.min(...clean) : null,
		max: clean.length ? Math.max(...clean) : null,
	};
};

const conditionDurationStats = submissions => {
	const rows = stageRowsForSubmissions(submissions);
	return Object.keys(CONDITION_LABELS).map(condition => {
		const conditionRows = rows.filter(row => row.condition === condition);
		return {
			condition,
			label: CONDITION_LABELS[condition],
			...summarizeNumbers(conditionRows.map(row => row.durationMs)),
			answerDurationMean: round(mean(conditionRows.map(row => row.averageAnswerDurationMs)), 0),
			stageRows: conditionRows,
		};
	});
};

const assignmentDistribution = submissions => {
	const counts = {};
	for (const submission of submissions || []) {
		const group = submission?.assignmentGroup || "未记录";
		counts[group] = (counts[group] || 0) + 1;
	}
	return Object.keys(counts).sort().map(group => ({
		group,
		count: counts[group],
		percent: submissions?.length ? round((counts[group] / submissions.length) * 100, 1) : 0,
	}));
};

const pairedConditionDifferences = submissions => {
	const rows = [];
	for (const submission of submissions || []) {
		const stages = submission?.stages || [];
		const wikiStage = stages.find(stage => stage.condition === "wikicompare");
		const gptStage = stages.find(stage => stage.condition === "chatgpt");
		const wikiDuration = durationFromStage(wikiStage);
		const gptDuration = durationFromStage(gptStage);
		if (Number.isFinite(wikiDuration) && Number.isFinite(gptDuration)) {
			rows.push({
				experimentId: submission.experimentId || "",
				participantCode: submission.participantCode || "",
				assignmentGroup: submission.assignmentGroup || "",
				wikiDurationMs: wikiDuration,
				gptDurationMs: gptDuration,
				differenceMs: wikiDuration - gptDuration,
			});
		}
	}
	return {
		rows,
		meanDifferenceMs: round(mean(rows.map(row => row.differenceMs)), 0),
		medianDifferenceMs: round(median(rows.map(row => row.differenceMs)), 0),
	};
};


const conditionQuestionAccuracy = submissions => {
	const rows = experimentAnswerRows(submissions, { includeQ6: false }).filter(row => TASK_QUESTION_IDS.includes(row.questionId));
	return TASK_QUESTION_IDS.map(questionId => {
		const perCondition = Object.fromEntries(Object.keys(CONDITION_LABELS).map(condition => [
			condition,
			{ condition, label: CONDITION_LABELS[condition], ...summarizeScoredRows(rows.filter(row => row.condition === condition && row.questionId === questionId)) },
		]));
		const wiki = perCondition.wikicompare;
		const gpt = perCondition.chatgpt;
		const differencePercent = Number.isFinite(wiki.accuracyPercent) && Number.isFinite(gpt.accuracyPercent)
			? round(wiki.accuracyPercent - gpt.accuracyPercent, 1)
			: null;
		return {
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId],
			...perCondition,
			differencePercent,
		};
	});
};

const conditionTaskQuestionAnswerTime = submissions => conditionQuestionAnswerTime(submissions, TASK_QUESTION_IDS);

const dominantSourceFromRows = sourceRows => {
	const rows = (sourceRows || []).filter(row => row.source !== "Other");
	if (!rows.length) return { source: "Other", label: SOURCE_LABELS.Other, count: 0, percent: 0 };
	return rows.reduce((best, row) => (Number(row.count) || 0) > (Number(best.count) || 0) ? row : best, rows[0]);
};

const conditionQuestionSourceUsage = submissions => {
	const rows = experimentAnswerRows(submissions, { includeQ6: false }).filter(row => TASK_QUESTION_IDS.includes(row.questionId));
	return TASK_QUESTION_IDS.map(questionId => {
		const result = { questionId, questionTypeLabel: QUESTION_TYPE_LABELS[questionId] };
		for (const condition of Object.keys(CONDITION_LABELS)) {
			const scoped = rows.filter(row => row.condition === condition && row.questionId === questionId);
			const sources = sourceUsageFromRows(scoped);
			const dominant = dominantSourceFromRows(sources);
			result[condition] = {
				condition,
				label: CONDITION_LABELS[condition],
				totalCount: scoped.length,
				sources,
				dominantSource: dominant.source,
				dominantLabel: dominant.label,
				dominantPercent: dominant.percent,
			};
		}
		return result;
	});
};

const conditionQuestionAnswerTime = (submissions, questionIds = ALL_EXPERIMENT_QUESTION_IDS) => {
	const scopedQuestionIds = questionIds && questionIds.length ? questionIds : ALL_EXPERIMENT_QUESTION_IDS;
	const rows = experimentAnswerRows(submissions).filter(row => scopedQuestionIds.includes(row.questionId) && Number.isFinite(row.durationMs));
	return scopedQuestionIds.map(questionId => {
		const perCondition = Object.fromEntries(Object.keys(CONDITION_LABELS).map(condition => [
			condition,
			{ condition, label: CONDITION_LABELS[condition], ...summarizeDurationRows(rows.filter(row => row.condition === condition && row.questionId === questionId)) },
		]));
		const differenceMs = Number.isFinite(perCondition.wikicompare.mean) && Number.isFinite(perCondition.chatgpt.mean)
			? round(perCondition.wikicompare.mean - perCondition.chatgpt.mean, 0)
			: null;
		return {
			questionId,
			questionTypeLabel: QUESTION_TYPE_LABELS[questionId],
			...perCondition,
			differenceMs,
		};
	});
};

const firstFinite = (...values) => values.find(value => Number.isFinite(Number(value)));
const formatNumberForText = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "not available";
const formatPercentForText = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "not yet scored";
const formatSecondsForText = value => Number.isFinite(Number(value)) ? `${round(Number(value) / 1000, 1)}s` : "not available";
const hasMockData = submissions => (submissions || []).some(isMockSubmission);
const formatDeltaPoints = value => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${formatNumberForText(value)} pp` : "—";

const buildPaperMetricRows = (resultStats, questionnaireStats, accuracyMatrix, highlights) => {
	const wikiQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "wikicompare");
	const gptQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "chatgpt");
	return [
		{
			metric: "Q1-Q5 accuracy",
			wikicompare: formatPercentForText(highlights.wikiAccuracy),
			chatgpt: formatPercentForText(highlights.gptAccuracy),
			delta: formatDeltaPoints(highlights.accuracyDifference),
			interpretation: "Overall scored-task performance; report only after manual scoring is complete.",
		},
		...accuracyMatrix.map(row => ({
			metric: `${row.questionId} ${row.questionTypeLabel}`,
			wikicompare: formatPercentForText(row.wikicompare?.accuracyPercent),
			chatgpt: formatPercentForText(row.chatgpt?.accuracyPercent),
			delta: formatDeltaPoints(row.differencePercent),
			interpretation: row.differencePercent === null ? "Not fully scored." : row.differencePercent > 5 ? "WikiCompare advantage." : row.differencePercent < -5 ? "GPT advantage." : "Comparable performance.",
		})),
		{
			metric: "Q1-Q5 mean answer time",
			wikicompare: formatSecondsForText(highlights.wikiMeanQ1ToQ5Ms),
			chatgpt: formatSecondsForText(highlights.gptMeanQ1ToQ5Ms),
			delta: formatSecondsForText(highlights.timeDifferenceMs),
			interpretation: "Use with accuracy by question type; lower time is not automatically better.",
		},
		{
			metric: "Q6 valid findings/questions per answer",
			wikicompare: formatNumberForText(wikiQ6?.meanValidTotalPerAnswer, 2),
			chatgpt: formatNumberForText(gptQ6?.meanValidTotalPerAnswer, 2),
			delta: Number.isFinite(Number(wikiQ6?.meanValidTotalPerAnswer)) && Number.isFinite(Number(gptQ6?.meanValidTotalPerAnswer)) ? formatNumberForText(wikiQ6.meanValidTotalPerAnswer - gptQ6.meanValidTotalPerAnswer, 2) : "—",
			interpretation: "Exploratory reading output after the fixed questions.",
		},
		{
			metric: "Post-study SUS",
			wikicompare: formatNumberForText(questionnaireStats.averageSus),
			chatgpt: "N/A",
			delta: "N/A",
			interpretation: "The questionnaire primarily evaluates the WikiCompare system experience.",
		},
	];
};

const paperResultHighlights = submissions => {
	const resultStats = calculateExperimentResultStats(submissions);
	const dataAudit = buildSubmissionDataAudit(submissions);
	const questionnaireStats = calculateQuestionnaireStats(submissions);
	const accuracyMatrix = conditionQuestionAccuracy(submissions);
	const sourceMatrix = conditionQuestionSourceUsage(submissions);
	const timeMatrix = conditionQuestionAnswerTime(submissions);
	const containsMockData = hasMockData(submissions);
	const wikiAccuracy = resultStats.taskAccuracy.byCondition.find(row => row.condition === "wikicompare")?.accuracyPercent;
	const gptAccuracy = resultStats.taskAccuracy.byCondition.find(row => row.condition === "chatgpt")?.accuracyPercent;
	const wikiTime = resultStats.answerTime.q1ToQ5ByCondition.find(row => row.condition === "wikicompare")?.mean;
	const gptTime = resultStats.answerTime.q1ToQ5ByCondition.find(row => row.condition === "chatgpt")?.mean;
	const advantageQuestions = accuracyMatrix
		.filter(row => Number.isFinite(row.differencePercent) && row.differencePercent > 0)
		.sort((a, b) => b.differencePercent - a.differencePercent)
		.slice(0, 3)
		.map(row => `${row.questionId} (${row.questionTypeLabel}, +${formatNumberForText(row.differencePercent)} points)`);
	const closeQuestions = accuracyMatrix
		.filter(row => Number.isFinite(row.differencePercent) && Math.abs(row.differencePercent) <= 5)
		.map(row => `${row.questionId} (${row.questionTypeLabel})`);
	const wikiSources = resultStats.sourceUsage.byCondition.find(row => row.condition === "wikicompare")?.sources || [];
	const gptSources = resultStats.sourceUsage.byCondition.find(row => row.condition === "chatgpt")?.sources || [];
	const wikiTopSource = dominantSourceFromRows(wikiSources);
	const gptTopSource = dominantSourceFromRows(gptSources);
	const wikiQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "wikicompare");
	const gptQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "chatgpt");
	const accuracyDifference = Number.isFinite(wikiAccuracy) && Number.isFinite(gptAccuracy) ? round(wikiAccuracy - gptAccuracy, 1) : null;
	const timeDifferenceMs = Number.isFinite(wikiTime) && Number.isFinite(gptTime) ? round(wikiTime - gptTime, 0) : null;
	const paperMetricRows = buildPaperMetricRows(resultStats, questionnaireStats, accuracyMatrix, {
		wikiAccuracy,
		gptAccuracy,
		accuracyDifference,
		wikiMeanQ1ToQ5Ms: wikiTime,
		gptMeanQ1ToQ5Ms: gptTime,
		timeDifferenceMs,
	});
	return {
		submissionCount: resultStats.submissionCount,
		questionnaireCount: resultStats.questionnaireCount,
		dataAudit,
		hasMockData: containsMockData,
		mockWarning: containsMockData ? "Current submissions include deterministic mock/test data. Do not report these numbers as real findings." : "",
		wikiAccuracy,
		gptAccuracy,
		accuracyDifference,
		wikiMeanQ1ToQ5Ms: wikiTime,
		gptMeanQ1ToQ5Ms: gptTime,
		timeDifferenceMs,
		advantageQuestions,
		closeQuestions,
		wikiTopSource,
		gptTopSource,
		wikiQ6Mean: wikiQ6?.meanValidTotalPerAnswer,
		gptQ6Mean: gptQ6?.meanValidTotalPerAnswer,
		averageSus: questionnaireStats.averageSus,
		cmpEvidenceMean: questionnaireStats.comparisonMeans.find(row => row.id === "CMP2")?.mean,
		accuracySentence: `${PAPER_FIGURES.figure7.labelEn} shows WikiCompare scored ${formatPercentForText(wikiAccuracy)} on Q1-Q5, compared with ${formatPercentForText(gptAccuracy)} for GPT${Number.isFinite(wikiAccuracy) && Number.isFinite(gptAccuracy) ? ` (${wikiAccuracy >= gptAccuracy ? "+" : ""}${formatNumberForText(wikiAccuracy - gptAccuracy)} percentage points)` : ""}.`,
		taskSentence: advantageQuestions.length ? `The largest WikiCompare advantages in ${PAPER_FIGURES.figure7.labelEn} appeared in ${advantageQuestions.join(", ")}.` : "No question type currently shows a scored WikiCompare advantage.",
		sourceSentence: `${PAPER_FIGURES.figure8.labelEn} shows participants mainly used ${wikiTopSource.source} in WikiCompare (${formatPercentForText(wikiTopSource.percent)}) and ${gptTopSource.source} in GPT (${formatPercentForText(gptTopSource.percent)}).`,
		timeSentence: `${PAPER_FIGURES.figure8.labelEn} shows mean Q1-Q5 answer time was ${formatSecondsForText(wikiTime)} in WikiCompare and ${formatSecondsForText(gptTime)} in GPT.`,
		q6Sentence: `${PAPER_FIGURES.figure9.labelEn} shows WikiCompare produced ${formatNumberForText(wikiQ6?.meanValidTotalPerAnswer, 2)} valid Q6 items per answer on average, compared with ${formatNumberForText(gptQ6?.meanValidTotalPerAnswer, 2)} in GPT.`,
		questionnaireSentence: `${PAPER_FIGURES.figure10.labelEn} shows an average SUS score of ${formatNumberForText(questionnaireStats.averageSus)} and a CMP2 evidence-finding mean of ${formatNumberForText(questionnaireStats.comparisonMeans.find(row => row.id === "CMP2")?.mean, 2)} / 5.`,
		paperMetricRows,
		sourceMatrix,
		timeMatrix,
		paperFigures: PAPER_FIGURES,
		paperViewStyle: "system-evaluation",
	};
};

const representativeQ6Answers = (submissions, limit = 4) => {
	const rows = experimentAnswerRows(submissions).filter(row => row.questionId === "Q6" && String(row.answer?.answer || "").trim());
	return rows.slice(0, limit).map(row => ({
		participantCode: row.participantCode,
		condition: row.condition,
		conditionLabel: row.conditionLabel,
		materialId: row.materialId,
		text: String(row.answer.answer).trim(),
		coding: parseQ6Coding(row.answer),
	}));
};

const openFeedbackExamples = (submissions, limit = 6) => questionnaireSubmissions(submissions).flatMap(submission => {
	const questionnaire = submission.postQuestionnaire;
	return ["WF_HELPFUL", "WF_IMPROVE"].map(questionId => {
		const answer = answersById(questionnaire).get(questionId);
		return answer && String(answer.answer || "").trim() ? {
			participantCode: submission.participantCode || "",
			questionId,
			questionText: answer.questionText,
			text: String(answer.answer).trim(),
		} : null;
	}).filter(Boolean);
}).slice(0, limit);


const generatePaperDraftSections = submissions => {
	const resultStats = calculateExperimentResultStats(submissions);
	const questionnaireStats = calculateQuestionnaireStats(submissions);
	const highlights = paperResultHighlights(submissions);
	const containsMockData = hasMockData(submissions);
	const dataDescriptor = containsMockData ? "mock/test submissions" : "completed submissions";
	const dataDescriptorZh = containsMockData ? "模拟/测试提交数据" : "已完成提交数据";
	const draftWarning = containsMockData
		? "This draft was generated from deterministic mock/test data and must not be reported as real participant data."
		: "This draft was generated from current real participant data; still verify all scoring, coding, and statistical wording before submission.";
	const draftWarningZh = containsMockData
		? "本草稿由确定性的模拟/测试数据生成，不能作为真实参与者实验结果写入论文。"
		: "本草稿由当前真实参与者数据自动生成；提交论文前仍需核对评分、编码与统计表述。";
	const accuracyMatrix = conditionQuestionAccuracy(submissions);
	const timeMatrix = conditionQuestionAnswerTime(submissions);
	const wikiAcc = formatPercentForText(highlights.wikiAccuracy);
	const gptAcc = formatPercentForText(highlights.gptAccuracy);
	const q1Row = accuracyMatrix.find(row => row.questionId === "Q1");
	const q2Row = accuracyMatrix.find(row => row.questionId === "Q2");
	const q3Row = accuracyMatrix.find(row => row.questionId === "Q3");
	const q4Row = accuracyMatrix.find(row => row.questionId === "Q4");
	const q5Row = accuracyMatrix.find(row => row.questionId === "Q5");
	const q1Time = timeMatrix.find(row => row.questionId === "Q1");
	const wikiQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "wikicompare");
	const gptQ6 = resultStats.q6Insights.byCondition.find(row => row.condition === "chatgpt");
	const figure7Zh = PAPER_FIGURES.figure7.labelZh;
	const figure8Zh = PAPER_FIGURES.figure8.labelZh;
	const figure9Zh = PAPER_FIGURES.figure9.labelZh;
	const figure10Zh = PAPER_FIGURES.figure10.labelZh;
	const figure7En = PAPER_FIGURES.figure7.labelEn;
	const figure8En = PAPER_FIGURES.figure8.labelEn;
	const figure9En = PAPER_FIGURES.figure9.labelEn;
	const figure10En = PAPER_FIGURES.figure10.labelEn;
	const paperTitleZh = "5 系统评估";
	const paperTitleEn = "5 System Evaluation";

	const studyIntroEn = `To evaluate WikiCompare for controlled comparative reading, we conducted a within-subject study in which each participant completed two reading conditions: the WikiCompare interface and a controlled GPT-style multi-tab interface. Each condition used a frozen pair of Wikipedia-derived articles and the same set of comparison questions for the corresponding material.`;
	const studyDesignEn = `The study adopted a within-subject design where each participant experienced both conditions in a balanced order determined by the experiment assignment. The task set contained five predefined question types that progressed from direct factual lookup to evidence-based synthesis, and an additional open-ended prompt after the fixed questions.`;
	const studyIntroZh = `为评估 WikiCompare 在受控比较阅读中的支持能力，我们采用被试内实验设计。每位参与者依次完成 WikiCompare 条件和 GPT 条件，两种条件均使用冻结后的维基百科材料对与相同题目集，并由实验编号自动平衡条件顺序。`;
	const studyDesignZh = `任务围绕五类比较问题展开，覆盖从单维事实查找到证据验证的不同阅读深度；在固定题目之后，参与者还需要完成 Q6 开放题，用于记录额外发现和未决问题。`;

	const procedureConditionEn = `In the WikiCompare condition, participants used the integrated comparison interface with synchronized article views, traceable highlights, and the three-column comparison table. In the GPT condition, participants used a controlled GPT-style web page initialized with the same two articles and the corresponding comparison table, and they could switch among the provided tabs while answering questions.`;
	const procedureConditionZh = `在阅读条件上，WikiCompare 提供原系统的比较阅读界面、可追踪高亮与三栏比较表；GPT 条件则使用纯 GPT 网页，初始化时已经输入相同的两篇文章和比较表，参与者可以在标签页之间自由切换，但界面本身保持受控。`;
	const procedureTasksEn = `The question set was organized to capture both shallow and deep reading behaviors: Q1 asked for single-dimensional factual comparison, Q2 for structural or compositional comparison, Q3 for cross-attribute synthesis, Q4 for background/process/reasoning comprehension, and Q5 for evidence-based verification of a synthesized conclusion. Q6 asked participants to record additional findings and questions that emerged during reading.`;
	const procedureTasksZh = `题目被明确划分为五类：Q1 单维事实比较，Q2 结构/组成/变化模式比较，Q3 跨属性综合比较，Q4 背景/过程/原因理解，Q5 综合结论证据验证；Q6 则要求参与者记录阅读过程中产生的额外发现与问题。`;
	const procedureQuestionnaireEn = `After both conditions were completed, participants filled out a post-study questionnaire. The questionnaire emphasized the WikiCompare system experience with a standardized SUS scale and a small set of comparison items that targeted evidence finding and comparative reading, while GPT served only as the control reading environment.`;
	const procedureQuestionnaireZh = `在两个条件都完成之后，参与者填写事后问卷。该问卷以正式的 SUS 量表评价 WikiCompare 的整体可用性，并辅以若干比较题项考察其证据查找与比较阅读体验；GPT 仅作为对照阅读环境，而不是单独评价对象。`;

	const resultsLeadEn = `${figure7En} summarizes accuracy across the two conditions. Across ${resultStats.submissionCount} ${dataDescriptor}, WikiCompare achieved an average Q1-Q5 score of ${wikiAcc}, compared with ${gptAcc} for the GPT condition.`;
	const resultsLeadZh = `如${figure7Zh} 所示，两种条件下的任务准确率呈现出差异。在 ${resultStats.submissionCount} 份${dataDescriptorZh}中，WikiCompare 在 Q1-Q5 上的平均得分为 ${wikiAcc}，GPT 条件为 ${gptAcc}。`;
	const resultsQ1En = `The factual comparison task (Q1) was relatively close (${formatPercentForText(q1Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q1Row?.chatgpt?.accuracyPercent)}), suggesting that direct fact lookup can be supported by either interface. In contrast, WikiCompare showed clearer advantages on structurally demanding tasks such as Q2 (${formatPercentForText(q2Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q2Row?.chatgpt?.accuracyPercent)}), Q3 (${formatPercentForText(q3Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q3Row?.chatgpt?.accuracyPercent)}), and Q5 (${formatPercentForText(q5Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q5Row?.chatgpt?.accuracyPercent)}). Q4 was closer (${formatPercentForText(q4Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q4Row?.chatgpt?.accuracyPercent)}), indicating that narrative background and process comprehension still required careful article reading in both conditions.`;
	const resultsQ1Zh = `事实比较任务 Q1 的表现相对接近（${formatPercentForText(q1Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q1Row?.chatgpt?.accuracyPercent)}），说明直接事实查找可以由两种界面较好地支持。相比之下，在结构要求更高的任务中，WikiCompare 表现出更明显的优势，例如 Q2（${formatPercentForText(q2Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q2Row?.chatgpt?.accuracyPercent)}）、Q3（${formatPercentForText(q3Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q3Row?.chatgpt?.accuracyPercent)}）和 Q5（${formatPercentForText(q5Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q5Row?.chatgpt?.accuracyPercent)}）。Q4 的差距较小（${formatPercentForText(q4Row?.wikicompare?.accuracyPercent)} vs. ${formatPercentForText(q4Row?.chatgpt?.accuracyPercent)}），这表明对叙事背景和过程的理解在两个条件下仍然都需要参与者仔细阅读文章文本。`;
	const resultsStrategyEn = `${figure8En} summarizes reading strategy and completion time. In WikiCompare, participants primarily relied on ${highlights.wikiTopSource.source} (${formatPercentForText(highlights.wikiTopSource.percent)}); in GPT, they primarily relied on ${highlights.gptTopSource.source} (${formatPercentForText(highlights.gptTopSource.percent)}). Mean Q1-Q5 answer time was ${formatSecondsForText(highlights.wikiMeanQ1ToQ5Ms)} in WikiCompare and ${formatSecondsForText(highlights.gptMeanQ1ToQ5Ms)} in GPT, while Q1 alone took ${formatSecondsForText(q1Time?.wikicompare?.mean)} versus ${formatSecondsForText(q1Time?.chatgpt?.mean)}.`;
	const resultsStrategyZh = `如${figure8Zh} 所示，参与者在两种条件下呈现出不同的信息来源选择与答题时间模式。在 WikiCompare 条件下，参与者主要依赖 ${highlights.wikiTopSource.source}（${formatPercentForText(highlights.wikiTopSource.percent)}）；在 GPT 条件下，参与者主要依赖 ${highlights.gptTopSource.source}（${formatPercentForText(highlights.gptTopSource.percent)}）。Q1-Q5 的平均答题时间在 WikiCompare 条件下为 ${formatSecondsForText(highlights.wikiMeanQ1ToQ5Ms)}，在 GPT 条件下为 ${formatSecondsForText(highlights.gptMeanQ1ToQ5Ms)}；其中 Q1 为 ${formatSecondsForText(q1Time?.wikicompare?.mean)} vs. ${formatSecondsForText(q1Time?.chatgpt?.mean)}。`;
	const resultsQ6En = `${figure9En} shows that WikiCompare produced ${formatNumberForText(wikiQ6?.meanValidTotalPerAnswer, 2)} valid Q6 items per answer on average, compared with ${formatNumberForText(gptQ6?.meanValidTotalPerAnswer, 2)} in GPT. ${figure10En} shows an average SUS score of ${formatNumberForText(questionnaireStats.averageSus)} and a CMP2 evidence-finding mean of ${formatNumberForText(questionnaireStats.comparisonMeans.find(row => row.id === "CMP2")?.mean, 2)} / 5.`;
	const resultsQ6Zh = `如${figure9Zh} 所示，Q6 记录了参与者在固定题目之外形成的探索性发现和后续问题。WikiCompare 平均每个回答产生 ${formatNumberForText(wikiQ6?.meanValidTotalPerAnswer, 2)} 个有效的额外发现/问题，而 GPT 条件为 ${formatNumberForText(gptQ6?.meanValidTotalPerAnswer, 2)} 个。${figure10Zh} 总结了事后问卷结果，其中平均 SUS 得分为 ${formatNumberForText(questionnaireStats.averageSus)}，CMP2（证据查找相关题项）平均得分为 ${formatNumberForText(questionnaireStats.comparisonMeans.find(row => row.id === "CMP2")?.mean, 2)} / 5。`;
	const discussionEn = `Taken together, Figures 7-10 suggest that WikiCompare's value is not simply that it provides another generated summary. Instead, the system appears most useful when comparative reading requires aligning attributes, checking evidence, and integrating information across multiple parts of two articles. The close performance on Q1 indicates that simple fact lookup does not fully capture the system's contribution; GPT-style summarization and article tabs can be sufficient for direct factual questions. WikiCompare's stronger performance on Q2, Q3, and Q5 suggests that the three-column table, visual encodings, and traceable highlights help users maintain a stable comparison structure while verifying evidence. The Q6 pattern also indicates that WikiCompare may support exploratory reading by helping users notice additional comparable attributes and unresolved questions. At the same time, Q4 and the open feedback highlight limits of the current interface: background and process understanding still depends on careful article reading, and dense tables or visualizations may introduce their own learning cost.`;
	const discussionZh = `综合图 7-图 10 可以看出，WikiCompare 的价值并不只是“多生成了一段摘要”，而在于它更适合支持比较阅读中的属性对齐、证据核对与跨段整合。Q1 的差距较小，说明单纯的事实检索并不能完全体现系统贡献：对于直接事实问题，GPT 风格总结与文章标签页已经足够。相比之下，Q2、Q3 和 Q5 上更明显的优势表明，三栏表、视觉编码和可追踪高亮有助于参与者维持稳定的比较结构，并完成证据验证。Q6 的结果也提示，WikiCompare 可能支持探索式阅读，因为它帮助参与者注意到更多可比较属性和未决问题。与此同时，Q4 与开放反馈也揭示出当前界面的局限：背景和过程理解仍然依赖对文章正文的细致阅读，而过于密集的表格或图形会带来额外学习成本。后续迭代应保留可追踪的比较结构，同时加强对长篇叙事证据的支持，并进一步降低视觉复杂度。`;

	const paperSectionsEn = [
		{ label: "5.1", title: "Participants and study design", paragraphs: [studyIntroEn, studyDesignEn] },
		{
			label: "5.2",
			title: "Experimental procedure",
			subsections: [
				{ label: "5.2.1", title: "Reading conditions", paragraphs: [procedureConditionEn] },
				{ label: "5.2.2", title: "Comparative reading tasks", paragraphs: [procedureTasksEn] },
				{ label: "5.2.3", title: "Post-study questionnaire", paragraphs: [procedureQuestionnaireEn] },
			],
		},
		{
			label: "5.3",
			title: "Evaluation results",
			subsections: [
				{ label: "5.3.1", title: "Task Accuracy across Question Types", paragraphs: [resultsLeadEn, resultsQ1En] },
				{ label: "5.3.2", title: "Reading Strategy and Evidence Use", paragraphs: [resultsStrategyEn] },
				{ label: "5.3.3", title: "Exploratory Findings and Questionnaire", paragraphs: [resultsQ6En] },
			],
		},
		{ label: "5.4", title: "Discussion", paragraphs: [discussionEn] },
	];

	const paperSectionsZh = [
		{ label: "5.1", title: "参与者与实验设计", paragraphs: [studyIntroZh, studyDesignZh] },
		{
			label: "5.2",
			title: "实验流程",
			subsections: [
				{ label: "5.2.1", title: "阅读条件", paragraphs: [procedureConditionZh] },
				{ label: "5.2.2", title: "比较阅读任务", paragraphs: [procedureTasksZh] },
				{ label: "5.2.3", title: "事后问卷", paragraphs: [procedureQuestionnaireZh] },
			],
		},
		{
			label: "5.3",
			title: "评估结果",
			subsections: [
				{ label: "5.3.1", title: "不同题型下的任务准确率", paragraphs: [resultsLeadZh, resultsQ1Zh] },
				{ label: "5.3.2", title: "阅读策略与证据使用", paragraphs: [resultsStrategyZh] },
				{ label: "5.3.3", title: "探索性发现与问卷反馈", paragraphs: [resultsQ6Zh] },
			],
		},
		{ label: "5.4", title: "讨论", paragraphs: [discussionZh] },
	];

	const escapeLatex = value => String(value || "")
		.replace(/\\/g, "\\textbackslash{}")
		.replace(/&/g, "\\&")
		.replace(/%/g, "\\%")
		.replace(/\$/g, "\\$")
		.replace(/#/g, "\\#")
		.replace(/_/g, "\\_")
		.replace(/\{/g, "\\{")
		.replace(/\}/g, "\\}")
		.replace(/~/g, "\\textasciitilde{}")
		.replace(/\^/g, "\\textasciicircum{}");
	const flattenSectionText = sections => sections.flatMap(section => {
		const blocks = [];
		if (section.label && section.title) blocks.push(`${section.label} ${section.title}`);
		blocks.push(...(section.paragraphs || []));
		(section.subsections || []).forEach(subsection => {
			blocks.push(`${subsection.label} ${subsection.title}`);
			blocks.push(...(subsection.paragraphs || []));
		});
		return blocks;
	}).join("\n\n");
	const latexSection = (section, command = "subsection") => {
		const blocks = [`\\${command}{${escapeLatex(`${section.label} ${section.title}`.trim())}}`];
		(section.paragraphs || []).forEach(paragraph => blocks.push(escapeLatex(paragraph)));
		(section.subsections || []).forEach(subsection => {
			blocks.push(`\\subsubsection{${escapeLatex(`${subsection.label} ${subsection.title}`.trim())}}`);
			(subsection.paragraphs || []).forEach(paragraph => blocks.push(escapeLatex(paragraph)));
		});
		return blocks.join("\n\n");
	};
	const latexSectionsEn = paperSectionsEn.map(section => latexSection(section));
	const latexSectionsZh = paperSectionsZh.map(section => latexSection(section));
	const latex = `${containsMockData ? "% Mock/test-data draft. Replace all numbers with final real participant results before paper submission." : "% Auto-generated draft from current participant data. Verify scoring/coding/statistical wording before paper submission."}
\\section{System Evaluation}
${latexSectionsEn.join("\n\n")}
`;
	const latexZh = `${containsMockData ? "% 模拟/测试数据草稿。论文提交前，请将所有数字替换为最终真实参与者实验结果。" : "% 根据当前参与者数据自动生成的中文草稿。论文提交前请核对评分、编码与统计表述。"}
\\section{系统评估}
${latexSectionsZh.join("\n\n")}
`;
	const study = flattenSectionText(paperSectionsEn.slice(0, 2));
	const results = flattenSectionText(paperSectionsEn.slice(2, 3));
	const discussion = flattenSectionText(paperSectionsEn.slice(3));
	const studyZh = flattenSectionText(paperSectionsZh.slice(0, 2));
	const resultsZh = flattenSectionText(paperSectionsZh.slice(2, 3));
	const discussionTextZh = flattenSectionText(paperSectionsZh.slice(3));
	return {
		study,
		results,
		discussion,
		latex,
		studyZh,
		resultsZh,
		discussionZh: discussionTextZh,
		latexZh,
		paperFigures: PAPER_FIGURES,
		paperViewStyle: "system-evaluation",
		paperTitleZh,
		paperTitleEn,
		paperSectionsZh,
		paperSectionsEn,
		warning: draftWarning,
		warningZh: draftWarningZh,
		hasMockData: containsMockData,
	};
};
const isMockSubmission = submission => Boolean(
	submission?.mockData
	|| submission?.mockDataWarning
	|| submission?.simulatedFromRealBaseline
	|| submission?.mockParticipantProfile
);

const buildSubmissionDataAudit = submissions => {
	const records = submissions || [];
	const taskRows = experimentAnswerRows(records, { includeQ6: false }).filter(row => TASK_QUESTION_IDS.includes(row.questionId));
	const scoredTaskRows = taskRows.filter(row => Number.isFinite(scoreFromAnswer(row.answer)));
	const q6Rows = experimentAnswerRows(records).filter(row => row.questionId === "Q6");
	const q6CodedRows = q6Rows.filter(row => parseQ6Coding(row.answer));
	const savedAts = records.map(record => record?.savedAt || record?.completedAt || "").filter(Boolean).sort();
	return {
		submissionCount: records.length,
		questionnaireCount: questionnaireSubmissions(records).length,
		participantCodes: records.map(record => record?.participantCode || "未记录").sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN", { numeric: true })),
		mockFlagCount: records.filter(isMockSubmission).length,
		taskAnswerCount: taskRows.length,
		scoredTaskAnswerCount: scoredTaskRows.length,
		unscoredTaskAnswerCount: taskRows.length - scoredTaskRows.length,
		q6AnswerCount: q6Rows.length,
		q6CodedAnswerCount: q6CodedRows.length,
		q6UncodedAnswerCount: q6Rows.length - q6CodedRows.length,
		latestSavedAt: savedAts.length ? savedAts[savedAts.length - 1] : "",
	};
};

const calculateExperimentResultStats = submissions => {
	const records = submissions || [];
	const questionnaireRecords = questionnaireSubmissions(records);
	return {
		submissionCount: records.length,
		questionnaireCount: questionnaireRecords.length,
		assignmentDistribution: assignmentDistribution(records),
		totalDuration: summarizeNumbers(records.map(record => Number(record?.totalDurationMs))),
		questionnaireDuration: summarizeNumbers(questionnaireRecords.map(record => Number(record?.postQuestionnaire?.durationMs))),
		conditionDurations: conditionDurationStats(records),
		pairedDurationDifference: pairedConditionDifferences(records),
		taskAccuracy: calculateTaskAccuracyStats(records),
		sourceUsage: calculateSourceUsageStats(records),
		q6Insights: calculateQ6InsightStats(records),
		answerTime: calculateAnswerTimeStats(records),
	};
};

const calculateQuestionnaireStats = submissions => {
	const questionnaireRecords = questionnaireSubmissions(submissions);
	const susScores = questionnaireRecords
		.map(submission => Number(submission.postQuestionnaire.susScore))
		.filter(Number.isFinite);
	const durations = questionnaireRecords
		.map(submission => Number(submission.postQuestionnaire.durationMs))
		.filter(Number.isFinite);
	const likertItems = [...SUS_ITEMS, ...COMPARISON_ITEMS];
	return {
		count: questionnaireRecords.length,
		susCount: susScores.length,
		averageSus: round(mean(susScores), 1),
		medianSus: round(median(susScores), 1),
		minSus: susScores.length ? Math.min(...susScores) : null,
		maxSus: susScores.length ? Math.max(...susScores) : null,
		stdDevSus: round(sampleStdDev(susScores), 1),
		averageDurationMs: round(mean(durations), 0),
		susHistogram: susHistogram(susScores),
		participantSusScores: questionnaireRecords.map(submission => ({
			experimentId: submission.experimentId || "",
			participantCode: submission.participantCode || "",
			assignmentGroup: submission.assignmentGroup || "",
			susScore: Number(submission.postQuestionnaire.susScore),
		})).filter(row => Number.isFinite(row.susScore)),
		itemDistributions: likertItems.map(item => itemDistribution(questionnaireRecords, item)),
		comparisonMeans: COMPARISON_ITEMS.map(item => itemDistribution(questionnaireRecords, item)),
	};
};

module.exports = {
	ALL_EXPERIMENT_QUESTION_IDS,
	CONDITION_LABELS,
	LIKERT_VALUES,
	QUESTION_TYPE_LABELS,
	SOURCE_LABELS,
	SOURCE_ORDER,
	SUS_BINS,
	TASK_QUESTION_IDS,
	answerValue,
	buildSubmissionDataAudit,
	calculateAnswerTimeStats,
	calculateExperimentResultStats,
	conditionQuestionAccuracy,
	conditionQuestionAnswerTime,
	conditionTaskQuestionAnswerTime,
	conditionQuestionSourceUsage,
	calculateQ6InsightStats,
	calculateQuestionnaireStats,
	calculateSourceUsageStats,
	calculateTaskAccuracyStats,
	conditionDurationStats,
	experimentAnswerRows,
	generatePaperDraftSections,
	normalizeExperimentSource,
	openFeedbackExamples,
	pairedConditionDifferences,
	paperResultHighlights,
	questionnaireSubmissions,
	representativeQ6Answers,
	round,
	stageRowsForSubmissions,
};
