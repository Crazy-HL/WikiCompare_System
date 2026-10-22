import json
from unittest import mock
import os
import tempfile
from pathlib import Path

from tornado.testing import AsyncHTTPTestCase

import server
from experiment.assignment import assignment_for_code


def raw_questions_payload(material_id="M1"):
    return {
        "material_id": material_id,
        "questions": [
            {
                "question_id": f"Q{index}",
                "question_type": "test",
                "question_text": f"Question {index}",
                "answer_format": "free text",
                "understanding_target": "target",
                "gold_atoms": [
                    {
                        "atom_id": f"Q{index}-A1",
                        "requirement": "answer content must match",
                        "canonical_answer": f"Answer {index}",
                        "accepted_variants": [],
                        "source_ids": [f"S{index}"],
                        "required_unit": "as stated",
                        "required_time_scope": "as stated",
                    }
                ],
                "machine_gradable": True,
                "grading_rubric": "机器判分标准：答案内容必须匹配 canonical_answer 或 accepted_variants；仅证据编号正确但答案内容错误，必须判错。",
            }
            for index in range(1, 6)
        ],
    }


def issued_completion_payload(test_case, participant_code="P01"):
    start_response = test_case.post_json("/api/experiment/start", {"participantCode": participant_code})
    assert start_response.code == 200
    assignment = json.loads(start_response.body)
    payload = valid_completion_payload(participant_code, assignment["experimentId"])
    return assignment, payload


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

def valid_completion_payload(participant_code="P01", experiment_id=None):
    assignment = assignment_for_code(participant_code)
    payload = {
        "participantCode": assignment["participantCode"],
        "assignmentGroup": assignment["group"],
        "startedAt": "2026-07-31T00:00:00.000Z",
        "completedAt": "2026-07-31T00:20:00.000Z",
        "startedAtMs": 1000,
        "completedAtMs": 1201000,
        "totalDurationMs": 1200000,
        "postQuestionnaire": complete_questionnaire_payload(),
        "stages": [],
    }
    if experiment_id is not None:
        payload["experimentId"] = experiment_id
    for stage_index, stage in enumerate(assignment["stages"]):
        payload["stages"].append({
            **stage,
            "questionVersion": 1,
            "stageStartedAtMs": 1000 + stage_index * 600000,
            "stageSubmittedAtMs": 601000 + stage_index * 600000,
            "stageDurationMs": 600000,
            "answers": [
                {
                    "questionId": f"Q{answer_index}",
                    "questionText": f"Question {answer_index}" if answer_index < 6 else "Q6",
                    "answer": f"Answer {answer_index}",
                    "primarySource": "left",
                    "leftEvidence": "L-P001",
                    "rightEvidence": "R-P001",
                    "answerStartedAtMs": 1000 + answer_index,
                    "submittedAtMs": 2000 + answer_index,
                    "durationMs": 1000,
                }
                for answer_index in range(1, 7)
            ],
        })
    return payload


class ExperimentApiTest(AsyncHTTPTestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.previous_data_dir = os.environ.get("EXPERIMENT_DATA_DIR")
        self.previous_password = os.environ.get("EXPERIMENT_ADMIN_PASSWORD")
        self.previous_cors_origin = os.environ.get("EXPERIMENT_CORS_ORIGIN")
        os.environ["EXPERIMENT_DATA_DIR"] = self.tmpdir.name
        os.environ["EXPERIMENT_ADMIN_PASSWORD"] = "secret"
        os.environ.pop("EXPERIMENT_CORS_ORIGIN", None)
        super().setUp()

    def tearDown(self):
        super().tearDown()
        if self.previous_data_dir is None:
            os.environ.pop("EXPERIMENT_DATA_DIR", None)
        else:
            os.environ["EXPERIMENT_DATA_DIR"] = self.previous_data_dir
        if self.previous_password is None:
            os.environ.pop("EXPERIMENT_ADMIN_PASSWORD", None)
        else:
            os.environ["EXPERIMENT_ADMIN_PASSWORD"] = self.previous_password
        if self.previous_cors_origin is None:
            os.environ.pop("EXPERIMENT_CORS_ORIGIN", None)
        else:
            os.environ["EXPERIMENT_CORS_ORIGIN"] = self.previous_cors_origin
        self.tmpdir.cleanup()

    def get_app(self):
        return server.make_app()

    def post_json(self, url, payload, headers=None):
        return self.fetch(
            url,
            method="POST",
            headers={"Content-Type": "application/json", **(headers or {})},
            body=json.dumps(payload).encode("utf-8"),
        )

    def test_config_and_start_assignment(self):
        config_response = self.fetch("/api/experiment/config")
        assert config_response.code == 200
        config = json.loads(config_response.body)
        assert [item["id"] for item in config["materials"]] == ["M1", "M2"]
        assert "在阅读两篇文章" in config["q6Text"]

        start_response = self.post_json("/api/experiment/start", {"participantCode": "p2"})
        assert start_response.code == 200
        payload = json.loads(start_response.body)
        assert payload["participantCode"] == "P02"
        assert payload["assignmentGroup"] == "S2"
        assert payload["stages"][0]["condition"] == "chatgpt"
        assert payload["experimentId"].startswith("exp-")

    def test_complete_submission_and_admin_list(self):
        assignment, completion_payload = issued_completion_payload(self, "P01")
        complete_response = self.post_json("/api/experiment/complete", completion_payload)
        assert complete_response.code == 200
        saved = json.loads(complete_response.body)
        assert saved["experimentId"] == assignment["experimentId"]
        assert saved["postQuestionnaire"]["susScore"] == 100

        unauthorized = self.fetch("/api/admin/submissions")
        assert unauthorized.code == 401

        login = self.post_json("/api/admin/login", {"password": "secret"})
        assert login.code == 200
        token = json.loads(login.body)["token"]
        listing = self.fetch("/api/admin/submissions", headers={"X-Admin-Token": token})
        assert listing.code == 200
        records = json.loads(listing.body)["submissions"]
        assert records[0]["participantCode"] == "P01"


    def test_admin_can_update_submission_and_exports_refresh(self):
        assignment, completion_payload = issued_completion_payload(self, "P01")
        complete_response = self.post_json("/api/experiment/complete", completion_payload)
        assert complete_response.code == 200

        login = self.post_json("/api/admin/login", {"password": "secret"})
        assert login.code == 200
        token = json.loads(login.body)["token"]
        saved = json.loads(complete_response.body)
        saved["postQuestionnaire"]["susScore"] = 75
        saved["stages"][0]["answers"][0]["answer"] = "Corrected answer"
        saved["stages"][0]["answers"][0]["primarySource"] = "T"

        unauthorized = self.post_json(
            f"/api/admin/submissions/{assignment['experimentId']}",
            saved,
        )
        assert unauthorized.code == 401

        update_response = self.post_json(
            f"/api/admin/submissions/{assignment['experimentId']}",
            saved,
            headers={"X-Admin-Token": token},
        )
        assert update_response.code == 200
        updated = json.loads(update_response.body)["submission"]
        assert updated["experimentId"] == assignment["experimentId"]
        assert updated["postQuestionnaire"]["susScore"] == 75
        assert updated["stages"][0]["answers"][0]["answer"] == "Corrected answer"
        assert updated["stages"][0]["answers"][0]["primarySource"] == "T"

        listing = self.fetch("/api/admin/submissions", headers={"X-Admin-Token": token})
        records = json.loads(listing.body)["submissions"]
        assert records[0]["postQuestionnaire"]["susScore"] == 75

        answers_csv = self.fetch("/api/admin/export/answers.csv", headers={"X-Admin-Token": token})
        assert answers_csv.code == 200
        body = answers_csv.body.decode("utf-8")
        assert "Corrected answer" in body
        assert ",T," in body


    def test_participant_resubmission_replaces_only_their_previous_record(self):
        p1_first_assignment, p1_first_payload = issued_completion_payload(self, "P01")
        p1_first_payload["postQuestionnaire"]["susScore"] = 91
        p1_first_payload["stages"][0]["answers"][0]["answer"] = "P01 first answer"
        first_response = self.post_json("/api/experiment/complete", p1_first_payload)
        assert first_response.code == 200

        p2_assignment, p2_payload = issued_completion_payload(self, "P02")
        p2_payload["postQuestionnaire"]["susScore"] = 82
        p2_payload["stages"][0]["answers"][0]["answer"] = "P02 answer"
        second_response = self.post_json("/api/experiment/complete", p2_payload)
        assert second_response.code == 200

        p1_second_assignment, p1_second_payload = issued_completion_payload(self, "P01")
        p1_second_payload["postQuestionnaire"]["susScore"] = 73
        p1_second_payload["stages"][0]["answers"][0]["answer"] = "P01 latest answer"
        p1_second_payload["stages"][1]["answers"][0]["answer"] = "P01 latest stage 2 answer"
        third_response = self.post_json("/api/experiment/complete", p1_second_payload)
        assert third_response.code == 200

        login = self.post_json("/api/admin/login", {"password": "secret"})
        assert login.code == 200
        token = json.loads(login.body)["token"]

        listing = self.fetch("/api/admin/submissions", headers={"X-Admin-Token": token})
        assert listing.code == 200
        records = json.loads(listing.body)["submissions"]
        assert len(records) == 2
        by_code = {record["participantCode"]: record for record in records}
        assert set(by_code) == {"P01", "P02"}
        assert by_code["P01"]["experimentId"] == p1_second_assignment["experimentId"]
        assert by_code["P01"]["postQuestionnaire"]["susScore"] == 73
        assert by_code["P01"]["stages"][0]["answers"][0]["answer"] == "P01 latest answer"
        assert by_code["P02"]["experimentId"] == p2_assignment["experimentId"]
        assert by_code["P02"]["postQuestionnaire"]["susScore"] == 82
        assert by_code["P02"]["stages"][0]["answers"][0]["answer"] == "P02 answer"

        summary_csv = self.fetch("/api/admin/export/submissions.csv", headers={"X-Admin-Token": token})
        assert summary_csv.code == 200
        summary_body = summary_csv.body.decode("utf-8")
        assert summary_body.count("P01") == 1
        assert summary_body.count("P02") == 1
        assert "P01 latest answer" not in summary_body
        assert "P02 answer" not in summary_body

        answers_csv = self.fetch("/api/admin/export/answers.csv", headers={"X-Admin-Token": token})
        assert answers_csv.code == 200
        answers_body = answers_csv.body.decode("utf-8")
        assert "P01 latest answer" in answers_body
        assert "P02 answer" in answers_body
        assert "P01 first answer" not in answers_body

    def test_complete_submission_requires_started_experiment_id(self):
        no_id_response = self.post_json("/api/experiment/complete", valid_completion_payload("P01"))
        assert no_id_response.code == 400
        assert "experimentId" in json.loads(no_id_response.body)["error"]

        unknown_id_response = self.post_json(
            "/api/experiment/complete",
            valid_completion_payload("P01", "exp-20260731-deadbeef"),
        )
        assert unknown_id_response.code == 400
        assert "started" in json.loads(unknown_id_response.body)["error"]

    def test_complete_submission_rejects_zero_stages(self):
        response = self.post_json("/api/experiment/complete", {
            "participantCode": "P01",
            "assignmentGroup": "S1",
            "stages": [],
        })
        assert response.code == 400
        assert "two stages" in json.loads(response.body)["error"]

    def test_complete_submission_rejects_path_traversal_experiment_ids(self):
        for bad_id in ("../owned", "/tmp/owned", "exp.bad", "exp/owned", ""):
            response = self.post_json("/api/experiment/complete", valid_completion_payload("P01", bad_id))
            assert response.code == 400
            assert "experimentId" in json.loads(response.body)["error"]

    def test_complete_submission_rejects_fabricated_assignment_and_bad_answers(self):
        _assignment, fabricated = issued_completion_payload(self, "P01")
        fabricated["assignmentGroup"] = "S2"
        response = self.post_json("/api/experiment/complete", fabricated)
        assert response.code == 400
        assert "assignmentGroup" in json.loads(response.body)["error"]

        _assignment, wrong_stage = issued_completion_payload(self, "P01")
        wrong_stage["stages"][0]["condition"] = "chatgpt"
        response = self.post_json("/api/experiment/complete", wrong_stage)
        assert response.code == 400
        assert "stage 1" in json.loads(response.body)["error"]

        _assignment, missing_answer = issued_completion_payload(self, "P01")
        missing_answer["stages"][0]["answers"] = missing_answer["stages"][0]["answers"][:5]
        response = self.post_json("/api/experiment/complete", missing_answer)
        assert response.code == 400
        assert "Q1-Q6" in json.loads(response.body)["error"]

        _assignment, missing_questionnaire = issued_completion_payload(self, "P01")
        missing_questionnaire.pop("postQuestionnaire")
        response = self.post_json("/api/experiment/complete", missing_questionnaire)
        assert response.code == 400
        assert "postQuestionnaire" in json.loads(response.body)["error"]

    def test_admin_export_answers_csv(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        response = self.fetch("/api/admin/export/answers.csv", headers={"X-Admin-Token": token})
        assert response.code == 200
        assert response.headers["Content-Type"].startswith("text/csv")
        assert b"participant_code" in response.body

    def test_admin_export_questionnaire_csv_files(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        assignment, payload = issued_completion_payload(self, "P01")
        complete = self.post_json("/api/experiment/complete", payload)
        assert complete.code == 200

        wide = self.fetch("/api/admin/export/questionnaires.csv", headers={"X-Admin-Token": token})
        assert wide.code == 200
        assert wide.headers["Content-Type"].startswith("text/csv")
        assert b"sus_score" in wide.body
        assert b"SUS1" in wide.body
        assert b"WF_HELPFUL" in wide.body

        detail = self.fetch("/api/admin/export/questionnaire_answers.csv", headers={"X-Admin-Token": token})
        assert detail.code == 200
        assert detail.headers["Content-Type"].startswith("text/csv")
        assert b"question_type" in detail.body
        assert b"SUS1" in detail.body
        assert b"WF_IMPROVE" in detail.body

    def test_question_freeze_rejects_missing_machine_grading_rubric(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        payload = raw_questions_payload()
        payload["questions"][1]["grading_rubric"] = ""
        save_response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": payload},
            headers={"X-Admin-Token": token},
        )
        assert save_response.code == 200

        freeze_response = self.post_json(
            "/api/admin/questions/freeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert freeze_response.code == 400
        assert "grading_rubric" in json.loads(freeze_response.body)["error"]

    def test_questions_and_admin_freeze_unfreeze(self):
        questions_response = self.fetch("/api/experiment/questions?materialId=M1")
        assert questions_response.code == 400
        assert "frozen" in json.loads(questions_response.body)["error"]

        login = self.post_json("/api/admin/login", {"password": "secret"})
        assert login.code == 200
        token = json.loads(login.body)["token"]

        generated = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": raw_questions_payload("M1")},
            headers={"X-Admin-Token": token},
        )
        assert generated.code == 200

        freeze = self.post_json(
            "/api/admin/questions/freeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert freeze.code == 200
        assert json.loads(freeze.body)["frozen"] is True

        participant_questions = self.fetch("/api/experiment/questions?materialId=M1")
        assert participant_questions.code == 200
        assert "gold_atoms" not in participant_questions.body.decode("utf-8")

        unfreeze = self.post_json(
            "/api/admin/questions/unfreeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert unfreeze.code == 200
        assert json.loads(unfreeze.body)["frozen"] is False

    def test_admin_generate_questions_saves_next_version(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        raw_questions = raw_questions_payload("M1")

        response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": raw_questions},
            headers={"X-Admin-Token": token},
        )

        assert response.code == 200
        generated = json.loads(response.body)
        assert generated["material_id"] == "M1"
        assert generated["version"] == 1
        assert generated["frozen"] is False
        assert [item["question_id"] for item in generated["questions"]] == ["Q1", "Q2", "Q3", "Q4", "Q5"]

        freeze_response = self.post_json(
            "/api/admin/questions/freeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert freeze_response.code == 200

        questions_response = self.fetch("/api/experiment/questions?materialId=M1")
        assert questions_response.code == 200
        persisted = json.loads(questions_response.body)
        assert persisted["version"] == 1
        assert persisted["questions"][0]["question_text"] == "Question 1"

    def test_participant_questions_redact_generated_answer_keys(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        raw_questions = {
            "material_id": "M1",
            "questions": [
                {
                    "question_id": f"Q{index}",
                    "question_type": "单维事实比较",
                    "question_text": f"Question {index}",
                    "answer_format": "free text",
                    "understanding_target": "visible learning target",
                    "answer_options": ["A", "B"],
                    "gold_atoms": [
                        {
                            "atom_id": f"Q{index}-A1",
                            "requirement": "hidden scoring requirement",
                            "canonical_answer": "hidden canonical answer",
                            "accepted_variants": ["hidden accepted variant"],
                            "source_ids": ["L-P001", "R-P001"],
                            "source_evidence": "hidden evidence excerpt",
                        }
                    ],
                    "machine_gradable": True,
                    "grading_rubric": "机器判分标准：答案内容必须匹配 canonical_answer 或 accepted_variants；仅证据编号正确但答案内容错误，必须判错。",
                    "canonical_answer": "hidden top-level answer",
                    "accepted_variants": ["hidden top-level variant"],
                    "source_evidence": "hidden top-level evidence",
                }
                for index in range(1, 6)
            ],
        }

        generate_response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": raw_questions},
            headers={"X-Admin-Token": token},
        )
        assert generate_response.code == 200
        admin_payload = json.loads(generate_response.body)
        assert "gold_atoms" in admin_payload["questions"][0]

        freeze_response = self.post_json(
            "/api/admin/questions/freeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert freeze_response.code == 200

        questions_response = self.fetch("/api/experiment/questions?materialId=M1")
        assert questions_response.code == 200
        participant_payload = json.loads(questions_response.body)
        assert participant_payload["material_id"] == "M1"
        assert participant_payload["version"] == 1
        first_question = participant_payload["questions"][0]
        assert first_question == {
            "question_id": "Q1",
            "question_type": "单维事实比较",
            "question_text": "Question 1",
            "answer_format": "free text",
            "understanding_target": "visible learning target",
            "answer_options": ["A", "B"],
        }

        forbidden_keys = {
            "gold_atoms",
            "canonical_answer",
            "accepted_variants",
            "source_ids",
            "source_evidence",
            "sourceEvidence",
        }

        def assert_no_forbidden_keys(value):
            if isinstance(value, dict):
                assert forbidden_keys.isdisjoint(value.keys())
                for child in value.values():
                    assert_no_forbidden_keys(child)
            elif isinstance(value, list):
                for child in value:
                    assert_no_forbidden_keys(child)

        assert "generated_at" not in participant_payload
        assert "prompt_version" not in participant_payload
        assert_no_forbidden_keys(participant_payload)


    def test_admin_generate_questions_without_raw_questions_uses_backend_generator(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        calls = []

        def fake_generate_questions(material, version):
            calls.append((material["id"], version))
            return {
                "material_id": material["id"],
                "version": version,
                "frozen": False,
                "generated_at": "2026-07-31T00:00:00Z",
                "prompt_version": "test-prompt",
                "questions": [
                    {
                        "question_id": f"Q{index}",
                        "question_type": "单维事实比较",
                        "question_text": f"Generated question {index}",
                        "answer_format": "free text",
                        "understanding_target": "visible learning target",
                        "answer_options": [],
                        "gold_atoms": [
                            {
                                "atom_id": f"Q{index}-A1",
                                "requirement": "hidden scoring requirement",
                                "canonical_answer": "hidden canonical answer",
                                "accepted_variants": [],
                                "source_ids": ["L-P001", "R-P001"],
                            }
                        ],
                    }
                    for index in range(1, 6)
                ],
            }

        with mock.patch("experiment.handlers.generate_questions_from_material", fake_generate_questions):
            response = self.post_json(
                "/api/admin/questions/generate",
                {"materialId": "M1"},
                headers={"X-Admin-Token": token},
            )

        assert response.code == 200
        payload = json.loads(response.body)
        assert calls == [("M1", 1)]
        assert payload["questions"][0]["question_text"] == "Generated question 1"
        assert payload["frozen"] is False


    def test_admin_questions_keep_generation_prompts_while_participant_payload_redacts_them(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        raw_questions = raw_questions_payload("M1")
        raw_questions["generation_prompts"] = {
            "question_prompt": {"system": "question system", "user": "question user"},
            "answer_prompt": {"system": "answer system", "user": "answer user", "note": "same request"},
        }

        generate_response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": raw_questions},
            headers={"X-Admin-Token": token},
        )

        assert generate_response.code == 200
        admin_payload = json.loads(generate_response.body)
        assert admin_payload["generation_prompts"]["question_prompt"]["system"] == "question system"
        assert admin_payload["generation_prompts"]["answer_prompt"]["user"] == "answer user"

        admin_get = self.fetch("/api/admin/questions?materialId=M1", headers={"X-Admin-Token": token})
        assert admin_get.code == 200
        assert json.loads(admin_get.body)["generation_prompts"]["question_prompt"]["user"] == "question user"

        freeze_response = self.post_json(
            "/api/admin/questions/freeze",
            {"materialId": "M1"},
            headers={"X-Admin-Token": token},
        )
        assert freeze_response.code == 200

        participant_response = self.fetch("/api/experiment/questions?materialId=M1")
        assert participant_response.code == 200
        participant_payload = json.loads(participant_response.body)
        assert "generation_prompts" not in participant_payload
        assert "question system" not in participant_response.body.decode("utf-8")

    def test_admin_generate_questions_rejects_invalid_raw_questions_as_json_error(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]

        response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": "not valid json"},
            headers={"X-Admin-Token": token},
        )

        assert response.code == 400
        payload = json.loads(response.body)
        assert "rawQuestions" in payload["error"]

    def test_admin_generate_questions_rejects_malformed_question_shapes_as_json_error(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]

        for raw_questions in ({"questions": "abc"}, {"questions": [None]}):
            response = self.post_json(
                "/api/admin/questions/generate",
                {"materialId": "M1", "rawQuestions": raw_questions},
                headers={"X-Admin-Token": token},
            )

            assert response.code == 400
            payload = json.loads(response.body)
            assert "rawQuestions" in payload["error"]

    def test_admin_generate_questions_requires_authentication(self):
        response = self.post_json(
            "/api/admin/questions/generate",
            {"materialId": "M1", "rawQuestions": {"questions": []}},
        )

        assert response.code == 401
        assert json.loads(response.body)["error"] == "Admin authentication required"

    def test_admin_generate_questions_rejects_when_questions_are_frozen(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        assert self.post_json("/api/admin/questions/generate", {"materialId": "M1", "rawQuestions": raw_questions_payload("M1")}, headers={"X-Admin-Token": token}).code == 200
        assert self.post_json("/api/admin/questions/freeze", {"materialId": "M1"}, headers={"X-Admin-Token": token}).code == 200

        response = self.post_json("/api/admin/questions/generate", {"materialId": "M1", "rawQuestions": raw_questions_payload("M1")}, headers={"X-Admin-Token": token})
        assert response.code == 400
        assert "frozen" in json.loads(response.body)["error"]

    def test_admin_login_loads_password_from_env_file_when_process_env_missing(self):
        os.environ.pop("EXPERIMENT_ADMIN_PASSWORD", None)
        env_file = Path(self.tmpdir.name) / ".env"
        env_file.write_text('EXPERIMENT_ADMIN_PASSWORD="from-file"\n', encoding="utf-8")

        with mock.patch("services.config.DEFAULT_ENV_FILES", (env_file,)):
            response = self.post_json("/api/admin/login", {"password": "from-file"})

        assert response.code == 200
        assert "token" in json.loads(response.body)

    def test_admin_login_requires_configured_password(self):
        os.environ.pop("EXPERIMENT_ADMIN_PASSWORD", None)
        with mock.patch("services.config.DEFAULT_ENV_FILES", tuple()):
            response = self.post_json("/api/admin/login", {"password": "admin"})
        assert response.code == 503
        assert "EXPERIMENT_ADMIN_PASSWORD" in json.loads(response.body)["error"]

    def test_experiment_cors_allows_local_dev_origin_without_wildcard(self):
        local_response = self.fetch("/api/experiment/config", headers={"Origin": "http://127.0.0.1:8080"})
        assert local_response.code == 200
        assert local_response.headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:8080"

        response = self.fetch("/api/experiment/config", headers={"Origin": "https://example.test"})
        assert response.code == 200
        assert response.headers.get("Access-Control-Allow-Origin") is None

        os.environ["EXPERIMENT_CORS_ORIGIN"] = "https://admin.example"
        try:
            response = self.fetch("/api/experiment/config", headers={"Origin": "https://admin.example"})
            assert response.headers.get("Access-Control-Allow-Origin") == "https://admin.example"
        finally:
            os.environ.pop("EXPERIMENT_CORS_ORIGIN", None)

    def test_admin_generate_static_table_saves_chatgpt_rows_for_review_and_freeze(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        generated_rows = [
            {"id": "R1", "label": "GDP", "left": {"value": "1"}, "right": {"value": "2"}},
            {"id": "R2", "label": "Population", "left": {"value": "3"}, "right": {"value": "4"}},
        ]

        with mock.patch("experiment.handlers.generate_static_table_from_material", return_value={"rows": generated_rows}):
            generated = self.post_json(
                "/api/admin/static-table/generate",
                {"materialId": "M1"},
                headers={"X-Admin-Token": token},
            )

        assert generated.code == 200
        generated_payload = json.loads(generated.body)
        assert generated_payload["rows"] == generated_rows
        assert generated_payload["frozen"] is False
        assert generated_payload["version"] == 1

        admin_get = self.fetch("/api/admin/static-table?materialId=M1", headers={"X-Admin-Token": token})
        assert admin_get.code == 200
        assert json.loads(admin_get.body)["rows"] == generated_rows

        public_before_freeze = self.fetch("/api/experiment/static-table?materialId=M1")
        assert public_before_freeze.code == 400

        frozen = self.post_json("/api/admin/static-table/freeze", {"materialId": "M1"}, headers={"X-Admin-Token": token})
        assert frozen.code == 200

        public_after_freeze = self.fetch("/api/experiment/static-table?materialId=M1")
        assert public_after_freeze.code == 200
        assert json.loads(public_after_freeze.body)["rows"] == generated_rows

    def test_admin_static_table_keeps_generation_prompt_while_participant_payload_redacts_it(self):
        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        generated_rows = [
            {"id": "R1", "label": "GDP", "left": {"value": "1"}, "right": {"value": "2"}},
        ]
        prompts = {
            "static_table_prompt": {
                "system": "static table system",
                "user": "static table user",
            }
        }

        with mock.patch(
            "experiment.handlers.generate_static_table_from_material",
            return_value={
                "rows": generated_rows,
                "markdown_table": "| Left | 可比属性 | Right |\n| --- | --- | --- |\n| 1 | GDP | 2 |",
                "generation_prompts": prompts,
            },
        ):
            generated = self.post_json(
                "/api/admin/static-table/generate",
                {"materialId": "M1"},
                headers={"X-Admin-Token": token},
            )

        assert generated.code == 200
        generated_payload = json.loads(generated.body)
        assert generated_payload["generation_prompts"]["static_table_prompt"]["system"] == "static table system"
        assert generated_payload["markdown_table"].startswith("| Left | 可比属性 | Right |")

        admin_get = self.fetch("/api/admin/static-table?materialId=M1", headers={"X-Admin-Token": token})
        assert admin_get.code == 200
        admin_payload = json.loads(admin_get.body)
        assert admin_payload["generation_prompts"]["static_table_prompt"]["user"] == "static table user"
        assert admin_payload["markdown_table"].startswith("| Left | 可比属性 | Right |")

        frozen = self.post_json("/api/admin/static-table/freeze", {"materialId": "M1"}, headers={"X-Admin-Token": token})
        assert frozen.code == 200

        participant = self.fetch("/api/experiment/static-table?materialId=M1")
        assert participant.code == 200
        participant_payload = json.loads(participant.body)
        assert "generation_prompts" not in participant_payload
        assert "markdown_table" not in participant_payload
        assert "static table user" not in participant.body.decode("utf-8")

    def test_static_tables_admin_and_participant_freeze_flow(self):
        unfrozen_public = self.fetch("/api/experiment/static-table?materialId=M1")
        assert unfrozen_public.code == 400

        login = self.post_json("/api/admin/login", {"password": "secret"})
        token = json.loads(login.body)["token"]
        rows = [{"id": "r1", "label": "GDP", "left": {"value": "1"}, "right": {"value": "2"}}]

        saved = self.post_json("/api/admin/static-table", {"materialId": "M1", "rows": rows}, headers={"X-Admin-Token": token})
        assert saved.code == 200
        assert json.loads(saved.body)["rows"] == rows

        still_unfrozen_public = self.fetch("/api/experiment/static-table?materialId=M1")
        assert still_unfrozen_public.code == 400

        frozen = self.post_json("/api/admin/static-table/freeze", {"materialId": "M1"}, headers={"X-Admin-Token": token})
        assert frozen.code == 200
        assert json.loads(frozen.body)["frozen"] is True

        public = self.fetch("/api/experiment/static-table?materialId=M1")
        assert public.code == 200
        payload = json.loads(public.body)
        assert payload == {"material_id": "M1", "version": 1, "rows": rows}

        rejected_save = self.post_json("/api/admin/static-table", {"materialId": "M1", "rows": rows}, headers={"X-Admin-Token": token})
        assert rejected_save.code == 400
        assert "frozen" in json.loads(rejected_save.body)["error"]

        unfrozen = self.post_json("/api/admin/static-table/unfreeze", {"materialId": "M1"}, headers={"X-Admin-Token": token})
        assert unfrozen.code == 200
        assert json.loads(unfrozen.body)["frozen"] is False
