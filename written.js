// These checks recognize common phrasing and numerical evidence. They are a
// formative guide. A browser rule cannot resolve every valid written argument.
const writtenBank = {
  intensity: {
    factor: /distance|near|far|intens|bright|light|lamp|foil|dark/i,
    mechanism: /photon|light (?:energy|availab|limit)|more light|less light|photoinhib|too much light|inverse.square/i
  },
  spectrum: {
    factor: /colou?r|spectr|wavelength|filter|red|blue|green|yellow|white/i,
    mechanism: /pigment|chlorophyll|absorb|wavelength.*(?:capture|use)|(?:capture|use).*wavelength/i
  },
  temperature: {
    factor: /temperatur|bath|cold|warm|hot|heat|°\s*c/i,
    mechanism: /enzym|kinetic|molecular motion|reaction rate|heat stress|denatur/i
  },
  surface: {
    factor: /surface|volume|shape|flat|disk|disc|sphere|round|intact/i,
    mechanism: /diffus|exposed area|exchange surface|shorter path|contact area/i
  }
};
const changeWords = /higher|lower|greater|less|more|faster|slower|increas|decreas|rose|fell|same|similar|differ|little|no (?:clear |consistent )?(?:effect|change|difference)|chang(?:ed|es|ing)|strongest|weakest|highest|lowest|largest|smallest/i;
const carbon = /co\s*[₂2]|carbon dioxide/i;
const photosynthesis = /photosynth|carbon fixation/i;
const respiration = /respir/i;
const ph = /\bpH\b|acidi|indicator/i;
const net = /\bnet\b|uptake|release|remov|consum|produc|balance|outpac|exceed/i;
const comparison = /compar|versus|\bvs\b|than|while|whereas|differ|both|similar/i;

function treatmentAlias(name) {
  if (name.includes("Foil")) return /foil|dark/i;
  if (name.includes("sphere")) return /intact|sphere|round/i;
  if (name.includes("disk")) return /flat|disk|disc/i;
  const lead = name.split(" (")[0].replace(" reference","");
  if (lead.endsWith(" light")) return /\bwhite\b/i;
  if (/^\d/.test(lead)) return new RegExp("\\b" + lead.split(" ")[0] + "\\s*" + (lead.includes("cm") ? "cm" : "(?:°\\s*)?c\\b"),"i");
  return new RegExp("\\b" + lead + "\\b","i");
}
function numbersIn(response) {
  return [...response.replace(/−/g,"-").matchAll(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g)].map(match => ({
    value:Number(match[0]), start:match.index, end:match.index + match[0].length
  })).filter(number => !/[a-z0-9]/i.test(response[number.start-1] ?? "") &&
    !/^\s*(?:cm\b|(?:°\s*)c\b|nm\b|min\b|mm\b)/i.test(response.slice(number.end)));
}
function evidenceMatches(labKey, runs, response) {
  // Splitting at sentence and list boundaries lets paired comparisons remain together.
  const clauses = response.split(/(?<=[.!?])\s+|[;\n]|\b(?:versus|vs\.?|whereas|while)\b/i);
  return summaries(labKey,runs).filter(row => {
    const matchingRuns = runs.filter(run => labs[labKey].treatments[run.treatment][0] === row.name);
    const values = [row.change,...row.points,...matchingRuns.flatMap(run => [...run.readings,delta(run.readings)])]
      .map(value => Number(value.toFixed(2)));
    const alias = treatmentAlias(row.name);
    return clauses.some(clause => {
      const match = clause.match(alias);
      if (!match) return false;
      const numbers = numbersIn(clause);
      const labels = labs[labKey].treatments.flatMap(([name]) => {
        const position = clause.search(treatmentAlias(name));
        return position === -1 ? [] : [position];
      });
      return numbers.some(number => {
        const distance = Math.abs(number.start - match.index);
        return labels.every(position => distance <= Math.abs(number.start-position)) &&
          values.some(value => Math.abs(number.value-value) < .006);
      });
    });
  });
}
function writtenChecks(labKey, fields, runs, groups = () => []) {
  const checks = [];
  const field = name => fields[name]?.trim() ?? "";
  function add(label, max, pass, tip) {
    checks.push({label,max,earned:pass ? max : 0,tip});
  }
  const claim = field("claim"), evidence = field("evidence"), reason = field("reasoning");
  const synthesis = labKey === "synthesis";
  const bank = synthesis ? null : writtenBank[labKey];
  const factors = Object.values(writtenBank);
  const factorCount = response => factors.filter(item => item.factor.test(response)).length;
  add("Claim states a result",1,changeWords.test(claim),"State what increased, decreased, or stayed similar.");
  add("Claim answers the question",1,synthesis ? factorCount(claim)>=2 : bank.factor.test(claim),
    synthesis ? "Name at least two investigated factors and state how they affected the results." : "Name the factor you tested and describe the result for the conditions you compared.");
  const matches = synthesis ? [] : evidenceMatches(labKey,runs,evidence);
  const synthesisCount = synthesis ? Object.entries(writtenBank).filter(([key,item]) => {
    const note = field("group-"+key);
    const section = evidence.split(/(?<=[.!?])\s+|[;\n]/).filter(clause => item.factor.test(clause)).join("; ");
    const rows = groups(key);
    return rows.some(group => evidenceMatches(key,group.runs,section).length >= 2) ||
      (numbersIn(note).length >= 2 && numbersIn(section).filter(n =>
        numbersIn(note).some(saved => Math.abs(saved.value-n.value)<.006)).length >= 2);
  }).length : 0;
  add("Evidence uses recorded values",2,synthesis ? synthesisCount>=4 : matches.length>=2,
    synthesis ? "Include two recorded values from each investigation. Keep each lab's conditions and values together in its own sentence or line." :
    "Use exact values from the table or graph. Put each treatment label and its pH or ΔpH value together.");
  add("Evidence compares results",1,comparison.test(evidence),
    "Use a comparison such as ‘higher than,’ ‘versus,’ or ‘similar to.’");
  add("Evidence identifies the measurement",1,ph.test(evidence) && numbersIn(evidence).length>=2,
    "Include at least two numbers and label them as pH or ΔpH.");
  add("Reasoning connects pH to CO₂",2,carbon.test(reason) && ph.test(reason) && net.test(reason),
    "Explain how CO₂ uptake or release changes acidity and why this affects pH.");
  add("Reasoning links evidence to a mechanism",2,photosynthesis.test(reason) && respiration.test(reason) &&
    (synthesis ? factors.filter(item=>item.mechanism.test(reason)).length>=2 : bank.mechanism.test(reason)),
    synthesis ? "Connect at least two factors to mechanisms and explain the balance of photosynthesis and respiration." :
    "Connect the tested factor to a mechanism and explain how photosynthesis and respiration together affect the reading.");
  return checks;
}
function writtenFeedback(labKey, fields) {
  const field = name => fields[name]?.trim() ?? "";
  const tips = [];
  if (labKey !== "synthesis") {
    const bank = writtenBank[labKey];
    if (!bank.factor.test(field("prediction")) || !changeWords.test(field("prediction")) || !/because|since|due to/i.test(field("prediction")))
      tips.push("Prediction · Name a treatment, predict the direction of change, and give a reason.");
    if (!bank.factor.test(field("variables")) || !ph.test(field("variables")) || !/control|constant|same|reference/i.test(field("variables")))
      tips.push("Design · Identify the changed factor, the pH measurement, the reference treatment, and two constants.");
    if (!/trial|repeat|replic/i.test(field("method")) || !/time|min|interval/i.test(field("method")))
      tips.push("Method · Describe which treatments you repeated and when you recorded pH.");
    if (!numbersIn(field("analysis")).length || !changeWords.test(field("analysis")))
      tips.push("Analysis · Describe the pattern and cite a specific reading or mean change.");
  }
  if (!/model|simulat|sample|measure|error|limitation|limit|variable|uncertain|trial/i.test(field("evaluation")) ||
      !/could|would|improv|more|repeat|test|extend|increase/i.test(field("evaluation")))
    tips.push("Evaluation · Name a specific limitation and explain how you would improve the investigation.");
  return tips;
}
