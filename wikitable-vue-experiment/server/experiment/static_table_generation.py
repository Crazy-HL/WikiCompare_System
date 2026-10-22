import json
import re

from services.config import get_llm_config
from services.llm_client import LLMClient

from .question_generation import (
    MAX_ARTICLE_PROMPT_CHARS,
    article_text,
    load_material_articles,
)

STATIC_TABLE_GENERATION_SYSTEM_PROMPT = """You are generating a controlled ChatGPT-condition static comparison table for a reading experiment.

The table is a frozen experimental stimulus, not an interactive answer. Use only the two supplied article inputs, including their complete infoboxes and complete article bodies. Do not use web search, tools, memory, general world knowledge, or information from outside the supplied source IDs.

Your goal is to create a neutral three-column comparison table that supports participants in comparing the two articles. Each row should represent one clear comparison dimension. The left cell must summarize only the left article evidence, the middle cell must name the comparison dimension, and the right cell must summarize only the right article evidence.

Use only source IDs that appear in the supplied input. Do not invent, rewrite, merge, or guess source IDs. If a comparison cannot be supported by both articles, either avoid that row or explicitly mark the missing side according to the requested JSON schema.

The generated table should help answer the study’s predefined comparison-question types, while avoiding direct overfitting to any single answer. Prefer factual, comparable, evidence-grounded dimensions over broad interpretation. Preserve important numerical values, dates, rankings, named entities, and causal/relational claims when they are present in the sources.

Return valid JSON only. Do not include Markdown, comments, explanations, code fences, or text outside the JSON object. The JSON must follow the schema requested in the user prompt exactly."""
DEFAULT_STATIC_TABLE_ROW_COUNT = 10
STATIC_TABLE_MODEL_PROMPT_CHARS = 12_000
CHATGPT_CONDITION_CONTROL_PROMPT = """提示词 0：ChatGPT 条件控制指令

你正在参与一个双文档比较阅读实验。

你只能使用本会话中上传的两篇带来源编号的文章。除非研究人员明确提供新的实验材料，否则不得使用网页搜索、外部工具、连接器、记忆知识、常识补全或其他会话内容。

请遵守以下规则：
1. 不得把文章没有提供的信息当作事实；
2. 文章没有提供或无法确定时，明确回答“材料不足”；
3. 不得擅自补充年份、单位、统计口径、因果关系或背景知识；
4. 回答事实时保留原文中的年份、单位、范围和限定条件；
5. 每个事实性陈述后附真实来源编号，例如 [L-P003] 或 [R-F005]；
6. 不得把推测写成文章明确陈述；
7. 不主动生成新的初始问题；
8. 等待研究人员发送后续指令。

请先回复“已准备好”，不要总结或分析文章。"""


def build_static_table_prompt(material, left_article, right_article, max_article_chars=MAX_ARTICLE_PROMPT_CHARS):
    left_title = material.get("leftTitle") or left_article.get("title") or "左文"
    right_title = material.get("rightTitle") or right_article.get("title") or "右文"
    row_count = _static_table_row_count(material)
    return f"""提示词 1：ChatGPT 静态三栏表生成

请根据本会话中上传的两篇带来源编号文章，生成一个用于比较阅读的静态三栏表。

左侧文章：{left_title}
右侧文章：{right_title}
要求的有效数据行数：{row_count}

本系统自动生成时会把“提示词 0：ChatGPT 条件控制指令”和本提示词一起保存。请在内容上严格遵守提示词 0：只能使用上传文章信息，不得使用网页搜索、外部工具、连接器、记忆知识、常识补全或其他会话内容。

================ 输入材料 ================

【左侧文章】
标题：{left_title}
完整材料（完整 infobox + 完整正文）：
{article_text(left_article, max_article_chars)}

【右侧文章】
标题：{right_title}
完整材料（完整 infobox + 完整正文）：
{article_text(right_article, max_article_chars)}

============================================

严格要求：
1. 只能使用上传文章中的信息，不得使用外部知识或常识补全；
2. 在正式 ChatGPT 会话中，目标输出是只输出一个 Markdown 三栏表，不输出总结、解释、结论或其他图表；
3. 三列顺序固定为：{left_title}｜可比属性｜{right_title}；
4. 有效数据行必须恰好为 {row_count} 行；
5. 每行只表达一个左右文章都具有比较意义的属性、结构、类别、趋势或明确的文本特征；
6. 优先选择能够帮助读者理解两篇文章核心内容的属性，不要因为某个字段容易提取就选择它；
7. 左右两侧使用原文中的事实，并在事实后附真实来源编号；
8. 保留原文中的年份、单位、范围、定义和限定条件；
9. 如果一侧没有提供对应信息，写“材料未提供”，不得推测或用外部知识补齐；
10. 年份、单位或统计口径不一致时，在“可比属性”列中明确说明，不能把不同口径的数据直接合并；
11. 不能把两个不同属性合并为一行，也不能把同一属性重复生成多行；
12. 行的排列应优先呈现文章的核心主题和具有比较价值的内容，不根据随机顺序排列；
13. 表格中不得出现研究人员没有提供的解释性结论；
14. 表格最后一行结束后立即停止输出。

输出前静默检查：
- 是否恰好三列；
- 是否恰好 {row_count} 行；
- 每一行是否只有一个属性；
- 每个事实是否有真实来源编号；
- 年份、单位、定义是否完整；
- 是否存在外部知识或猜测。

为了让实验网站能冻结、展示和编辑该表格，本次自动生成请只输出合法 JSON，不输出 Markdown 说明。JSON 中的 markdown_table 必须是上面要求的原生 ChatGPT Markdown 三栏表，rows 必须与 markdown_table 逐行一致：
{{
  "markdown_table": "| {left_title} | 可比属性 | {right_title} |\\n| --- | --- | --- |\\n| 左侧事实 [L-P001] | 比较属性 | 右侧事实 [R-P001] |",
  "rows": [
    {{
      "id": "R1",
      "label": "比较属性",
      "left": {{ "value": "左侧事实 [L-P001]" }},
      "right": {{ "value": "右侧事实 [R-P001]" }}
    }}
  ]
}}"""


def _static_table_row_count(material):
    for key in ("staticTableRowCount", "static_table_row_count", "rowCount", "nRows"):
        try:
            value = int(material.get(key))
        except (TypeError, ValueError, AttributeError):
            continue
        if value > 0:
            return value
    return DEFAULT_STATIC_TABLE_ROW_COUNT


def normalize_static_table(raw):
    if isinstance(raw, str):
        parsed = json.loads(raw)
    else:
        parsed = raw
    rows = parsed.get("rows") if isinstance(parsed, dict) else parsed
    if not isinstance(rows, list) or not rows:
        raise ValueError("Static table generation must return a non-empty rows list")
    normalized_rows = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"Static table row {index} must be an object")
        normalized_rows.append(_normalize_static_row(row, index))
    normalized = {"rows": normalized_rows}
    if isinstance(parsed, dict) and isinstance(parsed.get("markdown_table"), str):
        normalized["markdown_table"] = parsed["markdown_table"]
    if "markdown_table" not in normalized:
        normalized["markdown_table"] = _rows_to_markdown_table(normalized_rows, "左侧文章", "可比属性", "右侧文章")
    return normalized


def generate_static_table_from_material(material, llm_client=None):
    left_article, right_article = load_material_articles(material)
    full_prompt = build_static_table_prompt(
        material,
        left_article,
        right_article,
        max_article_chars=MAX_ARTICLE_PROMPT_CHARS,
    )
    model_prompt = build_static_table_prompt(
        material,
        left_article,
        right_article,
        max_article_chars=STATIC_TABLE_MODEL_PROMPT_CHARS,
    )

    config = get_llm_config()
    client = llm_client or (LLMClient(config) if config.enabled else None)
    generation_mode = "fallback"
    fallback_reason = "LLM client unavailable; generated from local article alignment"
    normalized = None

    if client is not None:
        try:
            prompt_to_send = model_prompt if isinstance(client, LLMClient) else full_prompt
            raw_table = client.chat_json([
                {"role": "system", "content": STATIC_TABLE_GENERATION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt_to_send},
            ])
            normalized = normalize_static_table(raw_table)
            generation_mode = "llm"
            fallback_reason = ""
        except Exception as error:
            fallback_reason = _compact_error_message(error)

    if normalized is None:
        normalized = _build_fallback_static_table(material, left_article, right_article)

    normalized["generation_prompts"] = _generation_prompt_metadata(
        full_prompt,
        material,
        generation_mode=generation_mode,
        fallback_reason=fallback_reason,
    )
    return normalized


def _generation_prompt_metadata(user_prompt, material=None, *, generation_mode="llm", fallback_reason=""):
    metadata = {
        "chatgpt_condition_control_prompt": {
            "title": "提示词 0：ChatGPT 条件控制指令",
            "text": CHATGPT_CONDITION_CONTROL_PROMPT,
        },
        "static_table_prompt": {
            "system": STATIC_TABLE_GENERATION_SYSTEM_PROMPT,
            "user": user_prompt,
            "title": "提示词 1：ChatGPT 静态三栏表生成",
            "row_count": _static_table_row_count(material or {}),
            "generation_mode": generation_mode,
        },
    }
    if fallback_reason:
        metadata["static_table_prompt"]["fallback_reason"] = fallback_reason
    return metadata


def _normalize_static_row(row, index):
    return {
        **row,
        "id": str(row.get("id") or f"R{index}"),
        "label": str(row.get("label") or f"比较项 {index}"),
        "left": _normalize_side(row.get("left") or row.get("leftValue") or row.get("left_value")),
        "right": _normalize_side(row.get("right") or row.get("rightValue") or row.get("right_value")),
    }


def _normalize_side(value):
    if isinstance(value, dict):
        if not any(key in value for key in ("value", "text", "raw", "values", "display", "rawText")):
            return {"value": json.dumps(value, ensure_ascii=False)}
        return value
    if value is None or value == "":
        return {"value": "材料未明确说明"}
    return {"value": str(value)}


def _build_fallback_static_table(material, left_article, right_article):
    row_count = _static_table_row_count(material)
    left_candidates = _collect_static_table_candidates(left_article, "left")
    right_candidates = _collect_static_table_candidates(right_article, "right")
    left_index, left_order = _index_static_candidates(left_candidates)
    right_index, right_order = _index_static_candidates(right_candidates)

    rows = []
    used_keys = set()
    for key in left_order:
        if key in used_keys:
            continue
        left_candidate = left_index.get(key)
        right_candidate = right_index.get(key)
        if not left_candidate or not right_candidate:
            continue
        rows.append(_static_table_row_from_candidates(len(rows) + 1, left_candidate, right_candidate))
        used_keys.add(key)
        if len(rows) >= row_count:
            return _fallback_payload(rows, left_article, right_article)

    for key in right_order:
        if len(rows) >= row_count:
            break
        if key in used_keys:
            continue
        left_candidate = left_index.get(key)
        right_candidate = right_index.get(key)
        if not left_candidate or not right_candidate:
            continue
        rows.append(_static_table_row_from_candidates(len(rows) + 1, left_candidate, right_candidate))
        used_keys.add(key)

    if not rows:
        raise RuntimeError("No comparable static table rows could be derived from the supplied articles")
    return _fallback_payload(rows, left_article, right_article)


def _fallback_payload(rows, left_article, right_article):
    return {
        "rows": rows,
        "markdown_table": _rows_to_markdown_table(
            rows,
            left_article.get("title") or "左文",
            "可比属性",
            right_article.get("title") or "右文",
        ),
    }


def _collect_static_table_candidates(article, side):
    candidates = []
    for index, field in enumerate(article.get("infobox") or []):
        label = field.get("label") or field.get("key") or field.get("section") or ""
        value = field.get("value") or field.get("valueText") or field.get("text") or ""
        if not label or not value:
            continue
        source_id = field.get("id") or field.get("sourceId") or f"{side}-info-{index + 1}"
        candidates.append({
            "key": _normalize_static_label(label),
            "label": str(label).strip(),
            "value": str(value).strip(),
            "source_id": str(source_id),
            "kind": "infobox",
            "order": len(candidates),
        })
    for index, paragraph in enumerate(article.get("paragraphs") or []):
        section = paragraph.get("section") or ""
        text = _preferred_paragraph_text(paragraph)
        if not section or not text:
            continue
        source_id = paragraph.get("id") or f"{side}-p-{index + 1}"
        candidates.append({
            "key": _normalize_static_label(section),
            "label": str(section).strip(),
            "value": str(text).strip(),
            "source_id": str(source_id),
            "kind": "paragraph",
            "order": len(candidates),
        })
    return candidates


def _preferred_paragraph_text(paragraph):
    sentences = paragraph.get("sentences") or []
    for sentence in sentences:
        text = sentence.get("text") if isinstance(sentence, dict) else None
        if isinstance(text, str) and text.strip():
            return text.strip()
    text = paragraph.get("text") or ""
    return str(text).strip()


def _index_static_candidates(candidates):
    indexed = {}
    order = []
    for candidate in candidates:
        key = candidate.get("key")
        if not key:
            continue
        if key not in order:
            order.append(key)
        previous = indexed.get(key)
        if previous is None or _candidate_rank(candidate) < _candidate_rank(previous):
            indexed[key] = candidate
    return indexed, order


def _candidate_rank(candidate):
    kind_priority = 0 if candidate.get("kind") == "infobox" else 1
    return (kind_priority, int(candidate.get("order") or 0))


def _static_table_row_from_candidates(index, left_candidate, right_candidate):
    left_label = left_candidate.get("label") or ""
    right_label = right_candidate.get("label") or ""
    label = left_label if _normalize_static_label(left_label) == _normalize_static_label(right_label) else left_label or right_label or f"比较项 {index}"
    return {
        "id": f"R{index}",
        "label": label,
        "left": {"value": _format_static_table_value(left_candidate)},
        "right": {"value": _format_static_table_value(right_candidate)},
    }


def _format_static_table_value(candidate):
    value = str(candidate.get("value") or "").strip()
    source_id = str(candidate.get("source_id") or "").strip()
    if source_id:
        return f"{value} [{source_id}]"
    return value or "材料未明确说明"


def _normalize_static_label(text):
    if not isinstance(text, str):
        return ""
    normalized = text.casefold()
    replacements = (
        ("organisations", "organizations"),
        ("organisation", "organization"),
        ("labour", "labor"),
        ("colour", "color"),
    )
    for old, new in replacements:
        normalized = normalized.replace(old, new)
    normalized = re.sub(r"\([^)]*\)", " ", normalized)
    normalized = normalized.replace("&", " and ")
    normalized = re.sub(r"[^\w\s]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _rows_to_markdown_table(rows, left_title, middle_title, right_title):
    def escape_cell(value):
        return str(value).replace("|", "\\|")

    lines = [
        f"| {escape_cell(left_title)} | {escape_cell(middle_title)} | {escape_cell(right_title)} |",
        "| --- | --- | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {escape_cell(row.get('left', {}).get('value', ''))} | {escape_cell(row.get('label', ''))} | {escape_cell(row.get('right', {}).get('value', ''))} |"
        )
    return "\n".join(lines)


def _compact_error_message(error):
    message = str(error).strip() or error.__class__.__name__
    return message if len(message) <= 500 else f"{message[:500]}…"
