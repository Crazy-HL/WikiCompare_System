const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
	SUS_ITEMS,
	COMPARISON_ITEMS,
	OPEN_FEEDBACK_ITEMS,
	LIKERT_OPTIONS,
	calculateSusScore,
	validatePostExperimentQuestionnaire,
} = require("../src/experiment/postQuestionnaire.js");

assert.strictEqual(SUS_ITEMS.length, 10, "post questionnaire must use the 10-item SUS scale");
assert.deepStrictEqual(SUS_ITEMS.map(item => item.id), ["SUS1", "SUS2", "SUS3", "SUS4", "SUS5", "SUS6", "SUS7", "SUS8", "SUS9", "SUS10"]);
assert.deepStrictEqual(SUS_ITEMS.filter(item => item.reverse).map(item => item.id), ["SUS2", "SUS4", "SUS6", "SUS8", "SUS10"]);
assert.strictEqual(LIKERT_OPTIONS.length, 5, "SUS should use 5-point Likert options");
assert(COMPARISON_ITEMS.length >= 4, "post questionnaire should include WikiCompare-vs-GPT comparison items");
assert(OPEN_FEEDBACK_ITEMS.length >= 2, "post questionnaire should include open feedback items");

assert.strictEqual(calculateSusScore({
	SUS1: 5, SUS2: 1, SUS3: 5, SUS4: 1, SUS5: 5,
	SUS6: 1, SUS7: 5, SUS8: 1, SUS9: 5, SUS10: 1,
}), 100);
assert.strictEqual(calculateSusScore({
	SUS1: 1, SUS2: 5, SUS3: 1, SUS4: 5, SUS5: 1,
	SUS6: 5, SUS7: 1, SUS8: 5, SUS9: 1, SUS10: 5,
}), 0);
assert.strictEqual(calculateSusScore({
	SUS1: 3, SUS2: 3, SUS3: 3, SUS4: 3, SUS5: 3,
	SUS6: 3, SUS7: 3, SUS8: 3, SUS9: 3, SUS10: 3,
}), 50);

const validResponses = Object.fromEntries([
	...SUS_ITEMS.map(item => [item.id, 4]),
	...COMPARISON_ITEMS.map(item => [item.id, 4]),
	...OPEN_FEEDBACK_ITEMS.map(item => [item.id, "反馈"]),
]);
assert.strictEqual(validatePostExperimentQuestionnaire(validResponses), "");
assert.match(validatePostExperimentQuestionnaire({ ...validResponses, SUS1: "" }), /SUS1/);
assert.match(validatePostExperimentQuestionnaire({ ...validResponses, CMP1: 6 }), /CMP1/);
assert.match(validatePostExperimentQuestionnaire({ ...validResponses, WF_HELPFUL: "   " }), /WF_HELPFUL/);

const shellSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/ExperimentShell.vue"), "utf8");
assert(shellSource.includes("PostExperimentQuestionnaire"), "ExperimentShell should show the final post-experiment questionnaire before complete submission");
assert(shellSource.includes("screen === 'questionnaire'"), "ExperimentShell should enter a questionnaire screen after the second condition");
assert(shellSource.includes("handleQuestionnaireSubmit"), "ExperimentShell should submit completion only after questionnaire answers are present");

const adminSource = fs.readFileSync(path.join(__dirname, "../src/components/experiment/AdminSubmissions.vue"), "utf8");
assert(adminSource.includes("postQuestionnaire"), "AdminSubmissions should display post questionnaire responses");
assert(adminSource.includes("susScore"), "AdminSubmissions should display the SUS score");

console.log("experiment questionnaire tests passed");
