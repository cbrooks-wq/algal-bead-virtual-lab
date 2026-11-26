// Each concept item lists the correct option index and a hint for another attempt.
const conceptQuestions = {
  intensity: ["Which comparison isolates the effect of distance in the illuminated vials?",
    ["Same distance, different bulbs", "Different distances, same bulb and temperature", "Different distances and different temperatures"], 1,
    "Look for the setup that changes only distance."],
  spectrum: ["What should be equal across the illuminated treatments to isolate the effect of light color?",
    ["Photon flux arriving at each vial", "The color of every filter", "The final indicator pH"], 0,
    "A filter can change how much light arrives as well as its color."],
  temperature: ["What can you conclude if one bath has the greatest mean ΔpH?",
    ["That temperature is optimal for all algae", "Respiration stopped in that bath", "It had the greatest mean ΔpH among the temperatures tested"], 2,
    "Consider what the experiment measured and how many temperatures were tested."],
  surface: ["Why does the model hold bead volume and algae amount constant?",
    ["To eliminate all differences in diffusion", "To compare bead shape while holding the amount of algae constant", "To make both shapes have equal surface area"], 1,
    "Identify what changes when the bead is flattened."],
  exchange: ["What does an increase in indicator pH suggest in this model?",
    ["CO₂ release exceeded uptake", "Photosynthesis stopped", "CO₂ uptake exceeded release"], 2,
    "Use the relationship between dissolved CO₂ and acidity."],
  synthesis: ["What can pH data tell you about photosynthesis and respiration?",
    ["The direction of net CO₂ exchange", "The separate rates of both processes", "The exact amount of oxygen produced"], 0,
    "The indicator responds to the combined effect of both processes."],
  comparison: ["How should you compare evidence across the four investigations?",
    ["Rank all treatments together without using references", "Compare each treatment with its own lab reference before synthesizing", "Ignore trials that disagree with your prediction"], 1,
    "Each investigation varies a different factor."],
};

function gradeOption(id, question, options) {
  return '<label for="' + id + '">' + question + '</label><select id="' + id + '" data-grade><option value="">Choose an answer</option>' +
    options.map((option,index) => '<option value="' + index + '">' + option + '</option>').join("") + '</select>';
}
function gradingPanel(labKey) {
  const questions = labKey === "synthesis" ? ["synthesis","comparison"] : [labKey,"exchange"];
  return `<section class="panel"><h2>Check Your Score</h2>
    <p>${labKey === "synthesis" ? "Two concept questions · 4 points" :
    "Trial design · 4 points. Data interpretation · 4 points. Science concepts · 2 points."}
    You can revise and check again. The written CER score is an estimate based on answer patterns and recorded values. Clear wording helps the checker, and your teacher can review alternative explanations.</p>
    ${labKey === "synthesis" ? "" : gradeOption("g-high","Which tested treatment had the highest mean ΔpH?", labs[labKey].treatments.map(([name]) => name)) +
    '<label for="g-change">What was the mean ΔpH of the reference? Include a minus sign if the value is negative.</label><input id="g-change" data-grade type="number" step="0.01">'}
    ${questions.map((item,index) => gradeOption("g-concept"+index,...conceptQuestions[item].slice(0,2))).join("")}
    <div class="actions"><button id="grade">Check score</button></div>
    <p id="grade-status" role="status"></p><ul id="grade-feedback"></ul>
    <details><summary>CER rubric for student and teacher review</summary>
    <ul><li>Claim (2 points) · Answer the question with a specific conclusion.</li>
    <li>Evidence (4 points) · Use labeled numerical comparisons and units. Cite at least two comparisons in a lab report, or one from each investigation in the synthesis.</li>
    <li>Reasoning (4 points) · Connect the evidence to the tested factor and explain how the pH readings reflect net CO₂ exchange.</li></ul>
    <p>The written score is provisional. Other written fields receive revision hints.</p></details></section>`;
}
function gradeChecks(labKey, runs, answers) {
  const checks = [];
  function add(label, max, correct, hint) {
    checks.push({label, max, earned:correct ? max : 0, hint});
  }
  if (labKey !== "synthesis") {
    const definition = labs[labKey];
    const reference = definition.treatments.findIndex(([name]) => name === definition.reference);
    const counts = definition.treatments.map((_,index) => runs.filter(run => run.treatment === index).length);
    add("Reference trials",2,counts[reference] >= 3,"Run three trials for " + definition.reference + ".");
    add("Comparison trials",2,counts.some((count,index) => index !== reference && count >= 3),
      "Run three trials for at least one treatment besides the reference.");
    const rows = summaries(labKey,runs);
    const selected = definition.treatments[Number(answers["g-high"])]?.[0];
    const rounded = row => Number(row.change.toFixed(2));
    const maximum = Math.max(...rows.map(rounded));
    add("Highest mean ΔpH",2,rows.length >= 2 && Boolean(answers["g-high"]) &&
      rows.some(row => row.name === selected && rounded(row) === maximum),
      rows.length < 2 ? "Run at least two different treatments first." : "Compare the displayed mean ΔpH values in the graph legend.");
    const ref = rows.find(row => row.name === definition.reference);
    const response = answers["g-change"]?.trim();
    add("Reference mean ΔpH",2,Boolean(ref && response) && Math.abs(Number(response) - rounded(ref)) < .005,
      ref ? "Use the reference’s displayed mean ΔpH and check its sign." : "Run the reference treatment to get a mean ΔpH.");
  }
  const questions = labKey === "synthesis" ? ["synthesis","comparison"] : [labKey,"exchange"];
  questions.forEach((id,index) => {
    const [label,,correct,hint] = conceptQuestions[id];
    add(label,labKey === "synthesis" ? 2 : 1,answers["g-concept"+index] === String(correct),hint);
  });
  return checks;
}
function gradeSummary(checks) {
  const earned = checks.reduce((sum,item) => sum + item.earned,0);
  const possible = checks.reduce((sum,item) => sum + item.max,0);
  return "Automatic score: " + earned + "/" + possible;
}
function bindGrading(groups) {
  const answers = state.answers ??= {};
  const status = byId("grade-status");
  const feedback = byId("grade-feedback");
  function invalidate() {
    if (!status.textContent) return;
    status.textContent = "Work changed. Check the score again for updated feedback.";
    feedback.replaceChildren();
  }
  document.querySelectorAll("[data-grade]").forEach(field => {
    field.value = answers[field.id] ?? "";
    field.addEventListener("input", () => { answers[field.id] = field.value; save(); invalidate(); });
  });
  byId("grade").addEventListener("click", () => {
    const checks = gradeChecks(page,state.runs,answers);
    const written = writtenChecks(page,state.fields,state.runs,groups);
    status.textContent = gradeSummary(checks) + " · " + writtenSummary(written);
    feedback.replaceChildren(...[...checks,...written.map(item => ({...item,hint:item.tip}))].map(item => {
      const li = document.createElement("li");
      li.textContent = item.label + " · " + item.earned + "/" + item.max +
        (item.earned === item.max ? " · Correct." : " · " + item.hint);
      return li;
    }), ...writtenFeedback(page,state.fields).map(tip => {
      const li = document.createElement("li");
      li.textContent = tip;
      return li;
    }));
  });
  document.querySelectorAll("[data-field]").forEach(field => field.addEventListener("input",invalidate));
  return invalidate;
}
function writtenSummary(checks) {
  return "Provisional written CER: " + checks.reduce((sum,item)=>sum+item.earned,0) + "/10";
}
function gradeReport(groups) {
  const checks = gradeChecks(page,state.runs,state.answers ?? {});
  const written = writtenChecks(page,state.fields,state.runs,groups);
  return gradeSummary(checks) + "\n" + checks.map(item => item.label + " · " + item.earned + "/" + item.max).join("\n") +
    "\n\n" + writtenSummary(written) + "\n" +
    written.map(item=>item.label + " · " + item.earned + "/" + item.max + (item.earned===item.max ? "" : " · " + item.tip)).join("\n") +
    "\n" + writtenFeedback(page,state.fields).join("\n");
}
