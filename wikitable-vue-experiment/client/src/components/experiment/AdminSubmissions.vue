<template>
	<section class="admin-panel" :class="{ 'figure-only-mode': figuresOnly }">
		<header class="panel-header">
			<div>
				<h2>论文结果视图 · System Evaluation</h2>
				<p>按原论文第 5 节 System Evaluation 的写法展示结果文字与 Fig. 7–Fig. 10；下方折叠区保留数据核对、导出和逐参与者编辑。</p>
			</div>
			<div class="header-actions">
				<button type="button" :disabled="loading" @click="loadSubmissions">刷新</button>
				<button type="button" class="ghost-button" @click="figuresOnly = !figuresOnly">{{ figuresOnly ? '显示管理区' : '论文截图模式' }}</button>
			</div>
		</header>

		<div v-if="message" class="notice success">{{ message }}</div>
		<div v-if="errorMessage" class="notice error">{{ errorMessage }}</div>

		<section class="paper-draft-card">
			<div class="chart-header paper-draft-header">
				<div>
					<h3>5 System Evaluation 论文草稿</h3>
					<p>按照论文式 section/subsection 组织叙述，图表引用与下方 Fig. 7–Fig. 10 保持一致。</p>
				</div>
				<div class="draft-actions">
					<button type="button" @click="copyPaperDraft">复制中文草稿</button>
				</div>
			</div>
			<div class="draft-warning" :class="{ danger: paperDraft.hasMockData }">{{ paperDraft.warningZh }}</div>
			<div class="paper-draft-layout">
				<article class="paper-preview">
					<header class="paper-preview-header">
						<div>
							<span class="paper-preview-kicker">System Evaluation</span>
							<h4>{{ paperDraft.paperTitleZh || '5 系统评估' }}</h4>
						<p class="paper-preview-subtitle">论文式中文叙述；复制 LaTeX 前请核对评分、Q6 编码与统计口径。</p>
						</div>
						<div class="paper-preview-meta">
							<span class="meta-pill">ACM evaluation style</span>
							<span class="meta-pill">{{ paperDraft.hasMockData ? '模拟数据' : '真实数据' }}</span>
							<span class="meta-pill">Fig. 7–10</span>
						</div>
					</header>
					<section v-for="section in paperPreviewSections" :key="section.key" class="paper-preview-section">
						<div class="paper-section-heading">
							<span class="figure-tag">{{ section.label }}</span>
							<h5>{{ section.title }}</h5>
						</div>
						<p v-for="(paragraph, index) in section.paragraphs" :key="`${section.key}-${index}`">{{ paragraph }}</p>
						<article v-for="subsection in section.subsections || []" :key="subsection.key" class="paper-subsection">
							<div class="paper-section-heading nested">
								<span class="figure-tag">{{ subsection.label }}</span>
								<h6>{{ subsection.title }}</h6>
							</div>
							<p v-for="(paragraph, paragraphIndex) in subsection.paragraphs || []" :key="`${section.key}-${subsection.key}-${paragraphIndex}`">{{ paragraph }}</p>
						</article>
					</section>
				</article>
				<aside class="paper-preview-aside">
					<div class="paper-side-card">
						<h4>图表引用</h4>
						<div v-for="figure in paperFigureEntries" :key="figure.key" class="figure-reference-item">
							<strong>{{ figure.labelZh }} · {{ figure.titleZh }}</strong>
							<p>{{ figure.captionZh }}</p>
						</div>
					</div>
					<div class="paper-side-card">
						<h4>写作说明</h4>
						<p>上方文本用于论文结果段落，下方白底图表用于截图；英文草稿与 LaTeX 在折叠项中查看。</p>
					</div>
				</aside>
			</div>
			<details class="english-draft-details">
				<summary>查看英文原文草稿 / 原始 LaTeX</summary>
				<div class="draft-warning" :class="{ danger: paperDraft.hasMockData }">{{ paperDraft.warning }}</div>
				<div class="paper-raw-grid">
					<textarea class="paper-draft-textarea secondary" readonly :value="paperDraft.latexZh"></textarea>
					<textarea class="paper-draft-textarea secondary" readonly :value="paperDraft.latex"></textarea>
				</div>
			</details>
		</section>



		<section class="metric-section paper-metric-section paper-figure-section">
			<div class="section-title paper-section-title">
				<h3><span class="figure-tag">{{ paperFigures.figure7?.labelZh || '图 7' }}</span>{{ paperFigures.figure7?.titleZh || '条件 × 题型准确率' }}</h3>
				<p>{{ paperFigures.figure7?.captionZh || '展示 WikiCompare 与 GPT 在 Q1-Q5 各题型上的准确率对比。' }}</p>
			</div>
			<figure class="paper-figure paper-figure-wide">
				<div class="figure-legend top-legend">
					<span><i class="legend-swatch condition-wiki"></i>WikiCompare</span>
					<span><i class="legend-swatch condition-gpt"></i>GPT</span>
				</div>
				<div class="axis-plot accuracy-plot" aria-label="条件与题型准确率柱状图">
					<div class="y-axis-label">准确率（%）</div>
					<div class="y-ticks">
						<span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
					</div>
					<div class="plot-body">
						<div class="grid-line line-100"></div>
						<div class="grid-line line-75"></div>
						<div class="grid-line line-50"></div>
						<div class="grid-line line-25"></div>
						<div class="paper-bar-groups" :style="paperAxisGridStyle(accuracyMatrix.length)">
							<div v-for="(row, index) in accuracyMatrix" :key="`paper-accuracy-${row.questionId}`" class="paper-bar-group">
								<div class="paper-bars two-bars">
									<div class="paper-bar condition-wiki" :style="{ height: `${percentWidth(row.wikicompare.accuracyPercent)}%` }"><span>{{ formatPercent(row.wikicompare.accuracyPercent) }}</span></div>
									<div class="paper-bar condition-gpt" :style="{ height: `${percentWidth(row.chatgpt.accuracyPercent)}%` }"><span>{{ formatPercent(row.chatgpt.accuracyPercent) }}</span></div>
								</div>
								<div class="x-label" :class="{ 'axis-label-hidden': !shouldShowPaperXAxisLabel(index, accuracyMatrix.length) }">
										<template v-if="shouldShowPaperXAxisLabel(index, accuracyMatrix.length)"><strong>{{ row.questionId }}</strong><small>{{ row.questionTypeLabel }}</small></template>
									</div>
								<div v-if="shouldShowPaperXAxisLabel(index, accuracyMatrix.length)" class="delta-note" :class="{ positive: row.differencePercent > 0, negative: row.differencePercent < 0 }">Δ {{ formatPercent(row.differencePercent) }}</div>
							</div>
						</div>
					</div>
				</div>
				<figcaption><strong>{{ paperFigures.figure7?.labelZh || '图 7' }}.</strong> {{ paperFigures.figure7?.captionZh || '展示 WikiCompare 与 GPT 在 Q1-Q5 各题型上的准确率对比。' }}</figcaption>
			</figure>
			<table class="paper-compact-table figure-data-table">
				<thead><tr><th>题型</th><th>WikiCompare 正确率</th><th>WikiCompare 计数</th><th>GPT 正确率</th><th>GPT 计数</th><th>差异</th></tr></thead>
				<tbody>
					<tr v-for="row in accuracyMatrix" :key="`figure7-data-${row.questionId}`">
						<td><strong>{{ row.questionId }}</strong> {{ row.questionTypeLabel }}</td>
						<td>{{ formatPercent(row.wikicompare.accuracyPercent) }}</td>
						<td>{{ row.wikicompare.scoredCount }} / {{ row.wikicompare.answerCount }}</td>
						<td>{{ formatPercent(row.chatgpt.accuracyPercent) }}</td>
						<td>{{ row.chatgpt.scoredCount }} / {{ row.chatgpt.answerCount }}</td>
						<td><span class="difference-pill tiny" :class="{ positive: row.differencePercent > 0, negative: row.differencePercent < 0 }">{{ formatPercent(row.differencePercent) }}</span></td>
					</tr>
				</tbody>
			</table>
		</section>

		<section class="metric-section paper-metric-section paper-figure-section">
			<div class="section-title paper-section-title">
				<h3><span class="figure-tag">{{ paperFigures.figure8?.labelZh || '图 8' }}</span>{{ paperFigures.figure8?.titleZh || '阅读策略与答题时间' }}</h3>
				<p>{{ paperFigures.figure8?.captionZh || '展示各条件下主要来源选择与平均答题时间，便于观察阅读策略差异。' }}</p>
			</div>
			<div class="paper-subfigure-grid">
				<figure class="paper-figure">
					<div class="subfigure-title">（a）主要答案来源</div>
					<div class="source-stack-plot">
						<div v-for="item in resultStats.sourceUsage.byCondition" :key="`paper-source-condition-${item.condition}`" class="source-stack-row">
							<div class="source-stack-label">{{ item.label }}</div>
							<div class="source-stack-track">
								<span v-for="source in item.sources" :key="`${item.condition}-${source.source}`" :style="{ width: `${source.percent}%`, background: sourceColor(source.source) }" :title="`${source.label}: ${source.count} (${source.percent}%)`"></span>
							</div>
							<div class="source-stack-value">{{ item.totalCount }} 份答题</div>
						</div>
					</div>
					<div class="source-legend figure-legend">
						<span v-for="source in sourceOrder" :key="`source-legend-${source}`"><i class="legend-swatch" :style="{ background: sourceColor(source) }"></i>{{ source }}</span>
					</div>
				</figure>
				<figure class="paper-figure">
					<div class="subfigure-title">（b）Q1–Q5 各题平均答题时间</div>
					<div class="axis-plot time-plot" aria-label="按题型的平均答题时间柱状图">
						<div class="y-axis-label">时间（秒）</div>
						<div class="y-ticks compact-ticks"><span>{{ Math.round(maxGroupedTimeMean / 1000) }}</span><span>{{ Math.round(maxGroupedTimeMean / 2000) }}</span><span>0</span></div>
						<div class="plot-body">
							<div class="grid-line line-100"></div><div class="grid-line line-50"></div>
							<div class="paper-bar-groups time-groups" :style="paperAxisGridStyle(timeMatrix.length)">
								<div v-for="(row, index) in timeMatrix" :key="`paper-time-${row.questionId}`" class="paper-bar-group">
									<div class="paper-bars two-bars">
										<div class="paper-bar condition-wiki" :style="{ height: groupedTimeWidth(row.wikicompare.mean) }"><span>{{ Math.round((row.wikicompare.mean || 0) / 1000) }}s</span></div>
										<div class="paper-bar condition-gpt" :style="{ height: groupedTimeWidth(row.chatgpt.mean) }"><span>{{ Math.round((row.chatgpt.mean || 0) / 1000) }}s</span></div>
									</div>
									<div class="x-label compact" :class="{ 'axis-label-hidden': !shouldShowPaperXAxisLabel(index, timeMatrix.length) }">
											<template v-if="shouldShowPaperXAxisLabel(index, timeMatrix.length)"><strong>{{ row.questionId }}</strong></template>
										</div>
								</div>
							</div>
						</div>
					</div>
				</figure>
			</div>
			<div class="paper-source-matrix">
				<div class="matrix-title">各题型主导来源</div>
				<table class="paper-compact-table">
					<thead><tr><th>题型</th><th>WikiCompare</th><th>GPT</th></tr></thead>
					<tbody>
						<tr v-for="row in sourceMatrix" :key="`source-matrix-${row.questionId}`">
							<td><strong>{{ row.questionId }}</strong> {{ row.questionTypeLabel }}</td>
							<td><span class="source-badge paper-badge" :style="{ background: sourceColor(row.wikicompare.dominantSource) }">{{ row.wikicompare.dominantSource }}</span>{{ formatPercent(row.wikicompare.dominantPercent) }}</td>
							<td><span class="source-badge paper-badge" :style="{ background: sourceColor(row.chatgpt.dominantSource) }">{{ row.chatgpt.dominantSource }}</span>{{ formatPercent(row.chatgpt.dominantPercent) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="section-caption"><strong>{{ paperFigures.figure8?.labelZh || '图 8' }}.</strong> {{ paperFigures.figure8?.captionZh || '展示各条件下主要来源选择与平均答题时间，便于观察阅读策略差异。' }}</div>
		</section>

		<section class="metric-section paper-metric-section paper-figure-section">
			<div class="section-title paper-section-title">
				<h3><span class="figure-tag">{{ paperFigures.figure9?.labelZh || '图 9' }}</span>{{ paperFigures.figure9?.titleZh || 'Q6 额外见解与来源' }}</h3>
				<p>{{ paperFigures.figure9?.captionZh || '展示 Q6 额外发现/问题的数量分布及其来源构成。' }}</p>
			</div>
			<div class="paper-subfigure-grid q6-paper-grid">
				<figure class="paper-figure">
					<div class="subfigure-title">（a）有效发现 / 问题数</div>
					<div class="q6-bars-plot">
						<div v-for="item in resultStats.q6Insights.byCondition" :key="`paper-q6-${item.condition}`" class="q6-bars-row">
							<div class="q6-condition-name">{{ item.label }}</div>
							<div class="q6-bar-stack">
								<div class="q6-bar-part findings" :style="{ width: `${q6Width(item.validFindings)}%` }"><span>{{ item.validFindings }}</span></div>
								<div class="q6-bar-part questions" :style="{ width: `${q6Width(item.validQuestions)}%` }"><span>{{ item.validQuestions }}</span></div>
							</div>
							<div class="q6-total">总计 {{ item.validTotal }} / 平均值={{ formatStat(item.meanValidTotalPerAnswer, 2) }}</div>
						</div>
					</div>
					<div class="figure-legend source-legend"><span><i class="legend-swatch finding-swatch"></i>有效发现</span><span><i class="legend-swatch question-swatch"></i>有效问题</span></div>
					<div v-if="dataAudit.q6UncodedAnswerCount" class="q6-coding-note">Q6 当前只统计已编码开放回答：{{ dataAudit.q6CodedAnswerCount }} / {{ dataAudit.q6AnswerCount }}；未编码 {{ dataAudit.q6UncodedAnswerCount }} 份不会进入图 9。</div>
				</figure>
				<figure class="paper-figure q6-source-figure">
					<div class="subfigure-title">（b）Q6 有效内容的来源构成</div>
					<div v-if="resultStats.q6Insights.sourceUsage.totalCount" class="paper-pie-layout">
						<div class="paper-pie" :style="pieStyle(resultStats.q6Insights.sourceUsage.overall)"></div>
						<div class="paper-pie-legend">
							<div v-for="item in q6VisibleSources(resultStats.q6Insights.sourceUsage.overall)" :key="`paper-q6-source-${item.source}`" class="pie-legend-row">
								<span class="legend-swatch" :style="{ background: sourceColor(item.source) }"></span>
								<strong>{{ item.source }}</strong>
								<span>{{ item.label.replace(/^.\s*/, '') }} · {{ item.percent }}%</span>
							</div>
						</div>
					</div>
					<div v-else class="empty-state metric-empty">暂无 Q6 来源编码。</div>
				</figure>
			</div>
			<div class="q6-data-panel">
				<div class="q6-data-title">Q6 编码数据汇总</div>
				<table class="paper-compact-table q6-summary-table">
					<thead><tr><th>条件</th><th>Q6 回答</th><th>有效发现</th><th>有效问题</th><th>总计</th><th>平均/回答</th><th>主要来源构成</th></tr></thead>
					<tbody>
						<tr v-for="item in resultStats.q6Insights.byCondition" :key="`q6-summary-${item.condition}`">
							<td><strong>{{ item.label }}</strong></td>
							<td>{{ item.codedAnswerCount }} / {{ item.answerCount }}</td>
							<td>{{ item.validFindings }}</td>
							<td>{{ item.validQuestions }}</td>
							<td>{{ item.validTotal }}</td>
							<td>{{ formatStat(item.meanValidTotalPerAnswer, 2) }}</td>
							<td>
								<span v-for="source in item.sourceUsage.overall.filter(row => row.count > 0)" :key="`q6-source-${item.condition}-${source.source}`" class="q6-source-chip">
									<i :style="{ background: sourceColor(source.source) }"></i>{{ source.source }} {{ source.count }}（{{ source.percent }}%）
								</span>
								<span v-if="!item.sourceUsage.totalCount">—</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div class="paper-quote-strip">
				<article v-for="item in q6Examples.slice(0, 2)" :key="`paper-q6-example-${item.participantCode}-${item.condition}-${item.materialId}`" class="paper-quote-card">
					<div><strong>{{ item.participantCode }}</strong><span>{{ item.conditionLabel }} · {{ item.materialId }} · {{ item.coding?.validTotal ?? 0 }} 条</span></div>
					<p>{{ item.text }}</p>
				</article>
			</div>
			<div class="section-caption"><strong>{{ paperFigures.figure9?.labelZh || '图 9' }}.</strong> {{ paperFigures.figure9?.captionZh || '展示 Q6 额外发现/问题的数量分布及其来源构成。' }}</div>
		</section>

		<section class="metric-section paper-metric-section paper-figure-section supplementary-section">
			<div class="section-title paper-section-title">
				<h3><span class="figure-tag">{{ paperFigures.figure10?.labelZh || '图 10' }}</span>{{ paperFigures.figure10?.titleZh || '事后问卷' }}</h3>
				<p>{{ paperFigures.figure10?.captionZh || '展示 SUS 分布与比较题的均值，用于补充主观体验分析。' }}</p>
			</div>
			<div class="paper-subfigure-grid questionnaire-paper-grid">
				<figure class="paper-figure">
					<div class="subfigure-title">（a）SUS 分数分布</div>
					<div class="axis-plot histogram-plot" aria-label="SUS 分数分布柱状图">
						<div class="y-axis-label">数量</div>
						<div class="y-ticks compact-ticks"><span>{{ maxSusBinCount }}</span><span>{{ Math.round(maxSusBinCount / 2) }}</span><span>0</span></div>
						<div class="plot-body">
							<div class="grid-line line-100"></div><div class="grid-line line-50"></div>
							<div class="paper-bar-groups histogram-groups" :style="paperAxisGridStyle(questionnaireStats.susHistogram.length)">
								<div v-for="(bin, index) in questionnaireStats.susHistogram" :key="`paper-sus-${bin.label}`" class="paper-bar-group">
									<div class="paper-bars single-bar">
										<div class="paper-bar sus-paper-bar" :style="{ height: `${susHeight(bin)}%` }"><span>{{ bin.count }}</span></div>
									</div>
									<div class="x-label" :class="{ 'axis-label-hidden': !shouldShowPaperXAxisLabel(index, questionnaireStats.susHistogram.length) }">
											<template v-if="shouldShowPaperXAxisLabel(index, questionnaireStats.susHistogram.length)"><strong>{{ bin.label }}</strong><small>{{ bin.percent }}%</small></template>
										</div>
								</div>
							</div>
						</div>
					</div>
					<div class="summary-note paper-note"><strong>平均 SUS = {{ formatStat(questionnaireStats.averageSus) }}</strong><span>中位数 = {{ formatStat(questionnaireStats.medianSus) }}，标准差 = {{ formatStat(questionnaireStats.stdDevSus) }}</span></div>
				</figure>
				<figure class="paper-figure">
					<div class="subfigure-title">（b）各题项李克特均值</div>
					<div class="likert-dot-plot" aria-label="量表题均值点图">
						<div v-for="item in questionnaireStats.itemDistributions" :key="`paper-likert-${item.id}`" class="likert-dot-row">
							<div class="likert-item-label"><strong>{{ item.id }}</strong><span>{{ item.questionText }}</span></div>
							<div class="likert-axis">
								<i></i><i></i><i></i><i></i><i></i>
								<span class="likert-dot" :style="{ left: `${Math.max(0, Math.min(100, (((item.mean || 1) - 1) / 4) * 100))}%` }"></span>
							</div>
							<div class="likert-value">{{ formatStat(item.mean, 2) }}</div>
						</div>
						<div class="likert-scale-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
					</div>
				</figure>
			</div>
			<div class="section-caption"><strong>{{ paperFigures.figure10?.labelZh || '图 10' }}.</strong> {{ paperFigures.figure10?.captionZh || '展示 SUS 分布与比较题的均值，用于补充主观体验分析。' }}</div>
		</section>

		<details class="paper-admin-details">
			<summary>数据核对与指标总表（管理区）</summary>
			<div class="paper-admin-body">
		<section class="paper-warning-card" :class="{ danger: resultHighlights.hasMockData }">
			<strong>{{ resultHighlights.hasMockData ? "当前是模拟测试数据：" : "当前页面定位：" }}</strong>
			<span v-if="resultHighlights.hasMockData">{{ resultHighlights.mockWarning }} 当前数字只能用于检查后台图表与论文写作结构。</span>
			<span v-else>这里展示的是后台中的当前提交数据。正式投稿前仍需确认人工评分、Q6 编码和统计口径。</span>
		</section>

		<section class="data-audit-card" :class="{ danger: dataAudit.mockFlagCount > 0 }">
			<div class="chart-header compact audit-header">
				<div>
					<h3>当前图表数据核对</h3>
					<p>下方所有论文图表和结果文字都直接由这批提交计算；如果这里的编号/题数不对，说明浏览器连接的不是当前后端数据。</p>
				</div>
				<div class="audit-updated">最近保存：{{ formatReadableTimestamp(dataAudit.latestSavedAt) }}</div>
			</div>
			<div class="audit-grid">
				<div class="audit-chip"><span>提交记录</span><strong>{{ dataAudit.submissionCount }}</strong></div>
				<div class="audit-chip"><span>参与者</span><strong>{{ dataAudit.participantCodes.join('、') || '—' }}</strong></div>
				<div class="audit-chip"><span>Q1–Q5 答题</span><strong>{{ dataAudit.scoredTaskAnswerCount }} / {{ dataAudit.taskAnswerCount }} 已评分</strong></div>
				<div class="audit-chip"><span>Q6 编码</span><strong>{{ dataAudit.q6CodedAnswerCount }} / {{ dataAudit.q6AnswerCount }} 已编码</strong></div>
				<div class="audit-chip"><span>问卷</span><strong>{{ dataAudit.questionnaireCount }}</strong></div>
				<div class="audit-chip" :class="{ danger: dataAudit.mockFlagCount > 0 }"><span>模拟标记</span><strong>{{ dataAudit.mockFlagCount }}</strong></div>
			</div>
		</section>

		<section class="result-highlights">
			<div class="section-title compact-title">
				<h3>结果摘要（论文视角）</h3>
				<p>先看这些摘要，再进入下面的图表。摘要会随当前提交、评分和编码自动更新。</p>
			</div>
			<div class="highlight-grid">
				<article class="highlight-card primary-highlight">
					<span>任务表现</span>
					<strong>{{ resultHighlights.accuracySentence }}</strong>
					<p>{{ resultHighlights.taskSentence }}</p>
				</article>
				<article class="highlight-card">
					<span>信息来源策略</span>
					<strong>{{ resultHighlights.sourceSentence }}</strong>
					<p>重点看 M/A/T 是否体现了两个条件的阅读方式差异。</p>
				</article>
				<article class="highlight-card">
					<span>答题时间</span>
					<strong>{{ resultHighlights.timeSentence }}</strong>
					<p>时间只作为辅助解释，需结合材料和题型。</p>
				</article>
				<article class="highlight-card">
					<span>探索性发现与问卷</span>
					<strong>{{ resultHighlights.q6Sentence }}</strong>
					<p>{{ resultHighlights.questionnaireSentence }}</p>
				</article>
			</div>
		</section>

		<section class="paper-table-card">
			<div class="chart-header compact">
				<h3>论文指标总表（先看这一张）</h3>
				<p>把实验设计中的核心指标压缩成论文可写的结果表：任务准确率、分题型表现、时间、Q6 与问卷。</p>
			</div>
			<table class="paper-metric-table">
				<thead><tr><th>指标</th><th>WikiCompare</th><th>GPT</th><th>差异</th><th>论文解读</th></tr></thead>
				<tbody>
					<tr v-for="row in paperMetricRows" :key="`paper-metric-${row.metric}`">
						<td><strong>{{ row.metric }}</strong></td>
						<td>{{ row.wikicompare }}</td>
						<td>{{ row.chatgpt }}</td>
						<td><span class="difference-pill tiny" :class="deltaClass(row.delta)">{{ row.delta }}</span></td>
						<td>{{ row.interpretation }}</td>
					</tr>
				</tbody>
			</table>
		</section>

			</div>
		</details>

		<details class="data-trace-details">
			<summary>数据追溯区：原始提交、单个问卷与答题计时</summary>
			<div class="data-trace-body">

		<section class="analysis-card participant-full-record-card">
			<div class="chart-header">
				<div>
					<h3>参与者完整记录</h3>
					<p>按参与者查看所有实验数据：两阶段答题、证据、计时和事后问卷；字段可双击直接修改，JSON 仅作为备用。</p>
				</div>
				<div class="record-count-chip">共 {{ submissions.length }} 份提交</div>
			</div>
			<div class="single-questionnaire-toolbar participant-record-toolbar">
				<label>
					<span>选择参与者 / 提交</span>
					<select v-model="selectedParticipantId">
						<option v-for="submission in submissions" :key="submissionKey(submission)" :value="submission.experimentId">
							{{ participantRecordLabel(submission) }}
						</option>
					</select>
				</label>
				<div class="record-toolbar-actions">
					<button type="button" class="detail-toggle ghost-button" :disabled="!selectedParticipant" @click="startEditingSubmission(selectedParticipant)">JSON 备用编辑</button>
				</div>
			</div>

			<div v-if="selectedParticipant" class="selected-questionnaire participant-record-layout">
				<div class="participant-record-main">
					<div class="selected-summary participant-summary-grid">
						<p class="inline-edit-note" @dblclick.stop.prevent="() => null">提示：下列字段显示“可编辑”时，双击可编辑；Enter/失焦保存，Esc 取消。</p>
						<div>
							<strong>参与者编号</strong>
							<InlineEditValue :submission="selectedParticipant" :path="['participantCode']" :value="selectedParticipant.participantCode" />
						</div>
						<div>
							<strong>实验记录 ID</strong>
							<span>{{ selectedParticipant.experimentId || '—' }}</span>
							<small class="field-secondary">系统主键，只读</small>
						</div>
						<div>
							<strong>顺序组</strong>
							<InlineEditValue :submission="selectedParticipant" :path="['assignmentGroup']" :value="selectedParticipant.assignmentGroup" />
						</div>
						<div>
							<strong>总用时</strong>
							<InlineEditValue :submission="selectedParticipant" :path="['totalDurationMs']" :value="selectedParticipant.totalDurationMs" :display="formatReadableDuration(selectedParticipant.totalDurationMs)" number />
						</div>
						<div>
							<strong>开始时间</strong>
							<InlineEditValue :submission="selectedParticipant" :path="['startedAt']" :value="selectedParticipant.startedAt" :display="formatReadableTimestamp(selectedParticipant.startedAtMs || selectedParticipant.startedAt)" />
						</div>
						<div>
							<strong>完成时间</strong>
							<InlineEditValue :submission="selectedParticipant" :path="['completedAt']" :value="selectedParticipant.completedAt" :display="formatReadableTimestamp(selectedParticipant.completedAtMs || selectedParticipant.completedAt)" />
						</div>
						<div>
							<strong>阶段答题数</strong>
							<span>{{ selectedParticipantStageAnswerCount }} / 阶段 {{ stageCount(selectedParticipant) }}</span>
						</div>
						<div>
							<strong>SUS 与问卷</strong>
							<span>{{ susScore(selectedParticipant) }} / {{ (selectedParticipant.postQuestionnaire?.answers || []).length }} 题</span>
						</div>
					</div>

					<section class="stage-card participant-stage-section">
						<div class="stage-card-header">
							<div>
								<h4>阶段答题完整记录</h4>
								<p>每个阶段展示实验条件、材料、题目版本、Q1–Q6 答案、证据和逐题计时。</p>
							</div>
							<div class="stage-meta">
								<span class="meta-pill">阶段 {{ stageCount(selectedParticipant) }}</span>
								<span class="meta-pill">答案 {{ selectedParticipantStageAnswerCount }}</span>
							</div>
						</div>
						<div v-for="(stage, stageIndex) in selectedParticipant.stages || []" :key="`participant-${selectedParticipant.experimentId}-${stage.stageIndex}`" class="stage-record-block">
							<div class="stage-record-title editable-stage-title">
								<strong>阶段 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'stageIndex']" :value="stage.stageIndex" number compact /> · 条件 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'condition']" :value="stage.condition" compact /> · 材料 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'materialId']" :value="stage.materialId" compact /></strong>
								<span>题目版本 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'questionVersion']" :value="stage.questionVersion" compact /> · 阶段用时 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'stageDurationMs']" :value="stage.stageDurationMs" :display="formatReadableDuration(stage.stageDurationMs)" number compact /> · 阶段时间 <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'stageStartedAtMs']" :value="stage.stageStartedAtMs" :display="formatReadableTimestamp(stage.stageStartedAtMs)" number compact /> → <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'stageSubmittedAtMs']" :value="stage.stageSubmittedAtMs" :display="formatReadableTimestamp(stage.stageSubmittedAtMs)" number compact />（间隔 {{ formatRangeDuration(stage.stageStartedAtMs, stage.stageSubmittedAtMs) }}）</span>
							</div>
							<div class="answer-list compact-answer-list">
								<article v-for="(answer, answerIndex) in stage.answers || []" :key="`participant-${selectedParticipant.experimentId}-${stage.stageIndex}-${answer.questionId}`" class="answer-card participant-answer-card">
									<div class="answer-card-header">
										<div>
											<strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'questionId']" :value="answer.questionId" compact /></strong>
											<span>题型：<InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'questionType']" :value="answer.questionType" compact /></span>
										</div>
										<div class="answer-time">
											<strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'durationMs']" :value="answer.durationMs" :display="formatReadableDuration(answer.durationMs)" number compact /></strong>
											<span><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'answerStartedAtMs']" :value="answer.answerStartedAtMs" :display="formatReadableTimestamp(answer.answerStartedAtMs)" number compact /> → <InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'submittedAtMs']" :value="answer.submittedAtMs" :display="formatReadableTimestamp(answer.submittedAtMs)" number compact /></span>
										</div>
									</div>
									<div class="answer-question"><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'questionText']" :value="answer.questionText" multiline /></div>
									<div class="answer-body">
										<div class="answer-label">用户答案</div>
										<div class="answer-text"><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'answer']" :value="answer.answer" multiline /></div>
									</div>
									<div class="answer-meta-grid participant-answer-meta">
										<div><span>主要参考来源</span><strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'primarySource']" :value="answer.primarySource" :display="sourceLabel(answer.primarySource)" compact /></strong></div>
										<div><span>左侧证据</span><strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'leftEvidence']" :value="answer.leftEvidence" multiline /></strong></div>
										<div><span>右侧证据</span><strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'rightEvidence']" :value="answer.rightEvidence" multiline /></strong></div>
										<div><span>答题用时</span><strong><InlineEditValue :submission="selectedParticipant" :path="['stages', stageIndex, 'answers', answerIndex, 'durationMs']" :value="answer.durationMs" :display="formatReadableDuration(answer.durationMs)" number compact /></strong></div>
									</div>
								</article>
							</div>
						</div>
					</section>

					<section class="stage-card questionnaire-card participant-questionnaire-section">
						<div class="stage-card-header">
							<div>
								<h4>事后问卷完整记录 · SUS {{ selectedParticipant.postQuestionnaire?.susScore ?? '—' }}</h4>
								<p v-if="selectedParticipant.postQuestionnaire">问卷总时长：<InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'durationMs']" :value="selectedParticipant.postQuestionnaire.durationMs" :display="formatReadableDuration(selectedParticipant.postQuestionnaire.durationMs)" number compact /></p>
								<p v-if="selectedParticipant.postQuestionnaire">时间：<InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'startedAtMs']" :value="selectedParticipant.postQuestionnaire.startedAtMs" :display="formatReadableTimestamp(selectedParticipant.postQuestionnaire.startedAtMs)" number compact /> → <InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'submittedAtMs']" :value="selectedParticipant.postQuestionnaire.submittedAtMs" :display="formatReadableTimestamp(selectedParticipant.postQuestionnaire.submittedAtMs)" number compact />（间隔 {{ formatRangeDuration(selectedParticipant.postQuestionnaire.startedAtMs, selectedParticipant.postQuestionnaire.submittedAtMs) }}）</p>
							</div>
							<div class="stage-meta">
								<span class="meta-pill">题目数 {{ (selectedParticipant.postQuestionnaire?.answers || []).length }}</span>
								<span class="meta-pill">SUS {{ selectedParticipant.postQuestionnaire?.susScore ?? '—' }}</span>
							</div>
						</div>
						<div v-if="selectedParticipant.postQuestionnaire?.answers?.length" class="answer-list questionnaire-answer-list">
							<article v-for="(answer, questionnaireAnswerIndex) in selectedParticipant.postQuestionnaire.answers" :key="`participant-${selectedParticipant.experimentId}-pq-${answer.questionId}`" class="answer-card questionnaire-answer-card">
								<div class="answer-card-header">
									<div><strong><InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'questionId']" :value="answer.questionId" compact /></strong><span>题型：<InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'questionType']" :value="answer.questionType" compact /></span></div>
									<div class="answer-time"><strong><InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'durationMs']" :value="answer.durationMs" :display="formatReadableDuration(answer.durationMs)" number compact /></strong><span><InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'answerStartedAtMs']" :value="answer.answerStartedAtMs" :display="formatReadableTimestamp(answer.answerStartedAtMs)" number compact /> → <InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'submittedAtMs']" :value="answer.submittedAtMs" :display="formatReadableTimestamp(answer.submittedAtMs)" number compact /></span></div>
								</div>
								<div class="answer-question"><InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'questionText']" :value="answer.questionText" multiline /></div>
								<div class="answer-text"><InlineEditValue :submission="selectedParticipant" :path="['postQuestionnaire', 'answers', questionnaireAnswerIndex, 'answer']" :value="answer.answer" multiline /></div>
							</article>
						</div>
						<div v-else class="empty-inline">该参与者暂无事后问卷。</div>
					</section>
				</div>

				<section class="participant-record-side participant-record-json-tools">
					<div v-if="editingSubmissionId === selectedParticipant.experimentId" class="submission-editor-card participant-json-editor-card">
						<div class="submission-editor-head">
							<div>
								<h4>编辑当前参与者完整 JSON</h4>
								<p>保存后只覆盖当前“实验记录 ID / 参与者编号”对应的这一份实验数据，并重新生成导出文件。</p>
							</div>
							<div class="editor-actions">
								<button type="button" class="detail-toggle" :disabled="submissionEditorSaving" @click="saveEditingSubmission(selectedParticipant)">保存修改</button>
								<button type="button" class="detail-toggle ghost-button" :disabled="submissionEditorSaving" @click="cancelEditingSubmission">取消</button>
							</div>
						</div>
						<p v-if="submissionEditorError" class="editor-error">{{ submissionEditorError }}</p>
						<textarea v-model="submissionEditorText" class="submission-json-editor" spellcheck="false"></textarea>
					</div>
					<details class="submission-editor-card participant-json-preview-card json-collapsible-card">
						<summary>
							<span>原始提交 JSON</span>
							<small>默认隐藏，需要核查或批量修正时点击展开</small>
						</summary>
						<div class="submission-editor-head json-collapsible-head">
							<p>这里展示同一参与者记录的完整原始结构；一般修改请直接双击左侧字段，JSON 仅用于批量或特殊修正。</p>
							<button type="button" class="detail-toggle ghost-button" @click="startEditingSubmission(selectedParticipant)">修改 JSON</button>
						</div>
						<pre class="submission-json-preview"><code>{{ selectedParticipantJson }}</code></pre>
					</details>
				</section>
			</div>
			<div v-else class="empty-state">暂无提交记录。</div>
		</section>

		<section class="table-card raw-records-details">
			<div class="chart-header compact">
				<div>
					<h3>原始提交记录</h3>
					<p>保留阶段回答、证据与计时明细，便于论文附录或数据核查。点击“查看详情”可在全宽面板中查看完整答案与计时。</p>
				</div>
			</div>
			<table class="submission-table">
				<thead>
					<tr>
						<th>参与者编号</th>
						<th>实验记录 ID</th>
						<th>顺序组</th>
						<th>阶段数</th>
						<th>SUS 得分</th>
						<th>总用时</th>
						<th>完成时间</th>
						<th>详情</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="submission in submissions" :key="submissionKey(submission)">
							<tr>
								<td>{{ submission.participantCode || '—' }}</td>
								<td>{{ submission.experimentId || '—' }}</td>
								<td>{{ submission.assignmentGroup || '—' }}</td>
								<td>{{ stageCount(submission) }}</td>
								<td>{{ susScore(submission) }}</td>
								<td>
									<div class="cell-stack">
										<strong>{{ formatReadableDuration(submission.totalDurationMs) }}</strong>
										<small>总计 {{ formatReadableDuration(submission.totalDurationMs) }}</small>
									</div>
								</td>
								<td>
									<div class="cell-stack">
										<strong>{{ formatCompactTime(submission.completedAt) }}</strong>
										<small>{{ formatReadableTimestamp(submission.completedAtMs || submission.completedAt) }}</small>
									</div>
								</td>
								<td>
									<div class="detail-actions">
										<button type="button" class="detail-toggle" @click="toggleSubmissionDetails(submission)">
											{{ expandedSubmissionId === submissionKey(submission) ? '收起详情' : '查看详情' }}
										</button>
										<button type="button" class="detail-toggle ghost-button" @click="startEditingSubmission(submission)">编辑</button>
									</div>
								</td>
							</tr>
							<tr v-if="expandedSubmissionId === submissionKey(submission)" class="detail-row">
								<td colspan="8">
									<div class="submission-detail-panel">
										<div v-if="editingSubmissionId === submission.experimentId" class="submission-editor-card">
									<div class="submission-editor-head">
										<div>
											<h4>编辑原始提交 JSON</h4>
											<p>直接修改这一条实验记录的完整 JSON，保存后会覆盖当前提交并重新生成导出文件。</p>
										</div>
										<div class="editor-actions">
											<button type="button" class="detail-toggle" :disabled="submissionEditorSaving" @click="saveEditingSubmission(submission)">保存修改</button>
											<button type="button" class="detail-toggle ghost-button" :disabled="submissionEditorSaving" @click="cancelEditingSubmission">取消</button>
										</div>
									</div>
									<p v-if="submissionEditorError" class="editor-error">{{ submissionEditorError }}</p>
									<textarea v-model="submissionEditorText" class="submission-json-editor" spellcheck="false"></textarea>
								</div>
								<div class="submission-detail-summary">
											<div class="summary-chip">
												<span>参与者编号</span>
												<strong>{{ submission.participantCode || '—' }}</strong>
											</div>
											<div class="summary-chip">
												<span>实验记录 ID</span>
												<strong>{{ submission.experimentId || '—' }}</strong>
											</div>
											<div class="summary-chip">
												<span>顺序组</span>
												<strong>{{ submission.assignmentGroup || '—' }}</strong>
											</div>
											<div class="summary-chip">
												<span>阶段数</span>
												<strong>{{ stageCount(submission) }}</strong>
											</div>
											<div class="summary-chip">
												<span>SUS 得分</span>
												<strong>{{ susScore(submission) }}</strong>
											</div>
											<div class="summary-chip summary-chip-wide">
												<span>完成时间</span>
												<strong>{{ formatReadableTimestamp(submission.completedAtMs || submission.completedAt) }}</strong>
											</div>
											<div class="summary-chip summary-chip-wide">
												<span>开始时间</span>
												<strong>{{ formatReadableTimestamp(submission.startedAtMs || submission.startedAt) }}</strong>
											</div>
											<div class="summary-chip summary-chip-wide">
												<span>系统记录时间</span>
												<strong>{{ formatTimeRange(submission.startedAtMs, submission.completedAtMs) }}</strong>
											</div>
										</div>

										<section v-for="stage in submission.stages || []" :key="`${submissionKey(submission)}-${stage.stageIndex}`" class="stage-card">
											<div class="stage-card-header">
												<div>
													<h4>阶段 {{ stage.stageIndex }} · {{ stage.condition }} · {{ stage.materialId }}</h4>
													<p>阶段总时长：{{ formatReadableDuration(stage.stageDurationMs) }}</p>
													<p>时间：{{ formatTimeRange(stage.stageStartedAtMs, stage.stageSubmittedAtMs) }}</p>
												</div>
												<div class="stage-meta">
													<span class="meta-pill">题目数 {{ (stage.answers || []).length }}</span>
													<span class="meta-pill">条件 {{ stage.condition || '—' }}</span>
													<span class="meta-pill">材料 {{ stage.materialId || '—' }}</span>
												</div>
											</div>
											<div class="answer-list">
												<article v-for="answer in stage.answers || []" :key="`${stage.stageIndex}-${answer.questionId}`" class="answer-card">
													<div class="answer-card-header">
														<div>
															<strong>{{ answer.questionId }}</strong>
															<span>{{ answer.questionType || '阶段题目' }}</span>
														</div>
														<div class="answer-time">
															<strong>{{ formatReadableDuration(answer.durationMs) }}</strong>
															<span>{{ formatTimeRange(answer.answerStartedAtMs, answer.submittedAtMs) }}</span>
														</div>
													</div>
													<div class="answer-question">{{ answer.questionText }}</div>
													<div class="answer-body">
														<div class="answer-label">答案</div>
														<div class="answer-text">{{ answer.answer || '—' }}</div>
													</div>
													<div class="answer-meta-grid">
														<div>
															<span>主要参考来源</span>
															<strong>{{ sourceLabel(answer.primarySource) }}</strong>
														</div>
														<div>
															<span>左侧证据</span>
															<strong>{{ answer.leftEvidence || '—' }}</strong>
														</div>
														<div>
															<span>右侧证据</span>
															<strong>{{ answer.rightEvidence || '—' }}</strong>
														</div>
														<div>
															<span>开始作答时间</span>
															<strong>{{ formatReadableTimestamp(answer.answerStartedAtMs) }}</strong>
														</div>
														<div>
															<span>提交时间</span>
															<strong>{{ formatReadableTimestamp(answer.submittedAtMs) }}</strong>
														</div>
													</div>
												</article>
											</div>
										</section>

										<section v-if="submission.postQuestionnaire" class="stage-card questionnaire-card">
											<div class="stage-card-header">
												<div>
													<h4>事后问卷 · SUS {{ submission.postQuestionnaire.susScore ?? '—' }}</h4>
													<p>问卷总时长：{{ formatReadableDuration(submission.postQuestionnaire.durationMs) }}</p>
													<p>时间：{{ formatTimeRange(submission.postQuestionnaire.startedAtMs, submission.postQuestionnaire.submittedAtMs) }}</p>
												</div>
												<div class="stage-meta">
													<span class="meta-pill">题目数 {{ (submission.postQuestionnaire.answers || []).length }}</span>
													<span class="meta-pill">SUS {{ submission.postQuestionnaire.susScore ?? '—' }}</span>
												</div>
											</div>
											<div class="answer-list questionnaire-answer-list">
												<article v-for="answer in submission.postQuestionnaire.answers || []" :key="`${submissionKey(submission)}-pq-${answer.questionId}`" class="answer-card questionnaire-answer-card">
													<div class="answer-card-header">
														<div>
															<strong>{{ answer.questionId }}</strong>
															<span>{{ answer.questionType || '问卷题目' }}</span>
														</div>
														<div class="answer-time">
															<strong>{{ formatReadableDuration(answer.durationMs) }}</strong>
															<span>{{ formatTimeRange(answer.answerStartedAtMs, answer.submittedAtMs) }}</span>
														</div>
													</div>
													<div class="answer-question">{{ answer.questionText }}</div>
													<div class="answer-text">{{ answer.answer || '—' }}</div>
												</article>
											</div>
										</section>
									</div>
								</td>
							</tr>
						</template>
						<tr v-if="!loading && !submissions.length">
							<td colspan="8" class="empty-state">暂无提交记录。</td>
						</tr>
						<tr v-if="loading">
							<td colspan="8" class="empty-state">正在加载……</td>
						</tr>
					</tbody>
				</table>
		</section>
			</div>
		</details>

		<details class="research-tools-details">
			<summary>研究者工具区：导出链接</summary>
			<div class="research-tools-body">
		<section class="export-card">
			<h3>导出链接</h3>
			<div class="export-row">
				<div>
					<strong>问卷总表</strong>
					<code>/api/admin/export/questionnaires.csv</code>
				</div>
				<button type="button" :disabled="downloading" @click="downloadExport('api/admin/export/questionnaires.csv', 'questionnaires.csv')">
					下载 questionnaires.csv
				</button>
			</div>
			<div class="export-row">
				<div>
					<strong>问卷明细</strong>
					<code>/api/admin/export/questionnaire_answers.csv</code>
				</div>
				<button type="button" :disabled="downloading" @click="downloadExport('api/admin/export/questionnaire_answers.csv', 'questionnaire_answers.csv')">
					下载 questionnaire_answers.csv
				</button>
			</div>
			<div class="export-row">
				<div>
					<strong>实验总表</strong>
					<code>/api/admin/export/submissions.csv</code>
				</div>
				<button type="button" :disabled="downloading" @click="downloadExport('api/admin/export/submissions.csv', 'submissions.csv')">
					下载 submissions.csv
				</button>
			</div>
			<div class="export-row">
				<div>
					<strong>答题明细</strong>
					<code>/api/admin/export/answers.csv</code>
				</div>
				<button type="button" :disabled="downloading" @click="downloadExport('api/admin/export/answers.csv', 'answers.csv')">
					下载 answers.csv
				</button>
			</div>
		</section>
			</div>
		</details>

	</section>
</template>


<script setup>
	import { computed, defineComponent, h, nextTick, onMounted, ref, watch } from "vue";
	import { adminDownloadExport, adminSubmissions, adminUpdateSubmission } from "@/experiment/experimentApi";
	const {
			buildSubmissionDataAudit,
			calculateExperimentResultStats,
			calculateQuestionnaireStats,
			conditionQuestionAccuracy,
			conditionTaskQuestionAnswerTime,
			conditionQuestionSourceUsage,
			generatePaperDraftSections,
			openFeedbackExamples,
			paperResultHighlights,
			questionnaireSubmissions,
			representativeQ6Answers,
		} = require("@/experiment/questionnaireAnalytics");
	const { calculateSusScore } = require("@/experiment/postQuestionnaire");

	const props = defineProps({
		token: {
			type: String,
			required: true
		}
	});

	const submissions = ref([]);
	const loading = ref(false);
	const downloading = ref(false);
	const message = ref("");
	const errorMessage = ref("");
	const selectedQuestionnaireId = ref("");
	const selectedParticipantId = ref("");
	const expandedSubmissionId = ref("");
	const editingSubmissionId = ref("");
	const submissionEditorText = ref("");
	const submissionEditorError = ref("");
	const submissionEditorSaving = ref(false);
	const inlineEditingKey = ref("");
	const inlineEditText = ref("");
	const inlineEditMultiline = ref(false);
	const inlineEditIsNumber = ref(false);
	const inlineEditInputRef = ref(null);
	const figuresOnly = ref(false);

	const showError = error => {
		errorMessage.value = error.response?.data?.error || error.message || "操作失败，请稍后重试。";
	};

	const loadSubmissions = async () => {
		loading.value = true;
		message.value = "";
		errorMessage.value = "";
		try {
			const response = await adminSubmissions(props.token);
			submissions.value = response.submissions || [];
		} catch (error) {
			showError(error);
		} finally {
			loading.value = false;
		}
	};

	const questionnaireRows = computed(() => questionnaireSubmissions(submissions.value));
	const questionnaireStats = computed(() => calculateQuestionnaireStats(submissions.value));
	const resultStats = computed(() => calculateExperimentResultStats(submissions.value));
	const selectedQuestionnaire = computed(() => questionnaireRows.value.find(submission => submission.experimentId === selectedQuestionnaireId.value) || questionnaireRows.value[0] || null);
	const selectedParticipant = computed(() => submissions.value.find(submission => submission.experimentId === selectedParticipantId.value) || submissions.value[0] || null);
	const selectedParticipantStageAnswerCount = computed(() => (selectedParticipant.value?.stages || []).reduce((total, stage) => total + ((stage.answers || []).length), 0));
	const selectedParticipantJson = computed(() => JSON.stringify(selectedParticipant.value || {}, null, 2));
	const maxSusBinCount = computed(() => Math.max(1, ...questionnaireStats.value.susHistogram.map(item => item.count || 0)));
	const maxQ6Total = computed(() => Math.max(1, ...resultStats.value.q6Insights.byCondition.map(item => item.validTotal || 0)));
	const accuracyMatrix = computed(() => conditionQuestionAccuracy(submissions.value));
	const sourceMatrix = computed(() => conditionQuestionSourceUsage(submissions.value));
	const timeMatrix = computed(() => conditionTaskQuestionAnswerTime(submissions.value));
	const dataAudit = computed(() => buildSubmissionDataAudit(submissions.value));
	const resultHighlights = computed(() => paperResultHighlights(submissions.value));
	const paperFigures = computed(() => resultHighlights.value.paperFigures || {});
	const paperMetricRows = computed(() => resultHighlights.value.paperMetricRows || []);
	const paperDraft = computed(() => generatePaperDraftSections(submissions.value));
	const paperPreviewSections = computed(() => (paperDraft.value.paperSectionsZh || []).map((section, index) => ({
		key: section.key || section.label || section.title || `paper-section-${index}`,
		...section,
		subsections: (section.subsections || []).map((subsection, subsectionIndex) => ({
			key: subsection.key || subsection.label || subsection.title || `${section.label || section.title}-sub-${subsectionIndex}`,
			...subsection,
		})),
	})));
	const paperFigureEntries = computed(() => ["figure7", "figure8", "figure9", "figure10"].map(key => ({ key, ...(paperFigures.value[key] || {}) })).filter(item => item.labelZh));
	const q6Examples = computed(() => representativeQ6Answers(submissions.value, 4));
	const feedbackExamples = computed(() => openFeedbackExamples(submissions.value, 6));
	const sourceOrder = ["M", "A", "T", "Other"];
	const maxGroupedTimeMean = computed(() => Math.max(1, ...timeMatrix.value.map(row => row.wikicompare?.mean || 0), ...timeMatrix.value.map(row => row.chatgpt?.mean || 0)));
	const shouldShowPaperXAxisLabel = (index, total, maxVisible = 8) => {
		const count = Math.max(0, Number(total) || 0);
		const limit = Math.max(2, Number(maxVisible) || 8);
		if (count <= limit) return true;
		const step = Math.ceil((count - 1) / (limit - 1));
		return index === 0 || index === count - 1 || index % step === 0;
	};
	const paperAxisGridStyle = total => ({
		gridTemplateColumns: `repeat(${Math.max(1, Number(total) || 0)}, minmax(0, 1fr))`,
		'--paper-axis-gap': Number(total) > 8 ? '8px' : '14px',
	});

	watch(questionnaireRows, rows => {
		if (!rows.length) {
			selectedQuestionnaireId.value = "";
			return;
		}
		if (!rows.some(submission => submission.experimentId === selectedQuestionnaireId.value)) {
			selectedQuestionnaireId.value = rows[0].experimentId;
		}
	}, { immediate: true });

	watch(submissions, rows => {
		if (!rows.length) {
			selectedParticipantId.value = "";
			return;
		}
		if (!rows.some(submission => submission.experimentId === selectedParticipantId.value)) {
			selectedParticipantId.value = rows[0].experimentId;
		}
	}, { immediate: true });

	const stageCount = submission => (submission.stages || []).length;
	const setNestedValue = (root, path, value) => {
		let cursor = root;
		for (let index = 0; index < path.length - 1; index += 1) {
			cursor = cursor[path[index]];
		}
		cursor[path[path.length - 1]] = value;
	};
	const pathKey = path => (Array.isArray(path) ? path.join(".") : String(path));
	const fieldKey = (submission, path) => `${submissionKey(submission)}::${pathKey(path)}`;
	const isInlineEditing = (submission, path) => inlineEditingKey.value === fieldKey(submission, path);
	const cancelInlineEdit = () => {
		inlineEditingKey.value = "";
		inlineEditText.value = "";
		inlineEditMultiline.value = false;
		inlineEditIsNumber.value = false;
	};
	const startInlineEdit = (submission, path, value, options = {}) => {
		if (!submission) return;
		selectedParticipantId.value = submission.experimentId || selectedParticipantId.value;
		inlineEditingKey.value = fieldKey(submission, path);
		inlineEditText.value = value == null ? "" : String(value);
		inlineEditMultiline.value = !!options.multiline;
		inlineEditIsNumber.value = !!options.number;
		submissionEditorError.value = "";
	};
	const commitInlineEdit = async submission => {
		if (!submission || !inlineEditingKey.value) return;
		const path = inlineEditingKey.value.split("::").slice(1).join("::").split(".").filter(Boolean);
		const next = JSON.parse(JSON.stringify(submission));
		let value = inlineEditText.value;
		if (inlineEditIsNumber.value) {
			if (String(value).trim() === "") {
				submissionEditorError.value = "数字字段不能为空。";
				return;
			}
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				submissionEditorError.value = "请输入有效数字。";
				return;
			}
			value = parsed;
		}
		const normalizedPath = path.map(segment => (String(Number(segment)) === segment ? Number(segment) : segment));
		setNestedValue(next, normalizedPath, value);
		if (normalizedPath[0] === "postQuestionnaire" && normalizedPath[1] === "answers" && normalizedPath[3] === "answer") {
			const recalc = calculateSusScore(next.postQuestionnaire?.answers || []);
			if (Number.isFinite(recalc)) next.postQuestionnaire.susScore = recalc;
		}
		submissionEditorSaving.value = true;
		submissionEditorError.value = "";
		try {
			await adminUpdateSubmission(props.token, submission.experimentId, next);
			await loadSubmissions();
			selectedParticipantId.value = next.experimentId || submission.experimentId;
			message.value = `已更新 ${next.experimentId || submission.experimentId}。`;
			cancelInlineEdit();
		} catch (error) {
			submissionEditorError.value = error.response?.data?.error || error.message || "保存失败，请检查内容后重试。";
		} finally {
			submissionEditorSaving.value = false;
		}
	};

	watch(inlineEditingKey, async key => {
		if (!key) return;
		await nextTick();
		const target = inlineEditInputRef.value;
		if (target?.focus) target.focus();
		if (target?.select) target.select();
	}, { flush: "post" });

	const InlineEditValue = defineComponent({
		name: "InlineEditValue",
		props: {
			submission: { type: Object, required: true },
			path: { type: [Array, String], required: true },
			value: { default: "" },
			display: { default: null },
			placeholder: { type: String, default: "" },
			multiline: { type: Boolean, default: false },
			number: { type: Boolean, default: false },
			compact: { type: Boolean, default: false },
		},
		setup(componentProps) {
			const editing = computed(() => isInlineEditing(componentProps.submission, componentProps.path));
			const displayValue = computed(() => {
				const value = componentProps.display ?? componentProps.value;
				return value === undefined || value === null || value === "" ? "—" : String(value);
			});
			const begin = () => startInlineEdit(componentProps.submission, componentProps.path, componentProps.value, {
				multiline: componentProps.multiline,
				number: componentProps.number,
			});
			const commit = () => commitInlineEdit(componentProps.submission);
			const handleKeydown = event => {
				if (event.key === "Escape") {
					event.preventDefault();
					cancelInlineEdit();
					return;
				}
				if (!componentProps.multiline && event.key === "Enter") {
					event.preventDefault();
					commit();
				}
				if (componentProps.multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
					event.preventDefault();
					commit();
				}
			};
			return () => h("span", {
				class: ["inline-edit-field", {
					"inline-edit-field-editing": editing.value,
					"inline-edit-field-multiline": componentProps.multiline,
					"inline-edit-field-compact": componentProps.compact,
				}],
			}, editing.value ? [
				h(componentProps.multiline ? "textarea" : "input", {
					ref: inlineEditInputRef,
					class: ["inline-edit-input", componentProps.multiline ? "inline-edit-textarea" : ""],
					disabled: submissionEditorSaving.value,
					placeholder: componentProps.placeholder,
					type: componentProps.number ? "number" : "text",
					value: inlineEditText.value,
					rows: componentProps.multiline ? 4 : undefined,
					onBlur: commit,
					onInput: event => { inlineEditText.value = event.target.value; },
					onKeydown: handleKeydown,
				}),
				componentProps.multiline ? h("small", { class: "inline-edit-save-hint" }, "失焦自动保存，Ctrl/⌘+Enter 保存，Esc 取消") : null,
			] : [
				h("button", {
					type: "button",
					class: "inline-edit-value",
					title: "双击可编辑",
					onDblclick: begin,
				}, displayValue.value),
				h("small", { class: "inline-edit-hint" }, "双击可编辑"),
			]);
		},
	});
	const susScore = submission => submission.postQuestionnaire?.susScore ?? "—";
	const submissionKey = submission => submission.experimentId || submission.participantCode || submission.startedAt || "submission";
	const startEditingSubmission = submission => {
		if (!submission) return;
		editingSubmissionId.value = submission.experimentId || "";
		selectedParticipantId.value = submission.experimentId || selectedParticipantId.value;
		submissionEditorError.value = "";
		submissionEditorText.value = JSON.stringify(submission, null, 2);
		if (submission.experimentId) expandedSubmissionId.value = submission.experimentId;
	};
	const cancelEditingSubmission = () => {
		editingSubmissionId.value = "";
		submissionEditorText.value = "";
		submissionEditorError.value = "";
	};
	const saveEditingSubmission = async submission => {
		const experimentId = submission.experimentId;
		if (!experimentId) return;
		submissionEditorSaving.value = true;
		submissionEditorError.value = "";
		try {
			const parsed = JSON.parse(submissionEditorText.value);
			await adminUpdateSubmission(props.token, experimentId, parsed);
			await loadSubmissions();
			editingSubmissionId.value = "";
			submissionEditorText.value = "";
			message.value = `已更新 ${experimentId}。`;
		} catch (error) {
			submissionEditorError.value = error.response?.data?.error || error.message || "保存失败，请检查 JSON 后重试。";
		} finally {
			submissionEditorSaving.value = false;
		}
	};
	const toggleSubmissionDetails = submission => {
		const key = submissionKey(submission);
		selectedParticipantId.value = submission.experimentId || selectedParticipantId.value;
		expandedSubmissionId.value = expandedSubmissionId.value === key ? "" : key;
		if (expandedSubmissionId.value !== key && editingSubmissionId.value === key) cancelEditingSubmission();
	};
	const participantRecordLabel = submission => {
		const code = submission.participantCode || "未命名";
		const stages = stageCount(submission);
		const stageAnswers = (submission.stages || []).reduce((total, stage) => total + ((stage.answers || []).length), 0);
		const questionnaireAnswers = (submission.postQuestionnaire?.answers || []).length;
		return `${code} · ${submission.assignmentGroup || "—"} · ${stages}阶段/${stageAnswers}答题/${questionnaireAnswers}问卷 · ${submission.completedAt || submission.experimentId || "—"}`;
	};
	const questionnaireLabel = submission => {
		const code = submission.participantCode || "未命名";
		const score = submission.postQuestionnaire?.susScore ?? "—";
		return `${code} · SUS ${score} · ${submission.completedAt || submission.experimentId || "—"}`;
	};
	const formatStat = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
	const formatDuration = value => formatReadableDuration(value);
	const formatReadableDuration = value => {
		if (!Number.isFinite(Number(value))) return "—";
		const totalMs = Math.max(0, Math.round(Number(value)));
		const seconds = Math.floor(totalMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const remMinutes = minutes % 60;
		const remSeconds = seconds % 60;
		if (hours > 0) return `${hours}小时${remMinutes}分${remSeconds}秒`;
		if (minutes > 0) return `${minutes}分${remSeconds}秒`;
		if (seconds > 0) return `${seconds}秒`;
		return "少于1秒";
	};
	const padTime = value => String(value).padStart(2, "0");
	const formatReadableTimestamp = value => {
		const number = Number(value);
		let date = null;
		if (Number.isFinite(number) && number > 0) date = new Date(number);
		else if (typeof value === "string" && value.trim()) date = new Date(value);
		if (!date || Number.isNaN(date.getTime())) return "—";
		return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())} ${padTime(date.getHours())}:${padTime(date.getMinutes())}:${padTime(date.getSeconds())}`;
	};
	const formatRangeDuration = (start, end) => {
		const duration = Number(end) - Number(start);
		return Number.isFinite(duration) && duration >= 0 ? formatReadableDuration(duration) : "—";
	};
	const formatTimeRange = (start, end) => {
		const left = formatReadableTimestamp(start);
		const right = formatReadableTimestamp(end);
		const durationText = formatRangeDuration(start, end);
		const suffix = durationText !== "—" ? `（间隔 ${durationText}）` : "";
		if (left === "—" && right === "—") return "—";
		return `${left} → ${right}${suffix}`;
	};
	const sourceLabel = source => ({
		M: "大模型 / 系统回答（M）",
		A: "文章原文（A）",
		T: "三栏表格（T）",
		Other: "其他",
	}[source] || source || "—");

	const formatCompactTime = value => {
		if (!value) return "—";
		const date = Number.isFinite(Number(value)) ? new Date(Number(value)) : new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
	};
	const formatSignedDuration = value => Number.isFinite(Number(value)) ? `${value >= 0 ? "+" : ""}${formatReadableDuration(Math.abs(Number(value)))}` : "—";
	const formatSignedReadableDuration = value => {
		if (!Number.isFinite(Number(value))) return "—";
		const prefix = Number(value) >= 0 ? "+" : "−";
		return `${prefix}${formatReadableDuration(Math.abs(Number(value)))}`;
	};
	const formatPercent = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "待评分";
	const percentWidth = value => Math.max(0, Math.min(100, Number(value) || 0));
	const groupedTimeWidth = value => `${Math.max(0, Math.min(100, ((Number(value) || 0) / maxGroupedTimeMean.value) * 100))}%`;
	const deltaClass = value => {
		const text = String(value || "");
		if (text.startsWith("+")) return "positive";
		if (text.startsWith("-")) return "negative";
		return "";
	};
	const susHeight = bin => `${(bin.count / maxSusBinCount.value) * 100}`;
	const q6Width = value => `${((Number(value) || 0) / maxQ6Total.value) * 100}`;
	const sourceColor = source => ({ M: "#bebada", A: "#8dd3c7", T: "#fdb462", Other: "#b3b3b3" }[source] || "#b3b3b3");
	const q6VisibleSources = items => (items || []).filter(item => Number(item?.count) > 0);
	const pieStyle = items => {
		const rows = (items || []).filter(item => item.count > 0);
		if (!rows.length) return { background: "#e2e8f0" };
		const total = rows.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
		if (!total) return { background: "#e2e8f0" };
		let cursor = 0;
		const segments = rows.map(item => {
			const start = cursor;
			cursor += ((Number(item.count) || 0) / total) * 360;
			return `${sourceColor(item.source)} ${start}deg ${cursor}deg`;
		});
		return { background: `conic-gradient(${segments.join(", ")})` };
	};

	const copyPaperDraft = async () => {
		try {
			const text = paperDraft.value.latexZh || paperDraft.value.latex || "";
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				textarea.remove();
			}
			message.value = "已复制论文草稿。";
		} catch (error) {
			showError(error);
		}
	};

	const downloadExport = async (path, filename) => {
		downloading.value = true;
		message.value = "";
		errorMessage.value = "";
		try {
			const blob = await adminDownloadExport(props.token, path);
			const objectUrl = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = objectUrl;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(objectUrl);
			message.value = `已开始下载 ${filename}。`;
		} catch (error) {
			showError(error);
		} finally {
			downloading.value = false;
		}
	};

	onMounted(loadSubmissions);
</script>

<style scoped>
	.admin-panel { display: grid; gap: 20px; }
	.admin-panel.figure-only-mode { gap: 14px; }
	.panel-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
	.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
	.ghost-button { background: #f8fafc; }
	h2 { margin: 0 0 8px; font-size: 28px; color: #172033; }
	p { margin: 0; color: #64748b; }
	.inline-edit-note { grid-column: 1 / -1; padding: 10px 12px; border-radius: 12px; background: #eff6ff; color: #1d4ed8; font-size: 13px; font-weight: 800; }
	.field-secondary { display: block; margin-top: 4px; color: #64748b; font-size: 12px; }
	.editable-stage-title strong, .editable-stage-title span { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
	:deep(.inline-edit-field) { display: inline-grid; gap: 4px; min-width: 0; max-width: 100%; vertical-align: top; }
	:deep(.inline-edit-field-multiline) { display: block; width: 100%; }
	:deep(.inline-edit-value) { display: inline-block; max-width: 100%; padding: 2px 5px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: inherit; font: inherit; font-weight: inherit; text-align: left; white-space: pre-wrap; word-break: break-word; cursor: text; }
	:deep(.inline-edit-field-compact .inline-edit-value) { padding: 1px 4px; border-radius: 6px; }
	:deep(.inline-edit-value:hover) { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
	:deep(.inline-edit-hint) { color: #94a3b8; font-size: 10px; font-weight: 800; line-height: 1; opacity: 0; transition: opacity 0.15s ease; }
	:deep(.inline-edit-field:hover .inline-edit-hint) { opacity: 1; }
	:deep(.inline-edit-input) { width: min(100%, 720px); box-sizing: border-box; border: 2px solid #2563eb; border-radius: 10px; padding: 8px 10px; background: #ffffff; color: #172033; font: inherit; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
	:deep(.inline-edit-textarea) { min-height: 92px; resize: vertical; line-height: 1.55; }
	:deep(.inline-edit-save-hint) { display: block; margin-top: 4px; color: #64748b; font-size: 11px; font-weight: 700; }
	.export-card, .table-card, .notice, .analysis-card, .chart-card, .paper-table-card, .paper-draft-card, .paper-warning-card, .highlight-card, .data-trace-details, .research-tools-details { border: 1px solid #dbe4ee; border-radius: 16px; padding: 16px; background: #ffffff; box-sizing: border-box; min-width: 0; }
	h3 { margin: 0; font-size: 18px; color: #172033; }
	.export-card { display: grid; gap: 12px; }
	.data-trace-details, .research-tools-details { display: grid; gap: 12px; background: #fbfdff; }
	.data-trace-details > summary, .research-tools-details > summary { cursor: pointer; font-weight: 900; color: #172033; list-style-position: inside; }
	.data-trace-body, .research-tools-body { display: grid; gap: 16px; margin-top: 14px; }
	.export-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-radius: 12px; padding: 12px; background: #f8fafc; }
	.export-row strong { display: block; margin-bottom: 4px; color: #172033; }
	code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 13px; color: #334155; word-break: break-all; }
	.paper-table-card { overflow-x: auto; }
	.paper-metric-table { width: 100%; border-collapse: collapse; min-width: 860px; }
	.paper-metric-table th { position: static; }
	.paper-metric-section { display: grid; gap: 16px; padding: 18px; border: 1px solid #dbe4ee; border-radius: 18px; background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); box-shadow: 0 14px 30px rgba(15, 23, 42, 0.04); break-inside: avoid; page-break-inside: avoid; }
	.paper-metric-section .section-title { padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0; }
	.paper-metric-section .section-title h3 { font-size: 20px; }
	.paper-metric-section .section-title p { max-width: 980px; }
	.paper-metric-table td:nth-child(2), .paper-metric-table td:nth-child(3), .paper-metric-table td:nth-child(4) { font-weight: 900; white-space: nowrap; }
	.paper-warning-card.danger, .draft-warning.danger { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
	.result-highlights { display: grid; gap: 14px; }
	.highlight-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.highlight-card { display: grid; gap: 8px; background: linear-gradient(180deg, #f8fbff, #ffffff); }
	.highlight-card span { color: #64748b; font-size: 12px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; }
	.highlight-card strong { color: #172033; font-size: 18px; line-height: 1.45; }
	.highlight-card p { font-size: 13px; line-height: 1.6; }
	.primary-highlight { background: linear-gradient(180deg, #eff6ff, #ffffff); border-color: #bfdbfe; }
	.paper-warning-card { display: flex; gap: 10px; align-items: baseline; padding: 14px 16px; background: linear-gradient(180deg, #fff7ed, #ffffff); color: #9a3412; }
	.paper-warning-card strong { color: inherit; white-space: nowrap; }
	.paper-draft-card { display: grid; gap: 16px; border: 1px solid #b8b8b8; border-radius: 4px; padding: 18px 20px; background: #ffffff; box-shadow: none; }
	.paper-draft-header { align-items: flex-start; }
	.draft-actions { display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; }
	.paper-draft-layout { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(280px, 0.9fr); gap: 16px; align-items: start; }
	.paper-preview { border: 1px solid #d1d1d1; border-radius: 2px; background: #ffffff; padding: 30px 36px; box-shadow: none; color: #111827; font-family: "Times New Roman", "Noto Serif SC", "Songti SC", serif; }
	.paper-preview-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 1px solid #a3a3a3; padding-bottom: 12px; margin-bottom: 18px; }
	.paper-preview-header > div:first-child { display: grid; gap: 4px; }
	.paper-preview-kicker { display: inline-flex; margin-bottom: 3px; color: #3f3f46; font-size: 11px; font-weight: 700; text-transform: none; letter-spacing: 0.02em; }
	.paper-preview h4 { margin: 0; font-size: 21px; color: #111827; font-weight: 700; }
	.paper-preview-subtitle { margin: 0; color: #52525b; font-size: 12px; line-height: 1.45; font-family: "Times New Roman", "Songti SC", serif; }
	.paper-preview-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; align-content: flex-start; font-family: "Times New Roman", "Songti SC", serif; }
	.paper-preview-section + .paper-preview-section { margin-top: 24px; }
	.paper-section-heading { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
	.paper-section-heading.nested { margin-top: 14px; }
	.paper-section-heading h5, .paper-section-heading h6 { margin: 0; color: #111827; }
	.paper-section-heading h5 { font-size: 18px; }
	.paper-section-heading h6 { font-size: 15px; }
	.paper-preview-section p { margin: 0 0 10px; color: #111827; font-size: 15px; line-height: 1.72; text-align: justify; }
	.paper-subsection { display: grid; gap: 8px; margin-top: 10px; padding: 0 0 0 12px; border-left: 1.5px solid #a3a3a3; background: #ffffff; border-radius: 0; }
	.paper-subsection p { margin: 0; font-size: 15px; line-height: 1.85; }
	.paper-preview-aside { display: grid; gap: 12px; align-content: start; position: sticky; top: 16px; }
	.paper-side-card { border: 1px solid #cfcfcf; border-radius: 2px; padding: 12px 14px; background: #ffffff; display: grid; gap: 10px; font-family: "Times New Roman", "Songti SC", serif; }
	.paper-side-card h4 { margin: 0; font-size: 16px; color: #172033; }
	.figure-reference-item { border-left: 2px solid #777; border-radius: 0; padding: 7px 0 7px 10px; background: #ffffff; display: grid; gap: 3px; }
	.figure-reference-item strong { color: #172033; line-height: 1.45; }
	.figure-reference-item p { margin: 0; color: #52525b; font-size: 12.5px; line-height: 1.45; }
	.paper-raw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
	.paper-draft-textarea { width: 100%; min-height: 300px; resize: vertical; box-sizing: border-box; border: 1px solid #dbe4ee; border-radius: 14px; padding: 14px; background: #f8fafc; color: #172033; font: 13px/1.65 "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
	.paper-draft-textarea::selection { background: #dbeafe; }
	.paper-raw-grid .paper-draft-textarea { min-height: 260px; }
	.research-tools-details { border: 1px solid #dbe4ee; border-radius: 18px; background: #ffffff; padding: 0 16px 16px; box-sizing: border-box; }
	.research-tools-details > summary { cursor: pointer; list-style: none; padding: 14px 0 12px; font-weight: 900; color: #172033; }
	.research-tools-details > summary::-webkit-details-marker { display: none; }
	.research-tools-details > summary::after { content: "\00a0▾"; color: #94a3b8; font-size: 12px; }
	.research-tools-details[open] > summary::after { content: "\00a0▴"; }
	.research-tools-body { display: grid; gap: 20px; }
	.raw-records-details { padding-top: 10px; }
	.raw-records-details > summary { cursor: pointer; list-style: none; font-weight: 900; color: #172033; margin: -4px 0 10px; }
	.raw-records-details > summary::-webkit-details-marker { display: none; }
	.raw-records-details > summary::after { content: "\00a0▾"; color: #94a3b8; font-size: 12px; }
	.raw-records-details[open] > summary::after { content: "\00a0▴"; }
	.chart-card, .paper-table-card, .analysis-card, .paper-draft-card, .table-card { min-width: 0; }
	.chart-grid > *, .overview-grid > * { min-width: 0; }
	.chart-card { display: grid; gap: 12px; align-content: start; height: 100%; }
	.paper-chart-card { padding: 18px; border-color: #cfd9e6; background: linear-gradient(180deg, #ffffff 0%, #fcfdff 100%); }
	.paper-metric-section .chart-card { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75); }
	.chart-grid { align-items: stretch; }
	.paper-table-card, .table-card, .analysis-card { overflow-x: auto; }
	.figure-tag { display: inline-flex; align-items: center; gap: 6px; margin-right: 8px; font-size: 12px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 0.08em; vertical-align: middle; }
	.figure-caption { margin-top: -4px; padding: 0 2px 2px; color: #64748b; font-size: 12px; line-height: 1.6; }
	.figure-caption strong { color: #334155; }
	.summary-table, .paper-metric-table, .submission-table { width: 100%; }

	.draft-warning { border: 1px solid #dbe4ee; background: #f8fafc; color: #475569; border-radius: 12px; padding: 10px 12px; font-size: 13px; font-weight: 800; margin-bottom: 10px; }
	.english-draft-details { border: 1px solid #d4d4d8; border-radius: 2px; background: #fafafa; padding: 12px; margin-top: 12px; }
	.english-draft-details summary { cursor: pointer; font-weight: 900; color: #334155; }
	.paper-admin-details { border: 1px solid #c7c7c7; border-radius: 4px; background: #ffffff; padding: 0 16px 16px; box-sizing: border-box; }
	.paper-admin-details > summary { cursor: pointer; list-style: none; padding: 13px 0 12px; font-family: "Times New Roman", "Songti SC", serif; font-size: 15px; font-weight: 700; color: #27272a; border-bottom: 1px solid #e4e4e7; }
	.paper-admin-details > summary::-webkit-details-marker { display: none; }
	.paper-admin-details > summary::after { content: "\00a0▾"; color: #71717a; font-size: 12px; }
	.paper-admin-details[open] > summary::after { content: "\00a0▴"; }
	.paper-admin-body { display: grid; gap: 14px; padding-top: 14px; }
	.paper-draft-textarea.secondary { margin-top: 10px; min-height: 300px; background: #ffffff; }
	.source-cell-head { display: flex; align-items: center; gap: 8px; font-weight: 900; margin-bottom: 8px; }
	.source-mini-bars { display: flex; height: 8px; min-width: 120px; overflow: hidden; border-radius: 999px; background: #e2e8f0; border: 1px solid #dbe4ee; }
	.source-mini-bars span { height: 100%; min-width: 2px; }
	.difference-pill.tiny { padding: 4px 8px; font-size: 12px; }
	.overview-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 16px; }
	.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
	.lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.source-grid .chart-card, .q6-grid .chart-card { min-height: 420px; }
	.metric-card { border: 1px solid #dbe4ee; border-radius: 16px; padding: 16px; background: linear-gradient(180deg, #f8fbff, #ffffff); display: grid; gap: 8px; }
	.metric-label { color: #64748b; font-size: 13px; font-weight: 700; }
	.metric-value { color: #172033; font-size: 28px; line-height: 1; }
	.metric-caption { color: #94a3b8; font-size: 12px; }
		.metric-section { display: grid; gap: 16px; }
	.figure-only-mode .paper-admin-details,
	.figure-only-mode .paper-warning-card,
	.figure-only-mode .research-tools-details,
	.figure-only-mode .data-trace-details,
	.figure-only-mode .result-highlights,
	.figure-only-mode .paper-table-card,
	.figure-only-mode .overview-grid,
	.figure-only-mode .analysis-card,
	.figure-only-mode .metric-section:not(.paper-metric-section) { display: none; }
	.figure-only-mode .paper-metric-section { margin-top: 0; }
	.figure-only-mode { max-width: 1160px; margin-inline: auto; background: #ffffff; }
	.figure-only-mode .paper-draft-card { border-color: #c7c7c7; }
	.section-title { display: grid; gap: 6px; }
	.section-title p { font-size: 13px; }
	.metric-empty { min-height: 120px; display: flex; align-items: center; justify-content: center; }
	.source-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.q6-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.source-pie-card .pie-layout { display: grid; grid-template-columns: minmax(240px, 0.95fr) minmax(0, 1.05fr); gap: 16px; align-items: center; }
	.pie-chart { width: min(300px, 100%); aspect-ratio: 1; border-radius: 50%; border: 1px solid #dbe4ee; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); margin-inline: auto; }
	.legend-list { display: grid; gap: 10px; align-content: start; }
	.legend-row { display: grid; grid-template-columns: 14px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
	.legend-row strong { color: #172033; }
	.legend-swatch { width: 14px; height: 14px; border-radius: 999px; border: 1px solid rgba(0, 0, 0, 0.08); }
	.stacked-list { display: grid; gap: 12px; }
	.stacked-row { display: grid; gap: 8px; }
	.stacked-track { display: flex; min-height: 18px; border-radius: 999px; overflow: hidden; background: #e2e8f0; border: 1px solid #dbe4ee; }
	.stacked-segment { height: 100%; min-width: 2px; }
	.q6-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
	.mini-metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: grid; gap: 6px; }
	.mini-metric span { font-size: 12px; color: #64748b; font-weight: 700; }
	.mini-metric strong { font-size: 22px; color: #172033; }
	.q6-bar { background: linear-gradient(90deg, #fb7185, #ea580c); }
	.q6-time-bar { background: linear-gradient(90deg, #14b8a6, #0f766e); }
	.time-bar { background: linear-gradient(90deg, #60a5fa, #2563eb); }
	.wiki-fill { background: linear-gradient(90deg, #93c5fd, #2563eb); }
	.gpt-fill { background: linear-gradient(90deg, #fca5a5, #dc2626); }
	.time-column-chart { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; align-items: end; min-height: 260px; }
	.time-column { display: grid; gap: 10px; align-items: end; justify-items: center; }
	.time-column-fill { background: linear-gradient(180deg, #818cf8, #4f46e5); }
	.compact-summary-table { min-width: 0; }
	.subtle-row { opacity: 0.92; }
	.accuracy-bar { background: linear-gradient(90deg, #22c55e, #16a34a); }
	.supplementary-section { margin-top: 4px; }
	.chart-header { display: grid; gap: 6px; margin-bottom: 14px; }
	.chart-header.compact { margin-bottom: 0; }
	.chart-header h3 { font-size: 16px; line-height: 1.35; }
	.chart-header p { font-size: 13px; line-height: 1.6; }
	.bar-list { display: grid; gap: 12px; }
	.bar-row, .comparison-row { display: grid; gap: 10px; }
	.bar-label { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
	.bar-label strong { color: #172033; }
	.bar-label span, .comparison-meta span, .summary-note span, .bar-meta span, .mean-stat span { font-size: 12px; color: #64748b; }
	.bar-track { background: #e2e8f0; border-radius: 999px; overflow: hidden; position: relative; }
	.bar-track.horizontal { height: 12px; width: 100%; }
	.bar-track.vertical { width: 100%; min-height: 180px; display: flex; align-items: end; }
	.paper-metric-section .bar-track.horizontal { height: 14px; }
	.paper-metric-section .bar-track.vertical { min-height: 200px; }
	.bar-fill.horizontal { height: 100%; background: linear-gradient(90deg, #93c5fd, #2563eb); }
	.bar-fill.vertical { width: 100%; background: linear-gradient(180deg, #60a5fa, #2563eb); }
	.assignment-bar { background: linear-gradient(90deg, #0ea5e9, #2563eb); }
	.condition-bar { background: linear-gradient(90deg, #f59e0b, #ea580c); }
	.sus-bar { background: linear-gradient(180deg, #22c55e, #15803d); }
	.bar-chart.vertical { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; align-items: end; min-height: 240px; }
	.bar-column { display: grid; gap: 10px; align-items: end; justify-items: center; }
	.bar-meta { text-align: center; display: grid; gap: 4px; }
	.comparison-block { display: grid; gap: 14px; }
	.comparison-meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
	.comparison-summary { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 12px; background: #fff7ed; color: #9a3412; font-weight: 800; }
	.summary-table { width: 100%; border-collapse: collapse; min-width: 480px; }
	.summary-table th, .summary-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
	.summary-table th { background: #f8fafc; color: #334155; font-weight: 900; }
	.summary-note { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; font-size: 13px; color: #172033; }
	.mean-list { display: grid; gap: 12px; }
	.mean-row { display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
	.mean-text { display: grid; gap: 4px; }
	.mean-text strong { color: #172033; }
	.mean-text span { color: #64748b; font-size: 13px; line-height: 1.45; }
	.mean-scale { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
	.mean-stat { display: grid; justify-items: end; gap: 4px; min-width: 72px; }
	.likert-bar { background: linear-gradient(90deg, #fb7185, #8b5cf6); }
	.single-questionnaire-toolbar { margin-bottom: 16px; }
	.single-questionnaire-toolbar label { display: grid; gap: 8px; max-width: 520px; font-weight: 700; color: #334155; }
	select { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; font: inherit; color: #172033; background: #ffffff; }
	.selected-questionnaire { display: grid; gap: 16px; }
	.participant-full-record-card { border-color: #b7cceb; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
	.record-count-chip { align-self: flex-start; border: 1px solid #c7d9ee; border-radius: 999px; padding: 7px 11px; background: #eff6ff; color: #1d4ed8; font-weight: 900; font-size: 13px; white-space: nowrap; }
	.participant-record-toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: end; flex-wrap: wrap; }
	.participant-record-toolbar label { flex: 1 1 560px; max-width: none; }
	.record-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
	.participant-record-layout { grid-template-columns: minmax(0, 1fr); align-items: start; gap: 12px; }
	.participant-record-main, .participant-record-side { display: grid; gap: 10px; min-width: 0; }
	.participant-record-side { align-self: start; }
	.participant-record-json-tools { margin-top: 0; }
	.participant-summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	.participant-stage-section, .participant-questionnaire-section { background: #ffffff; }
	.stage-record-block { display: grid; gap: 12px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; }
	.stage-record-title { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; flex-wrap: wrap; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
	.stage-record-title strong { color: #172033; font-size: 15px; }
	.stage-record-title span { color: #64748b; font-size: 12px; font-weight: 700; }
	.compact-answer-list { gap: 10px; }
	.participant-answer-card { background: #ffffff; }
	.participant-answer-meta { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	.participant-json-editor-card, .participant-json-preview-card { border-color: #b7cceb; }
	.json-collapsible-card { padding: 0; overflow: hidden; }
	.json-collapsible-card > summary { cursor: pointer; list-style: none; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #172033; font-weight: 900; }
	.json-collapsible-card > summary::-webkit-details-marker { display: none; }
	.json-collapsible-card > summary::after { content: "点击展开 ▾"; flex: 0 0 auto; color: #64748b; font-size: 12px; font-weight: 800; }
	.json-collapsible-card[open] > summary { border-bottom: 1px solid #dbe4ee; }
	.json-collapsible-card[open] > summary::after { content: "点击收起 ▴"; }
	.json-collapsible-card summary small { color: #64748b; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.json-collapsible-head { padding: 14px 16px 0; }
	.json-collapsible-card .submission-json-preview { margin: 14px 16px 16px; }
	.submission-json-preview { max-height: 680px; overflow: auto; margin: 0; border: 1px solid #dbe4ee; border-radius: 12px; padding: 12px; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.55; white-space: pre; }
	.submission-json-preview code { color: inherit; }
	.selected-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
	.selected-summary div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc; display: grid; gap: 6px; }
	.selected-summary strong { color: #64748b; font-size: 12px; }
	.selected-summary span { color: #172033; font-weight: 800; word-break: break-word; }
	.answers-table, .score-table { width: 100%; border-collapse: collapse; min-width: 720px; }
	.questionnaire-table { min-width: 840px; }
	.submission-table { width: 100%; border-collapse: collapse; }
	th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; vertical-align: top; font-size: 14px; }
	th { background: #f8fafc; color: #334155; font-weight: 900; position: sticky; top: 0; }
	td { color: #172033; }
	button { border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; background: #ffffff; color: #172033; font-weight: 900; white-space: nowrap; cursor: pointer; }
	button:disabled { cursor: not-allowed; opacity: 0.55; }
	.detail-toggle { padding: 8px 12px; font-size: 13px; }
	.notice.success { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
	.notice.error { border-color: #fecaca; background: #fff7f7; color: #991b1b; }
	.empty-state, .empty-inline { padding: 22px; color: #64748b; text-align: center; }
	.submission-detail-panel { display: grid; gap: 16px; padding: 16px; border: 1px solid #dbe4ee; border-radius: 16px; background: #f8fbff; }
	.submission-editor-card { display: grid; gap: 12px; padding: 14px; border: 1px solid #c7d9ee; border-radius: 14px; background: #ffffff; }
	.submission-editor-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
	.editor-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
	.submission-json-editor { width: 100%; min-height: 320px; border-radius: 12px; border: 1px solid #cbd5e1; padding: 12px; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; color: #0f172a; background: #f8fafc; resize: vertical; }
	.editor-error { margin: 0; color: #b42318; font-weight: 700; }
	.detail-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
	.submission-detail-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
	.summary-chip { border: 1px solid #dbe4ee; border-radius: 14px; padding: 12px; background: #ffffff; display: grid; gap: 6px; }
	.summary-chip span, .stage-meta span, .answer-card-header span, .answer-time span, .answer-label, .answer-question, .answer-meta-grid span, .cell-stack small { color: #64748b; }
	.summary-chip strong, .stage-card h4, .answer-card strong { color: #172033; }
	.summary-chip span { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
	.summary-chip strong { word-break: break-word; line-height: 1.4; }
	.summary-chip-wide { grid-column: span 2; }
	.stage-card { border: 1px solid #dbe4ee; border-radius: 16px; padding: 14px; background: #ffffff; display: grid; gap: 14px; }
	.stage-card-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
	.stage-card-header h4 { margin: 0 0 6px; }
	.stage-card-header p { margin: 0; color: #64748b; font-size: 13px; }
	.stage-meta { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
	.meta-pill { border: 1px solid #dbe4ee; border-radius: 999px; padding: 6px 10px; background: #f8fafc; font-size: 12px; font-weight: 800; color: #334155; }
	.answer-list { display: grid; gap: 12px; }
	.answer-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; display: grid; gap: 10px; }
	.answer-card-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
	.answer-card-header > div { display: grid; gap: 4px; }
	.answer-time { display: grid; justify-items: end; gap: 4px; text-align: right; }
	.answer-question { line-height: 1.5; font-weight: 600; word-break: break-word; white-space: pre-wrap; }
	.answer-body { display: grid; gap: 6px; }
	.answer-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
	.answer-text { white-space: pre-wrap; word-break: break-word; line-height: 1.6; color: #172033; }
	.answer-meta-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
	.answer-meta-grid div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; background: #ffffff; display: grid; gap: 6px; }
	.answer-meta-grid span { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
	.answer-meta-grid strong { word-break: break-word; line-height: 1.4; color: #172033; }
	.questionnaire-answer-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.questionnaire-answer-card { background: #ffffff; }
	.detail-row td { padding: 0; border-bottom: 0; background: #f8fbff; }
	.cell-stack { display: grid; gap: 4px; }
	.cell-stack strong { color: #172033; }


	/* Paper-style figures: mimic the restrained ACM/matplotlib look used in the paper assets. */
	.paper-figure-section { gap: 12px; border: 1px solid #c7c7c7; border-radius: 4px; background: #ffffff; box-shadow: none; padding: 18px 20px 16px; }
	.paper-figure-section .paper-section-title { border-bottom: 0; padding-bottom: 0; }
	.paper-figure-section .paper-section-title h3 { font-family: "Times New Roman", "Songti SC", serif; font-size: 19px; font-weight: 700; color: #111827; }
	.paper-figure-section .paper-section-title p { font-family: "Times New Roman", "Songti SC", serif; font-size: 13px; color: #3f3f46; line-height: 1.55; }
	.paper-figure { margin: 0; display: grid; gap: 10px; padding: 14px 14px 12px; background: #ffffff; border: 1px solid #d8d8d8; border-radius: 2px; min-width: 0; }
	.paper-figure-wide { padding-top: 10px; }
	.paper-figure figcaption, .section-caption { font-family: "Times New Roman", "Songti SC", serif; font-size: 12.5px; line-height: 1.45; color: #27272a; text-align: left; }
	.figure-tag { color: #111827; letter-spacing: 0.03em; }
	.figure-legend { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; align-items: center; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; color: #27272a; }
	.figure-legend.top-legend { justify-content: flex-end; margin-bottom: -4px; }
	.figure-legend span { display: inline-flex; align-items: center; gap: 5px; }
	.legend-swatch { display: inline-block; width: 13px; height: 10px; border-radius: 0; border: 1px solid rgba(0, 0, 0, 0.35); box-sizing: border-box; }
	.condition-wiki { background: #b3cde3 !important; }
	.condition-gpt { background: #fbb4ae !important; }
	.finding-swatch { background: #8dd3c7; }
	.question-swatch { background: #fdb462; }

	.axis-plot { display: grid; grid-template-columns: 24px 36px 1fr; gap: 8px; min-height: 310px; align-items: stretch; }
	.axis-plot .y-axis-label { writing-mode: vertical-rl; transform: rotate(180deg); align-self: center; justify-self: center; font-family: "Times New Roman", serif; font-size: 12px; color: #27272a; }
	.y-ticks { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding: 8px 0 34px; font-family: "Times New Roman", serif; font-size: 11px; color: #3f3f46; }
	.y-ticks.compact-ticks { padding-bottom: 34px; }
	.plot-body { position: relative; min-width: 0; border-left: 1.25px solid #27272a; border-bottom: 1.25px solid #27272a; padding: 8px 10px 0; }
	.grid-line { position: absolute; left: 0; right: 0; height: 1px; background: #e5e5e5; pointer-events: none; }
	.line-100 { top: 8px; }
	.line-75 { top: calc(8px + 25% - 8px); }
	.line-50 { top: 50%; }
	.line-25 { bottom: calc(25% + 34px); }
	.paper-bar-groups { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--paper-axis-gap, 14px); height: 100%; min-height: 260px; align-items: end; }
	.time-groups, .histogram-groups { grid-template-columns: repeat(6, minmax(0, 1fr)); }
	.paper-bar-group { display: grid; grid-template-rows: 1fr auto auto; gap: 5px; height: 100%; min-width: 0; text-align: center; }
	.paper-bars { display: flex; justify-content: center; align-items: flex-end; gap: 8px; min-height: 212px; }
	.paper-bars.two-bars .paper-bar { width: min(34px, 42%); }
	.paper-bars.single-bar .paper-bar { width: min(42px, 52%); }
	.paper-bar { position: relative; min-height: 2px; border: 1px solid rgba(0, 0, 0, 0.5); box-sizing: border-box; transition: none; }
	.paper-bar span { position: absolute; left: 50%; bottom: calc(100% + 3px); transform: translateX(-50%); white-space: nowrap; font-family: "Times New Roman", serif; font-size: 10.5px; color: #27272a; }
	.sus-paper-bar { background: #55a868; }
	.x-label { display: grid; gap: 2px; min-height: 36px; font-family: "Times New Roman", "Songti SC", serif; color: #27272a; }
	.x-label.axis-label-hidden { visibility: hidden; }
	.x-label.compact { min-height: 24px; }
	.x-label strong { font-size: 12px; color: #111827; }
	.x-label small { font-size: 10px; line-height: 1.15; color: #52525b; max-width: 112px; margin: 0 auto; }
	.delta-note { font-family: "Times New Roman", serif; font-size: 11px; color: #52525b; }
	.delta-note.positive { color: #2f6f4f; }
	.delta-note.negative { color: #9d3b3e; }

	.paper-subfigure-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
	.subfigure-title, .matrix-title { font-family: "Times New Roman", "Songti SC", serif; color: #111827; font-size: 13px; font-weight: 700; text-align: center; }
	.source-stack-plot { display: grid; gap: 16px; padding: 14px 4px 8px; }
	.source-stack-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) 74px; gap: 10px; align-items: center; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; color: #27272a; }
	.source-stack-label { font-weight: 700; text-align: right; }
	.source-stack-track { display: flex; height: 24px; border: 1px solid #4b5563; background: #f4f4f5; overflow: hidden; }
	.source-stack-track span { min-width: 1px; height: 100%; border-right: 1px solid rgba(255, 255, 255, 0.65); }
	.source-stack-value { color: #52525b; }
	.paper-source-matrix { display: grid; gap: 8px; padding: 8px 14px 0; }
	.paper-compact-table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", "Songti SC", serif; }
	.paper-compact-table th, .paper-compact-table td { position: static; border-bottom: 1px solid #d4d4d8; background: #ffffff; padding: 7px 9px; font-size: 12.5px; color: #27272a; }
	.paper-compact-table th { border-top: 1px solid #a1a1aa; border-bottom: 1.25px solid #71717a; font-weight: 700; }
	.paper-badge { border-radius: 0; border: 1px solid rgba(0, 0, 0, 0.35); color: #111827; margin-right: 8px; min-width: 24px; text-align: center; }

	.data-audit-card { border: 1.25px solid #a1a1aa; border-radius: 4px; background: #fff; padding: 14px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06); }
	.data-audit-card.danger { border-color: #dc2626; background: #fff7f7; }
	.audit-header { margin-bottom: 10px; }
	.audit-updated { align-self: start; border: 1px solid #d4d4d8; padding: 5px 8px; background: #fafafa; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; color: #3f3f46; }
	.audit-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
	.audit-chip { border: 1px solid #d4d4d8; background: #fafafa; padding: 8px 10px; min-width: 0; display: grid; gap: 4px; font-family: "Times New Roman", "Songti SC", serif; }
	.audit-chip span { font-size: 11px; color: #71717a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
	.audit-chip strong { font-size: 13px; color: #18181b; overflow-wrap: anywhere; }
	.audit-chip.danger strong { color: #b91c1c; }
	.figure-data-table { margin-top: 12px; }
	.q6-coding-note { margin-top: 8px; padding: 7px 9px; border: 1px dashed #a1a1aa; background: #fafafa; color: #52525b; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; line-height: 1.45; }
	.q6-data-panel { margin: 12px 0 10px; border-top: 1px solid #d4d4d8; padding-top: 10px; }
	.q6-data-title { font-family: "Times New Roman", "Songti SC", serif; font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 6px; }
	.q6-summary-table th, .q6-summary-table td { vertical-align: top; }
	.q6-source-chip { display: inline-flex; align-items: center; gap: 4px; margin: 0 6px 4px 0; white-space: nowrap; color: #27272a; }
	.q6-source-chip i { width: 9px; height: 9px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.35); }

	.q6-bars-plot { display: grid; gap: 18px; padding: 16px 8px 8px; }
	.q6-bars-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) 116px; gap: 10px; align-items: center; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; }
	.q6-condition-name { text-align: right; font-weight: 700; color: #27272a; }
	.q6-bar-stack { display: flex; height: 26px; border: 1px solid #4b5563; background: #f4f4f5; }
	.q6-bar-part { display: flex; align-items: center; justify-content: center; min-width: 1px; color: #111827; font-size: 11px; border-right: 1px solid rgba(255, 255, 255, 0.75); }
	.q6-bar-part.findings { background: #8dd3c7; }
	.q6-bar-part.questions { background: #fdb462; }
	.q6-total { color: #52525b; }
	.paper-pie-layout { display: grid; grid-template-columns: minmax(150px, 0.9fr) minmax(0, 1.1fr); gap: 14px; align-items: center; padding: 10px 0; }
	.paper-pie { width: min(210px, 100%); aspect-ratio: 1; border-radius: 50%; border: 1px solid #27272a; margin: 0 auto; }
	.paper-pie-legend { display: grid; gap: 8px; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; }
	.pie-legend-row { display: grid; grid-template-columns: 14px 24px 1fr; gap: 8px; align-items: center; color: #27272a; }
	.paper-quote-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
	.paper-quote-card { border-left: 3px solid #9ca3af; padding: 8px 10px; background: #fafafa; font-family: "Times New Roman", "Songti SC", serif; }
	.paper-quote-card div { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: #52525b; margin-bottom: 4px; }
	.paper-quote-card p { font-size: 12.5px; line-height: 1.5; color: #27272a; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

	.histogram-plot { min-height: 290px; }
	.likert-dot-plot { display: grid; gap: 8px; padding: 4px 0 0; }
	.likert-dot-row { display: grid; grid-template-columns: minmax(180px, 1.15fr) minmax(180px, 1fr) 42px; gap: 10px; align-items: center; font-family: "Times New Roman", "Songti SC", serif; font-size: 12px; }
	.likert-item-label { display: grid; grid-template-columns: 44px 1fr; gap: 8px; align-items: center; min-width: 0; }
	.likert-item-label strong { color: #111827; }
	.likert-item-label span { color: #52525b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.likert-axis { position: relative; height: 16px; border-bottom: 1.25px solid #27272a; display: flex; justify-content: space-between; align-items: flex-end; }
	.likert-axis i { width: 1px; height: 7px; background: #27272a; }
	.likert-dot { position: absolute; bottom: -5px; width: 10px; height: 10px; border-radius: 50%; background: #c44e52; border: 1px solid #27272a; transform: translateX(-50%); }
	.likert-value { font-weight: 700; color: #27272a; text-align: right; }
	.likert-scale-labels { margin-left: calc(44px + 8px + 180px + 10px); display: flex; justify-content: space-between; max-width: calc(100% - 260px); font-family: "Times New Roman", serif; font-size: 11px; color: #52525b; }
	.paper-note { font-family: "Times New Roman", "Songti SC", serif; justify-content: center; border-top: 1px solid #e4e4e7; padding-top: 6px; }
	small { color: #64748b; }
	@media (max-width: 1200px) {
		.highlight-grid { grid-template-columns: 1fr; }
		.source-pie-card .pie-layout { grid-template-columns: 1fr; }
		.paper-warning-card { flex-direction: column; }
		.paper-draft-textarea { min-height: 360px; }
		.overview-grid, .audit-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.lower-grid, .source-grid, .q6-grid, .highlight-grid { grid-template-columns: 1fr; }
		.submission-detail-summary, .participant-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.participant-record-layout { grid-template-columns: 1fr; }
		.participant-record-side { position: static; }
		.answer-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.questionnaire-answer-list { grid-template-columns: 1fr; }
	}
	@media (max-width: 760px) {
		.panel-header, .export-row { display: grid; }
		.overview-grid, .chart-grid, .selected-summary, .highlight-grid, .audit-grid { grid-template-columns: 1fr; }
		.bar-chart.vertical { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.submission-detail-summary, .participant-summary-grid { grid-template-columns: 1fr; }
		.summary-chip-wide { grid-column: auto; }
		.answer-card-header, .stage-card-header { display: grid; }
		.answer-time, .stage-meta { justify-items: start; text-align: left; }
		.answer-meta-grid, .participant-answer-meta { grid-template-columns: 1fr; }
	}
</style>
