<template>
	<section class="chatgpt-condition" aria-label="ChatGPT 条件页面">
		<header class="tab-bar" role="tablist" aria-label="ChatGPT 条件标签页">
			<button
				v-for="tab in tabs"
				:key="tab.id"
				type="button"
				class="tab-button"
				:class="{ active: activeTab === tab.id }"
				:id="`${tab.id}-tab`"
				role="tab"
				:aria-selected="String(activeTab === tab.id)"
				:aria-controls="`${tab.id}-panel`"
				@click="activeTab = tab.id">
				{{ tab.label }}
			</button>
		</header>

		<div class="tab-panels">
			<section
				v-show="activeTab === 'gpt'"
				id="gpt-panel"
				class="tab-panel gpt-panel"
				role="tabpanel"
				aria-labelledby="gpt-tab">
				<div class="chatgpt-shell">
					<header class="chatgpt-toolbar">
						<div class="chatgpt-brand">
							<div class="chatgpt-mark" aria-hidden="true">◎</div>
							<div>
								<div class="chatgpt-title">ChatGPT</div>
								<div class="chatgpt-subtitle">Experiment mode · Initialized with two materials</div>
							</div>
						</div>
						<div class="chatgpt-badge">GPT</div>
					</header>

					<div class="chatgpt-intro">
						<span class="intro-pill">{{ leftTabLabel }}</span>
						<span class="intro-divider">+</span>
						<span class="intro-pill">{{ rightTabLabel }}</span>
						<p>系统已将两篇材料初始化给 GPT，并冻结了首轮三栏比较表。你可以继续追问。</p>
					</div>

					<div class="chatgpt-transcript" aria-label="GPT 对话记录">
						<article v-for="(message, index) in messages" :key="index" :class="['chat-row', message.role]">
							<div class="chat-avatar" :class="message.role">{{ message.role === 'user' ? '我' : 'G' }}</div>
							<div class="chat-bubble" :class="{ error: message.error, table: message.role === 'assistant' && index === 1 }">
								<div class="chat-meta">
									<strong>{{ message.role === 'user' ? 'User' : 'ChatGPT' }}</strong>
									<span v-if="message.role === 'assistant' && index === 1">Frozen comparison output</span>
								</div>
								<p class="chat-text">{{ message.content }}</p>
								<div v-if="message.role === 'assistant' && index === 1 && staticRows.length" class="gpt-table-output" aria-label="ChatGPT 生成的静态三栏表">
									<table class="gpt-markdown-table">
										<thead>
											<tr>
												<th>{{ leftTabLabel }}</th>
												<th>比较项</th>
												<th>{{ rightTabLabel }}</th>
											</tr>
										</thead>
										<tbody>
											<tr v-for="(row, rowIndex) in staticRows" :key="row.id || `${row.label}-${rowIndex}`">
												<td>{{ sideValue(row, 'left') }}</td>
												<td class="comparison-label">{{ row.label || `项目 ${rowIndex + 1}` }}</td>
												<td>{{ sideValue(row, 'right') }}</td>
											</tr>
										</tbody>
									</table>
								</div>
								<div v-else-if="message.role === 'assistant' && index === 1" class="empty-static-table">
									管理员尚未冻结该材料的 ChatGPT 静态三栏表。
								</div>
								<ul v-if="message.citations?.length" class="citation-list">
									<li v-for="(citation, citationIndex) in message.citations" :key="citationIndex">
										{{ citation.label || citation.sourceIds?.join(', ') || '证据' }}
									</li>
								</ul>
							</div>
						</article>
					</div>

					<form class="chatgpt-composer" @submit.prevent="askQuestion">
						<label class="sr-only" for="chatgpt-question">向 GPT 提问</label>
						<div class="composer-shell">
							<textarea
								id="chatgpt-question"
								v-model="question"
								rows="1"
								placeholder="Message ChatGPT"
								:disabled="isLoading || !hasSession"></textarea>
							<div class="composer-actions">
								<span class="composer-hint" v-if="!hasSession">材料会话加载完成后可提问。</span>
								<button type="submit" :disabled="isLoading || !hasSession || !question.trim()" aria-label="发送问题">
									{{ isLoading ? '…' : '↑' }}
								</button>
							</div>
						</div>
					</form>
				</div>
			</section>

			<section
				v-show="activeTab === 'left'"
				id="left-panel"
				class="tab-panel material-panel"
				role="tabpanel"
				aria-labelledby="left-tab">
				<div class="material-pane">
					<ParentComponent side="left" divId="chatgpt-left" selectContentClass="chatgpt-left-content" :show-outline="false" />
				</div>
			</section>

			<section
				v-show="activeTab === 'right'"
				id="right-panel"
				class="tab-panel material-panel"
				role="tabpanel"
				aria-labelledby="right-tab">
				<div class="material-pane">
					<ParentComponent side="right" divId="chatgpt-right" selectContentClass="chatgpt-right-content" :show-outline="false" />
				</div>
			</section>
		</div>
	</section>
</template>

<script setup>
	import { computed, ref, watch } from "vue";
	import ParentComponent from "@/components/compoents_base/ParentComponent.vue";
	import { postJson } from "@/api";
	import { sessionStore } from "@/js/sessionStore";

	const props = defineProps({
		frozenRows: {
			type: Array,
			default: () => []
		},
		leftTitle: {
			type: String,
			default: ""
		},
		rightTitle: {
			type: String,
			default: ""
		}
	});

	const activeTab = ref("gpt");
	const question = ref("");
	const messages = ref([]);
	const isLoading = ref(false);
	const hasSession = computed(() => Boolean(sessionStore.session?.sessionId));
	const staticRows = computed(() => props.frozenRows || []);
	const leftTabLabel = computed(() => props.leftTitle || sessionStore.session?.articles?.left?.title || "材料 1");
	const rightTabLabel = computed(() => props.rightTitle || sessionStore.session?.articles?.right?.title || "材料 2");
	const tabs = computed(() => [
		{ id: "gpt", label: "GPT" },
		{ id: "left", label: leftTabLabel.value },
		{ id: "right", label: rightTabLabel.value }
	]);
	const initialPromptText = computed(() => {
		const left = leftTabLabel.value;
		const right = rightTabLabel.value;
		return `请基于“${left}”和“${right}”生成三栏比较表，并在后续回答中继续参考这两篇材料。`;
	});
	const initialAssistantContent = computed(() => {
		if (!staticRows.value.length) {
			return "管理员尚未冻结该材料的 ChatGPT 静态三栏表。";
		}
		return staticRows.value.map((row, index) => {
			const label = row.label || `项目 ${index + 1}`;
			return `${label}: ${sideValue(row, "left")} | ${sideValue(row, "right")}`;
		}).join("\n");
	});

	const buildSeedMessages = () => [{
		role: "user",
		content: initialPromptText.value
	}, {
		role: "assistant",
		content: initialAssistantContent.value
	}];

	watch(
		() => [sessionStore.session?.sessionId, props.frozenRows, props.leftTitle, props.rightTitle],
		() => {
			messages.value = buildSeedMessages();
			question.value = "";
			isLoading.value = false;
			activeTab.value = "gpt";
		},
		{ immediate: true, deep: true }
	);

	const stringifyValue = value => {
		if (value === null || value === undefined || value === "") return "—";
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
		if (Array.isArray(value)) {
			return value.map(stringifyValue).join("; ");
		}
		if (value.display || value.rawText || value.raw || value.value) {
			return stringifyValue(value.display || value.rawText || value.raw || value.value);
		}
		return JSON.stringify(value);
	};

	const sideValue = (row, side) => {
		const sideData = row?.visualization?.[side] || row?.[side] || {};
		if (Array.isArray(sideData.values) && sideData.values.length) {
			return sideData.values.map(value => stringifyValue(value)).join("; ");
		}
		return stringifyValue(sideData.raw || sideData.value || sideData.text || row?.[`${side}Value`]);
	};

	const conversationHistory = () => messages.value
		.filter(message => !message.error)
		.map(message => ({
			role: message.role === "user" ? "user" : "assistant",
			content: message.content
		}));

	const askQuestion = async () => {
		const text = question.value.trim();
		if (!text || !hasSession.value) return;
		const priorConversationHistory = conversationHistory();
		messages.value.push({ role: "user", content: text });
		question.value = "";
		isLoading.value = true;
		try {
			const response = await postJson("api/ask", {
				sessionId: sessionStore.session.sessionId,
				question: text,
				conversationHistory: priorConversationHistory
			});
			messages.value.push({
				role: "assistant",
				content: response.answer || "",
				citations: response.citations || []
			});
		} catch (error) {
			messages.value.push({
				role: "assistant",
				content: error.response?.data?.error || error.message || "提问失败",
				error: true
			});
		} finally {
			isLoading.value = false;
		}
	};
</script>

<style scoped>
	.chatgpt-condition {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #f7f7f8;
		color: #171717;
	}

	.tab-bar {
		display: flex;
		gap: 8px;
		padding: 10px 12px 0;
		flex: 0 0 auto;
	}

	.tab-button {
		border: 1px solid #d6deea;
		border-bottom: 0;
		border-radius: 12px 12px 0 0;
		background: #eef2f7;
		color: #42516b;
		font-size: 13px;
		font-weight: 650;
		padding: 10px 16px;
		cursor: pointer;
	}

	.tab-button.active {
		background: #f7f7f8;
		color: #111827;
		box-shadow: 0 -2px 8px rgba(15, 23, 42, 0.05);
	}

	.tab-panels {
		flex: 1 1 auto;
		min-height: 0;
		border-top: 1px solid #d6deea;
		background: #f7f7f8;
	}

	.tab-panel {
		height: 100%;
		min-height: 0;
	}

	.gpt-panel,
	.material-panel {
		overflow: hidden;
	}

	.chatgpt-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		max-width: 980px;
		margin: 0 auto;
		padding: 18px 18px 16px;
	}

	.chatgpt-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 8px 0 14px;
	}

	.chatgpt-brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.chatgpt-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		background: linear-gradient(180deg, #10a37f, #0f8f6e);
		color: #ffffff;
		font-size: 18px;
		box-shadow: 0 10px 24px rgba(16, 163, 127, 0.18);
	}

	.chatgpt-title {
		font-size: 16px;
		font-weight: 700;
		color: #0f172a;
	}

	.chatgpt-subtitle {
		margin-top: 2px;
		font-size: 12px;
		color: #64748b;
	}

	.chatgpt-badge {
		padding: 7px 12px;
		border-radius: 999px;
		background: #ffffff;
		border: 1px solid #dbe3ee;
		color: #334155;
		font-size: 12px;
		font-weight: 650;
	}

	.chatgpt-intro {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		margin-bottom: 12px;
		border: 1px solid #dbe3ee;
		border-radius: 18px;
		background: #ffffff;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	.chatgpt-intro p {
		margin: 0;
		flex-basis: 100%;
		color: #475569;
		font-size: 13px;
		line-height: 1.55;
	}

	.intro-pill {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 999px;
		background: #eef6ff;
		color: #1d4ed8;
		font-size: 12px;
		font-weight: 650;
	}

	.intro-divider {
		color: #94a3b8;
		font-size: 12px;
	}

	.chatgpt-transcript {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding-right: 4px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.chat-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.chat-row.user {
		flex-direction: row-reverse;
	}

	.chat-avatar {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
	}

	.chat-avatar.user {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.chat-avatar.assistant {
		background: linear-gradient(180deg, #10a37f, #0f8f6e);
		color: #ffffff;
	}

	.chat-bubble {
		max-width: min(820px, calc(100% - 48px));
		padding: 14px 16px;
		border: 1px solid #dbe3ee;
		border-radius: 18px;
		background: #ffffff;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	.chat-row.user .chat-bubble {
		background: #f8fafc;
	}

	.chat-bubble.error {
		border-color: #fecaca;
		background: #fef2f2;
		color: #991b1b;
	}

	.chat-meta {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 8px;
	}

	.chat-meta strong {
		font-size: 13px;
	}

	.chat-meta span {
		color: #64748b;
		font-size: 12px;
	}

	.chat-text {
		margin: 0;
		white-space: pre-wrap;
		font-size: 14px;
		line-height: 1.7;
		color: #0f172a;
	}

	.chat-bubble.table .chat-text {
		margin-bottom: 12px;
		font-size: 13px;
		color: #475569;
	}

	.empty-static-table {
		padding: 14px 16px;
		border-radius: 14px;
		background: #fff8e6;
		color: #7c5d18;
		font-size: 13px;
	}

	.gpt-table-output {
		overflow: auto;
		border: 1px solid #e1e8f3;
		border-radius: 14px;
		background: #ffffff;
	}

	.gpt-markdown-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		line-height: 1.5;
	}

	.gpt-markdown-table th,
	.gpt-markdown-table td {
		border-bottom: 1px solid #e9eef5;
		border-right: 1px solid #e9eef5;
		padding: 10px 12px;
		vertical-align: top;
		text-align: left;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.gpt-markdown-table th:last-child,
	.gpt-markdown-table td:last-child {
		border-right: 0;
	}

	.gpt-markdown-table thead th {
		background: #f8fafc;
		font-weight: 700;
	}

	.comparison-label {
		font-weight: 650;
		color: #334155;
	}

	.chatgpt-composer {
		padding-top: 14px;
		flex: 0 0 auto;
	}

	.composer-shell {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 14px;
		border: 1px solid #dbe3ee;
		border-radius: 24px;
		background: #ffffff;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
	}

	.composer-shell textarea {
		width: 100%;
		resize: none;
		min-height: 46px;
		max-height: 180px;
		padding: 12px 14px;
		border: 0;
		border-radius: 16px;
		background: #f8fafc;
		color: #172033;
		font: inherit;
		outline: none;
	}

	.composer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.composer-hint {
		color: #64748b;
		font-size: 12px;
	}

	.composer-actions button {
		width: 42px;
		height: 42px;
		border: 0;
		border-radius: 999px;
		background: #0f172a;
		color: #ffffff;
		font-size: 18px;
		cursor: pointer;
	}

	.composer-actions button:disabled,
	.composer-shell textarea:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.citation-list {
		margin: 8px 0 0;
		padding-left: 18px;
		color: #475569;
	}

	.material-panel .material-pane {
		height: 100%;
		min-height: 0;
		overflow: auto;
	}

	.material-panel :deep(.div0) {
		min-height: 100%;
	}

	@media (max-width: 900px) {
		.tab-bar {
			padding-inline: 8px;
			gap: 6px;
			overflow-x: auto;
		}

		.tab-button {
			white-space: nowrap;
			padding-inline: 12px;
		}

		.chatgpt-shell {
			padding: 12px;
		}

		.chat-bubble {
			max-width: calc(100% - 48px);
		}
	}
</style>
