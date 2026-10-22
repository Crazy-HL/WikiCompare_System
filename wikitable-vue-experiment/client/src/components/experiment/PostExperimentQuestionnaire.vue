<template>
	<section class="post-questionnaire">
		<header class="panel-heading">
			<h2>事后问卷</h2>
			<p>请在完成两个条件后，根据你的整体体验回答以下问题。</p>
		</header>

		<form @submit.prevent="submitQuestionnaire">
			<section v-for="(item, index) in questionnaireItems" :key="item.id" class="question-card">
				<div class="question-number">{{ item.id }}</div>
				<p class="question-text">{{ item.questionText }}</p>

				<fieldset v-if="item.questionType !== 'open'" class="source-field">
					<legend>请选择最符合你真实感受的选项</legend>
					<label v-for="option in likertOptions" :key="`${item.id}-${option.value}`" class="radio-label">
						<input v-model="answers[index].answer" type="radio" :name="item.id" :value="String(option.value)" />
						<span>{{ option.value }} · {{ option.label }}</span>
					</label>
				</fieldset>

				<label v-else>
					<span>请填写简短说明</span>
					<textarea v-model="answers[index].answer" rows="4" :placeholder="item.id === 'WF_HELPFUL' ? '例如：帮助我快速定位证据和比较点。' : '例如：图表说明不够清晰。'" />
				</label>
			</section>

			<div v-if="errorMessage" class="questionnaire-error" role="alert">{{ errorMessage }}</div>
			<button class="submit-button" type="submit">提交事后问卷</button>
		</form>
	</section>
</template>

<script setup>
	import { computed, reactive, ref, watch } from "vue";
	const {
		LIKERT_OPTIONS,
		QUESTIONNAIRE_ITEMS,
		buildPostExperimentQuestionnairePayload,
		createQuestionnaireRecord,
		validatePostExperimentQuestionnaire,
	} = require("@/experiment/postQuestionnaire");
	const { createTimingMark } = require("@/experiment/timing");

	const props = defineProps({
		startedAtMs: {
			type: Number,
			default: 0
		}
	});

	const emit = defineEmits(["submit"]);
	const questionnaireItems = computed(() => QUESTIONNAIRE_ITEMS);
	const likertOptions = computed(() => LIKERT_OPTIONS);
	const answers = reactive([]);
	const timingMarks = reactive({});
	const errorMessage = ref("");

	const emptyValues = () => ({ answer: "" });

	const resetAnswers = () => {
		answers.splice(0, answers.length);
		for (let index = 0; index < questionnaireItems.value.length; index += 1) {
			answers.push(emptyValues());
		}
		Object.keys(timingMarks).forEach(key => delete timingMarks[key]);
		errorMessage.value = "";
	};

	watch(
		() => questionnaireItems.value,
		() => resetAnswers(),
		{ immediate: true }
	);

	const ensureTiming = index => {
		if (!timingMarks[index]) {
			timingMarks[index] = createTimingMark();
		}
	};

	const finalizeTiming = index => {
		ensureTiming(index);
		return timingMarks[index].submit();
	};

	const submitQuestionnaire = () => {
		const records = questionnaireItems.value.map((item, index) =>
			createQuestionnaireRecord(item, finalizeTiming(index), answers[index].answer)
		);
		const validationError = validatePostExperimentQuestionnaire(records);
		if (validationError) {
			errorMessage.value = validationError;
			return;
		}
		errorMessage.value = "";
		const submittedAtMs = Date.now();
		const startedAtMs = props.startedAtMs || records[0]?.answerStartedAtMs || submittedAtMs;
		emit("submit", buildPostExperimentQuestionnairePayload(records, startedAtMs, submittedAtMs));
	};
</script>


<style scoped>
	.post-questionnaire {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #eef3f8;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
		overflow-y: auto;
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

	.questionnaire-error {
		padding: 12px 14px;
		border-radius: 12px;
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
		font-weight: 700;
	}

	.submit-button {
		justify-self: start;
		border: 0;
		border-radius: 999px;
		padding: 12px 18px;
		background: #2563eb;
		color: #ffffff;
		font-weight: 840;
		cursor: pointer;
	}
</style>
