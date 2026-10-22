<template>
	<section class="answer-panel" aria-label="实验作答区">
		<div class="panel-heading">
			<h2>作答区</h2>
			<p>请独立填写。提交后进入下一步。</p>
		</div>

		<form @submit.prevent="submitAnswers">
			<div
				v-for="(question, index) in firstFiveQuestions"
				:key="questionKey(question, index)"
				class="question-card">
				<div class="question-number">Q{{ index + 1 }}</div>
				<p class="question-text">{{ questionText(question) }}</p>

				<fieldset
					v-if="isChoiceQuestion(question)"
					class="answer-choice-field"
					@change="ensureTiming(index)">
					<legend>我的答案</legend>
					<p class="choice-hint">请选择一个答案</p>
					<label
						v-for="(option, optionIndex) in answerOptions(question)"
						:key="answerOptionValue(option, optionIndex)"
						class="choice-option">
						<input
							v-model="answers[index].answer"
							type="radio"
							:name="`question-${questionKey(question, index)}`"
							:value="answerOptionValue(option, optionIndex)"
							@focus="ensureTiming(index)" />
						<span>{{ answerOptionLabel(option, optionIndex) }}</span>
					</label>
				</fieldset>

				<label v-else>
					<span>我的答案</span>
					<textarea
						v-model="answers[index].answer"
						rows="4"
						@focus="ensureTiming(index)"
						@input="ensureTiming(index)"></textarea>
				</label>

				<fieldset class="source-field" @change="ensureTiming(index)">
					<legend>主要参考来源</legend>
					<label class="radio-label">
						<input v-model="answers[index].primarySource" type="radio" value="M" />
						<span>大模型 / 系统回答（M）</span>
					</label>
					<label class="radio-label">
						<input v-model="answers[index].primarySource" type="radio" value="A" />
						<span>文章原文（A）</span>
					</label>
					<label class="radio-label">
						<input v-model="answers[index].primarySource" type="radio" value="T" />
						<span>三栏表格（T）</span>
					</label>
				</fieldset>

				<div v-if="requiresParticipantEvidence(question)" class="evidence-grid">
					<label>
						<span>左侧证据</span>
						<textarea
							v-model="answers[index].leftEvidence"
							rows="2"
							@focus="ensureTiming(index)"
							@input="ensureTiming(index)"></textarea>
					</label>
					<label>
						<span>右侧证据</span>
						<textarea
							v-model="answers[index].rightEvidence"
							rows="2"
							@focus="ensureTiming(index)"
							@input="ensureTiming(index)"></textarea>
					</label>
				</div>
			</div>

			<div class="question-card q6-card">
				<div class="question-number">Q6</div>
				<p class="question-text multiline">{{ effectiveQ6Text }}</p>
				<label>
					<span>我的记录</span>
					<textarea
						v-model="answers[q6Index].answer"
						class="q6-textarea"
						rows="10"
						@focus="ensureTiming(q6Index)"
						@input="ensureTiming(q6Index)"></textarea>
				</label>
			</div>

			<button class="submit-button" type="submit">提交本阶段答案</button>
		</form>
	</section>
</template>

<script setup>
	import { computed, reactive, watch } from "vue";
	const { Q6_TEXT } = require("@/experiment/q6");
	const { createTimingMark } = require("@/experiment/timing");
	const { createAnswerRecord } = require("@/experiment/experimentStore");

	const props = defineProps({
		questions: {
			type: Array,
			default: () => []
		},
		q6Text: {
			type: String,
			default: ""
		}
	});

	const emit = defineEmits(["submit"]);
	const firstFiveQuestions = computed(() => (props.questions || []).slice(0, 5));
	const effectiveQ6Text = computed(() => props.q6Text || Q6_TEXT);
	const q6Index = computed(() => firstFiveQuestions.value.length);
	const answers = reactive([]);
	const timingMarks = reactive({});

	const emptyValues = () => ({
		answer: "",
		primarySource: "",
		leftEvidence: "",
		rightEvidence: ""
	});

	const resetAnswers = () => {
		answers.splice(0, answers.length);
		for (let index = 0; index < firstFiveQuestions.value.length + 1; index += 1) {
			answers.push(emptyValues());
		}
		Object.keys(timingMarks).forEach(key => delete timingMarks[key]);
	};

	watch(
		() => props.questions,
		() => resetAnswers(),
		{ immediate: true, deep: true }
	);

	const questionKey = (question, index) => question.question_id || question.questionId || `Q${index + 1}`;
	const questionText = question => question.question_text || question.questionText || "";
	const questionType = question => question.question_type || question.questionType || "";
	const normalizeAnswerOption = option => {
		if (option && typeof option === "object") {
			return String(option.value || option.label || option.text || "").trim();
		}
		return String(option || "").trim();
	};
	const inferDeterministicAnswerOptions = question => {
		const explicitQuestionId = question.question_id || question.questionId || "";
		const type = questionType(question);
		const text = questionText(question);
		if (explicitQuestionId === "Q5" || type.includes("综合结论证据验证")) {
			return ["支持", "不支持", "材料不足"];
		}
		const asksSideChoice = /(哪(?:个|一方|一篇|侧|边)|谁|何者).*(更|较|多|少|高|低|大|小|早|晚|先|后)|更高|更低|更多|更少|较高|较低|较多|较少|高于|低于|多于|少于|大于|小于|超过/.test(text);
		if (asksSideChoice) {
			return ["左侧材料中的对象", "右侧材料中的对象", "两者相同", "材料不足"];
		}
		const asksYesNoChoice = /(是否|能否|是不是|是否成立|是否满足|是否存在|是否都|是否均)/.test(text);
		if (asksYesNoChoice) {
			return ["是", "否", "材料不足"];
		}
		return [];
	};
	const answerOptions = question => {
		const rawOptions = question.answer_options || question.answerOptions || [];
		const options = Array.isArray(rawOptions)
			? rawOptions.map(normalizeAnswerOption).filter(Boolean)
			: String(rawOptions || "").split(/[\n,，]+/).map(option => option.trim()).filter(Boolean);
		return options.length ? options : inferDeterministicAnswerOptions(question);
	};
	const isChoiceQuestion = question => answerOptions(question).length > 0;
	const answerOptionValue = option => normalizeAnswerOption(option);
	const answerOptionLabel = option => normalizeAnswerOption(option);
	const booleanMetadataValue = value => {
		if (typeof value === "boolean") return value;
		if (typeof value === "string") {
			const normalized = value.trim().toLowerCase();
			if (["true", "yes", "1", "需要", "是"].includes(normalized)) return true;
			if (["false", "no", "0", "不需要", "否"].includes(normalized)) return false;
		}
		return undefined;
	};
	const explicitEvidenceRequirement = question => {
		for (const key of ["participant_evidence_required", "participantEvidenceRequired", "requires_evidence", "requiresEvidence", "evidence_required", "evidenceRequired"]) {
			const parsed = booleanMetadataValue(question?.[key]);
			if (typeof parsed === "boolean") return parsed;
		}
		return undefined;
	};
	const requiresParticipantEvidence = question => {
		const explicit = explicitEvidenceRequirement(question);
		if (typeof explicit === "boolean") return explicit;
		const explicitQuestionId = question.question_id || question.questionId || "";
		const type = questionType(question);
		const format = String(question.answer_format || question.answerFormat || "");
		return explicitQuestionId === "Q5" || type.includes("证据验证") || format.includes("证据");
	};


	const ensureTiming = index => {
		if (!timingMarks[index]) {
			timingMarks[index] = createTimingMark();
		}
	};

	const finalizeTiming = index => {
		ensureTiming(index);
		return timingMarks[index].submit();
	};

	const submitAnswers = () => {
		const records = firstFiveQuestions.value.map((question, index) =>
			createAnswerRecord(question, finalizeTiming(index), answers[index])
		);
		records.push(createAnswerRecord(
			{ question_id: "Q6", question_text: effectiveQ6Text.value },
			finalizeTiming(q6Index.value),
			answers[q6Index.value]
		));
		emit("submit", records);
	};
</script>

<style scoped>
	.answer-panel {
		width: 100%;
		height: 100%;
		min-width: 0;
		max-width: none;
		background: #f8fafc;
		border-left: 1px solid rgba(203, 213, 225, 0.9);
		overflow-y: auto;
	}

	.panel-heading {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 16px 18px;
		background: rgba(248, 250, 252, 0.96);
		border-bottom: 1px solid #e2e8f0;
		backdrop-filter: blur(8px);
	}

	h2 {
		margin: 0 0 4px;
		font-size: 20px;
		color: #172033;
	}

	.panel-heading p {
		margin: 0;
		color: #64748b;
		font-size: 13px;
	}

	form {
		display: grid;
		gap: 14px;
		padding: 16px;
	}

	.question-card {
		padding: 16px;
		border: 1px solid #dbe4ee;
		border-radius: 14px;
		background: #ffffff;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	.question-number {
		color: #2563eb;
		font-weight: 860;
		font-size: 15px;
	}

	.question-text {
		margin: 6px 0 14px;
		color: #1f2937;
		font-size: 14px;
		line-height: 1.55;
	}

	.multiline {
		white-space: pre-line;
	}

	label,
	.source-field {
		display: grid;
		gap: 7px;
		margin: 0 0 12px;
		color: #334155;
		font-size: 13px;
		font-weight: 740;
	}

	textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 9px 10px;
		font: inherit;
		font-weight: 500;
		line-height: 1.5;
		color: #0f172a;
		background: #ffffff;
	}

	.answer-choice-field {
		margin: 12px 0 12px;
		padding: 12px;
		border: 1px solid #dbe4ee;
		border-radius: 12px;
		background: #f8fafc;
	}

	.answer-choice-field legend {
		padding: 0 4px;
		font-weight: 740;
		color: #334155;
	}

	.choice-hint {
		margin: 2px 0 10px;
		font-size: 12px;
		font-weight: 520;
		color: #64748b;
	}

	.choice-option {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 8px 0;
		padding: 9px 10px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		background: #ffffff;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.45;
	}

	.choice-option input {
		margin-top: 2px;
	}

	.source-field {
		border: 0;
		padding: 0;
	}

	legend {
		padding: 0;
		margin-bottom: 7px;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
		font-weight: 620;
		color: #475569;
	}

	.evidence-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.q6-textarea {
		min-height: 180px;
	}

	.submit-button {
		position: sticky;
		bottom: 12px;
		border: 0;
		border-radius: 12px;
		padding: 13px 16px;
		background: #16a34a;
		color: #ffffff;
		font-weight: 830;
		font-size: 15px;
		cursor: pointer;
		box-shadow: 0 10px 24px rgba(22, 163, 74, 0.24);
	}

	.submit-button:hover {
		background: #15803d;
	}

	@media (max-width: 980px) {
		.answer-panel {
			max-width: none;
			border-left: 0;
			border-top: 1px solid rgba(203, 213, 225, 0.9);
		}
	}

	@media (max-width: 560px) {
		.evidence-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
