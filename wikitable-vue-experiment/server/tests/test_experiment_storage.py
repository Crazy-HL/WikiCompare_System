import csv
from pathlib import Path

import pytest

from experiment.assignment import assignment_for_code
from experiment.storage import ExperimentStorage


def complete_questions_payload(material_id="M1"):
    return {
        "material_id": material_id,
        "version": 1,
        "frozen": False,
        "questions": [
            {
                "question_id": f"Q{index}",
                "question_text": f"Compare fact {index}.",
                "machine_gradable": True,
                "grading_rubric": "机器判分标准：答案内容必须匹配 canonical_answer 或 accepted_variants；仅证据编号正确但答案内容错误，必须判错。",
                "gold_atoms": [
                    {
                        "atom_id": f"Q{index}-A1",
                        "requirement": "answer content must match",
                        "canonical_answer": f"Answer {index}",
                        "accepted_variants": [],
                        "source_ids": [f"S{index}"],
                    }
                ],
            }
            for index in range(1, 6)
        ],
    }




def deterministic_questions_payload(material_id):
    payload = complete_questions_payload(material_id)
    if material_id == "M1":
        payload["questions"][4]["gold_atoms"] = [
            {
                "atom_id": "Q5-A1",
                "requirement": "判断综合结论是否被共同支持",
                "canonical_answer": "不支持。",
                "accepted_variants": ["材料不支持", "不成立"],
                "source_ids": ["S5"],
            },
            {
                "atom_id": "Q5-A2",
                "requirement": "解释被调换的概念",
                "canonical_answer": "South Korea 对应 chaebols；Japan 对应 keiretsu。",
                "accepted_variants": [],
                "source_ids": ["S6"],
            },
        ]
    if material_id == "M2":
        payload["questions"][4]["gold_atoms"] = [
            {
                "atom_id": "Q5-A1",
                "requirement": "判断综合结论是否被共同支持",
                "canonical_answer": "支持；India total area 和 population 都高于 Indonesia。",
                "accepted_variants": ["支持", "成立"],
                "source_ids": ["S5"],
            }
        ]
    return payload


def complete_questionnaire_payload():
    return {
        "startedAtMs": 1202000,
        "submittedAtMs": 1502000,
        "durationMs": 300000,
        "susScore": 100,
        "answers": [
            *[
                {
                    "questionId": f"SUS{index}",
                    "questionText": f"SUS {index}",
                    "questionType": "sus",
                    "answer": "5" if index % 2 == 1 else "1",
                    "answerStartedAtMs": 1202000 + index,
                    "submittedAtMs": 1203000 + index,
                    "durationMs": 1000,
                }
                for index in range(1, 11)
            ],
            *[
                {
                    "questionId": f"CMP{index}",
                    "questionText": f"CMP {index}",
                    "questionType": "comparison",
                    "answer": "4",
                    "answerStartedAtMs": 1203000 + index,
                    "submittedAtMs": 1204000 + index,
                    "durationMs": 1000,
                }
                for index in range(1, 5)
            ],
            {
                "questionId": "WF_HELPFUL",
                "questionText": "你认为 WikiCompare 最有帮助的地方是什么？",
                "questionType": "open",
                "answer": "帮助我快速定位证据。",
                "answerStartedAtMs": 1204001,
                "submittedAtMs": 1205001,
                "durationMs": 1000,
            },
            {
                "questionId": "WF_IMPROVE",
                "questionText": "你认为 WikiCompare 最需要改进的地方是什么？",
                "questionType": "open",
                "answer": "希望图注更清晰。",
                "answerStartedAtMs": 1205002,
                "submittedAtMs": 1206002,
                "durationMs": 1000,
            },
        ],
    }

def complete_submission_payload(participant_code="P01"):
    assignment = assignment_for_code(participant_code)
    payload = {
        "participantCode": assignment["participantCode"],
        "assignmentGroup": assignment["group"],
        "startedAt": "2026-07-31T00:00:00Z",
        "completedAt": "2026-07-31T00:20:00Z",
        "startedAtMs": 1000,
        "completedAtMs": 1201000,
        "totalDurationMs": 1200000,
        "postQuestionnaire": complete_questionnaire_payload(),
        "stages": [],
    }
    for stage_offset, stage in enumerate(assignment["stages"]):
        payload["stages"].append({
            **stage,
            "questionVersion": 1,
            "stageStartedAtMs": 1000 + stage_offset * 600000,
            "stageSubmittedAtMs": 601000 + stage_offset * 600000,
            "stageDurationMs": 600000,
            "answers": [
                {
                    "questionId": f"Q{index}",
                    "questionText": f"Question {index}",
                    "answer": "Answer text",
                    "primarySource": "T",
                    "leftEvidence": "L-P001",
                    "rightEvidence": "R-P001",
                    "answerStartedAtMs": 2000 + index,
                    "submittedAtMs": 3000 + index,
                    "durationMs": 1000,
                }
                for index in range(1, 7)
            ],
        })
    return payload


def test_storage_creates_default_config_and_question_files(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()

    config = storage.get_config()
    assert [item["id"] for item in config["materials"]] == ["M1", "M2"]
    assert "在阅读两篇文章" in config["q6Text"]
    assert (tmp_path / "config" / "questions" / "M1.json").exists()
    assert (tmp_path / "config" / "questions" / "M2.json").exists()


def test_question_save_and_freeze_round_trip(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    payload = complete_questions_payload("M1")

    saved = storage.save_questions("M1", payload)
    assert saved["material_id"] == "M1"
    assert saved["questions"][0]["question_id"] == "Q1"

    frozen = storage.freeze_questions("M1", True)
    assert frozen["frozen"] is True
    assert storage.load_participant_questions("M1")["frozen"] is True

    with pytest.raises(ValueError, match="frozen"):
        storage.save_questions("M1", complete_questions_payload("M1"))


def test_static_table_save_and_freeze_round_trip(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    rows = [{"id": "r1", "label": "GDP", "left": {"value": "1"}, "right": {"value": "2"}}]

    saved = storage.save_static_table("M1", rows)
    assert saved["version"] == 1
    assert saved["rows"] == rows

    frozen = storage.freeze_static_table("M1", True)
    assert frozen["frozen"] is True
    assert storage.load_participant_static_table("M1") == {"material_id": "M1", "version": 1, "rows": rows}

    with pytest.raises(ValueError, match="frozen"):
        storage.save_static_table("M1", rows)


def test_save_submission_assigns_id_and_exports_csv(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    saved = storage.save_submission(complete_submission_payload("P01"))

    assert saved["experimentId"].startswith("exp-")
    submissions = storage.list_submissions()
    assert len(submissions) == 1
    assert submissions[0]["participantCode"] == "P01"
    assert submissions[0]["postQuestionnaire"]["susScore"] == 100

    exports = storage.write_exports()
    summary_path = Path(exports["summaryCsv"])
    answers_path = Path(exports["answersCsv"])
    questionnaire_wide_path = Path(exports["questionnaireWideCsv"])
    questionnaire_detail_path = Path(exports["questionnaireDetailCsv"])
    assert summary_path.exists()
    assert answers_path.exists()
    assert questionnaire_wide_path.exists()
    assert questionnaire_detail_path.exists()

    with summary_path.open(newline="", encoding="utf-8") as handle:
        summary_rows = list(csv.DictReader(handle))
    assert summary_rows[0]["sus_score"] == "100"
    assert summary_rows[0]["questionnaire_answer_count"] == "16"

    with answers_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["participant_code"] == "P01"
    assert rows[0]["question_id"] == "Q1"
    assert rows[0]["primary_source"] == "T"
    assert rows[-1]["stage_index"] == "2"
    assert rows[-1]["question_id"] == "Q6"

    with questionnaire_wide_path.open(newline="", encoding="utf-8") as handle:
        questionnaire_rows = list(csv.DictReader(handle))
    assert questionnaire_rows[0]["participant_code"] == "P01"
    assert questionnaire_rows[0]["sus_score"] == "100"
    assert questionnaire_rows[0]["SUS1"] == "5"
    assert questionnaire_rows[0]["SUS2"] == "1"
    assert questionnaire_rows[0]["CMP1"] == "4"
    assert questionnaire_rows[0]["WF_HELPFUL"] == "帮助我快速定位证据。"

    with questionnaire_detail_path.open(newline="", encoding="utf-8") as handle:
        questionnaire_detail_rows = list(csv.DictReader(handle))
    assert len(questionnaire_detail_rows) == 16
    assert questionnaire_detail_rows[0]["question_id"] == "SUS1"
    assert questionnaire_detail_rows[-1]["question_id"] == "WF_IMPROVE"
    assert questionnaire_detail_rows[-1]["answer"] == "希望图注更清晰。"


def test_save_submission_rejects_duplicate_client_supplied_experiment_id(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    first_payload = complete_submission_payload("P01")
    first_payload["experimentId"] = "exp-20260731-deadbeef"
    saved = storage.save_submission(first_payload)
    assert saved["participantCode"] == "P01"

    duplicate_payload = complete_submission_payload("P01")
    duplicate_payload["experimentId"] = "exp-20260731-deadbeef"
    duplicate_payload["startedAtMs"] = first_payload["startedAtMs"] + 99
    with pytest.raises(ValueError, match="already exists"):
        storage.save_submission(duplicate_payload)

    assert storage.list_submissions()[0]["startedAtMs"] == first_payload["startedAtMs"]

def test_save_submission_auto_scores_machine_gradable_answers_and_handles_q5_negation(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    storage.save_questions("M1", deterministic_questions_payload("M1"))
    storage.save_questions("M2", deterministic_questions_payload("M2"))

    payload = complete_submission_payload("P01")
    # P01 order: WikiCompare/M1, then GPT/M2. Q5 has opposite canonical
    # decisions across the two materials, so this catches the 不支持/支持
    # substring bug that made all M1 Q5 answers wrong.
    payload["stages"][0]["answers"][4]["answer"] = "不支持"
    payload["stages"][1]["answers"][4]["answer"] = "支持"

    saved = storage.save_submission(payload)

    assert saved["stages"][0]["answers"][4]["score"] == 1
    assert saved["stages"][0]["answers"][4]["correctness"] == "correct"
    assert saved["stages"][1]["answers"][4]["score"] == 1
    assert saved["stages"][1]["answers"][4]["correctness"] == "correct"
    assert saved["scoringUpdatedAt"]


def test_save_submission_marks_negated_positive_support_wrong(tmp_path):
    storage = ExperimentStorage(tmp_path)
    storage.ensure_defaults()
    storage.save_questions("M1", deterministic_questions_payload("M1"))
    storage.save_questions("M2", deterministic_questions_payload("M2"))

    payload = complete_submission_payload("P01")
    payload["stages"][0]["answers"][4]["answer"] = "不支持"
    payload["stages"][1]["answers"][4]["answer"] = "不支持"

    saved = storage.save_submission(payload)

    assert saved["stages"][0]["answers"][4]["score"] == 1
    assert saved["stages"][1]["answers"][4]["score"] == 0
    assert saved["stages"][1]["answers"][4]["correctness"] == "wrong"

