const page = document.body.dataset.page;
const main = document.querySelector("main");
const prefix = "algal-bead-lab:v1:";
const key = prefix + page;
const byId = id => document.getElementById(id);
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const delta = readings => readings.at(-1) - readings[0];
const signed = number => (number > 0 ? "+" : "") + number.toFixed(2);

function readLocal(storageKey, fallback) {
  try { return JSON.parse(localStorage.getItem(storageKey)) ?? fallback; }
  catch { return fallback; }
}
function writeLocal(storageKey, value) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); return true; }
  catch { return false; }
}
function save() {
  byId("saved").textContent = writeLocal(key, state)
    ? "Saved in this browser." : "Browser saving is unavailable. Download your report before closing.";
}
const projector = byId("projector");
function showProjector(enabled) {
  document.body.classList.toggle("projector", enabled);
  projector.setAttribute("aria-pressed", enabled);
}
showProjector(readLocal(prefix + "projector", false));
projector.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("projector");
  showProjector(enabled);
  writeLocal(prefix + "projector", enabled);
});

const lab = labs[page];
const fresh = () => ({runs:[], fields:{}, imported:[], treatment:0});
let state = readLocal(key, fresh());

function textFields(fields) {
  return fields.map(([id, label]) =>
    '<div><label for="' + id + '">' + label + '</label><textarea id="' + id + '" data-field maxlength="4000"></textarea></div>'
  ).join("");
}
function bindFields() {
  document.querySelectorAll("[data-field]").forEach(field => {
    field.value = state.fields[field.id] ?? "";
    field.addEventListener("input", () => { state.fields[field.id] = field.value; save(); });
  });
  byId("clear").addEventListener("click", () => {
    if (window.confirm("Clear saved work for this page?")) {
      state = fresh();
      save();
      location.reload();
    }
  });
  save();
}
function reportControls() {
  return '<div class="actions"><button id="report">Download report</button><button class="secondary" id="clear">Clear my work on this page</button></div><p class="muted" id="saved"></p>';
}
function download(filename, content, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], {type:mime}));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fieldReport(fields) {
  return fields.map(([id, label]) => label + "\n" + (state.fields[id]?.trim() || "[Incomplete]")).join("\n\n");
}
const cer = [
  ["claim","Claim · Answer the investigation question."],
  ["evidence","Evidence · Cite at least two numerical comparisons with units and treatment labels."],
  ["reasoning","Reasoning · Connect the evidence to CO₂, indicator pH, and the factor you tested."],
  ["evaluation","Evaluation · Explain a limitation and propose an improvement."]
];

function renderLab() {
  const planning = [
    ["prediction","Prediction · What outcome do you expect and why?"],
    ["variables","Design · Name the independent and dependent variables, reference, and two constants."],
    ["method","Method · Summarize your procedure and explain how you kept the comparison fair."]
  ];
  const analysis = [["analysis", lab.prompt]];
  const optional = page === "surface" ? '<p id="geometry"></p>' : "";
  main.innerHTML = `
    <section class="hero"><p class="eyebrow">Investigation · about 35 minutes</p><h1>${lab.title}</h1><p>${lab.question}</p></section>
    <section class="panel"><h2>Predict and Plan</h2>
    <p>Living algae respire in light and dark. In light, they can also photosynthesize. Dissolved CO₂ affects acidity. A rising pH suggests net CO₂ uptake, and a falling pH suggests net CO₂ release.</p>
    <div class="prompts">${textFields(planning)}</div></section>
    <section class="panel"><h2>Run the Simulation</h2><p>${lab.intro}</p>
    <div class="bench"><div><label for="treatment">${lab.variable}</label><select id="treatment">${lab.treatments.map(([name], index) => '<option value="' + index + '">' + name + '</option>').join("")}</select>
    <p><strong>Reference:</strong> ${lab.reference}<br><strong>Held constant:</strong> ${lab.fixed}</p>
    ${optional}<p>Run at least three trials per treatment you compare. Include the reference and as many contrasting conditions as your evidence needs.</p>
    <button id="run">Run trial</button><p role="status" class="status" id="reading"></p>
    <small>Indicator key: yellow = higher CO₂, orange = near baseline, purple = lower CO₂. Read the number and label alongside the color.</small></div>
    <figure><div class="apparatus" id="apparatus"></div><figcaption id="setup"></figcaption></figure></div></section>
    <section class="panel"><h2>Analyze the Data</h2><p>Time is accelerated. Values are simulated. ΔpH is final pH minus initial pH and gives an indirect comparison of net CO₂ exchange over the same time interval.</p>
    <figure id="graph"></figure><div class="scroll" tabindex="0" aria-label="Scrollable trial data" id="table"></div>
    ${textFields(analysis)}<div class="actions"><button class="secondary" id="share" disabled>Download anonymous evidence</button></div></section>
    ${gradingPanel(page)}
    <section class="panel"><h2>Write Your Lab Report</h2><div class="prompts">${textFields(cer)}</div>${reportControls()}</section>`;
  const invalidateGrade = bindGrading();
  const select = byId("treatment");
  select.value = state.treatment;
  function preview() {
    const index = Number(select.value);
    apparatus(index, 8);
    byId("reading").textContent = "Ready to measure " + lab.treatments[index][0] + ".";
  }
  select.addEventListener("change", () => { state.treatment = Number(select.value); save(); preview(); });
  preview();
  results();
  bindFields();

  byId("run").addEventListener("click", () => {
    const index = Number(select.value);
    const repeat = state.runs.filter(run => run.treatment === index).length + 1;
    const readings = simulate(page, index, repeat);
    const button = byId("run");
    button.disabled = select.disabled = byId("clear").disabled = true;
    let step = 0;
    function measure() {
      const pH = readings[step];
      apparatus(index, pH);
      byId("reading").textContent = "Trial " + repeat + " · " + sampleTimes[step] + " min · pH " + pH.toFixed(2) + " · " + indicator(pH).label;
      step++;
      if (step < readings.length) { setTimeout(measure,550); return; }
      state.runs.push({treatment:index,readings});
      save();
      results();
      invalidateGrade();
      button.disabled = select.disabled = byId("clear").disabled = false;
      byId("reading").textContent += " · Trial recorded.";
    }
    measure();
  });
  byId("share").addEventListener("click", () => {
    if (state.runs.length) download(page + "-evidence.json", JSON.stringify({format:"algal-evidence-v1", lab:page, runs:state.runs}, null, 2), "application/json");
  });
  byId("report").addEventListener("click", () => {
    const table = state.runs.map(run => [
      lab.treatments[run.treatment][0], ...run.readings.map(n => n.toFixed(2)), signed(delta(run.readings))
    ].join(" | ")).join("\n");
    download(page + "-lab-report.txt", [
      "Algal Bead Virtual Lab · " + lab.title, lab.question,
      fieldReport(planning), "Simulated trial readings\nTreatment | " + sampleTimes.join(" min pH | ") + " min pH | ΔpH\n" + (table || "[No trials]"),
      "Mean ΔpH by treatment\n" + (summaries(page, state.runs).map(row => row.name + ": " + signed(row.change) + " pH units (n=" + row.count + ")").join("\n") || "[No trials]"),
      fieldReport([...analysis,...cer]), gradeReport()
    ].join("\n\n"));
  });
}

function indicator(pH) {
  if (pH < 7.88) return {color:"#e9c744",label:"Yellow · higher CO₂"};
  if (pH > 8.12) return {color:"#935bac",label:"Purple · lower CO₂"};
  return {color:"#d77938",label:"Orange · near starting CO₂"};
}
function apparatus(index, pH) {
  const label = lab.treatments[index][0];
  const x = page === "intensity" ? [230,190,230,285,335][index] : 275;
  const dark = page === "intensity" && index === 0;
  const colors = ["#fff1a3","#f27972","#7e9efa","#e7cd43","#8bbd6f"];
  const light = page === "spectrum" ? colors[index] : colors[0];
  const beams = dark ? "" : '<path d="M75 55 L' + x + ' 38 L' + x + ' 151 Z" fill="' + light + '" opacity=".68"/>';
  const filter = page === "spectrum" && index > 0 ? '<rect x="160" y="47" width="13" height="107" rx="4" fill="' + light + '" stroke="#486050"/><text x="146" y="174">Filter</text>' : "";
  const bath = page === "temperature" ? '<rect x="218" y="87" width="113" height="83" rx="8" fill="#96cdd9"/><text x="220" y="193">Water bath</text>' : "";
  const beads = [x-12,x,x+12].map((center,i) => '<ellipse cx="' + center + '" cy="' + (134-i%2*8) + '" rx="' + (page==="surface" && index===1?8:5) + '" ry="' + (page==="surface" && index===1?2:5) + '" fill="#294f33"/>').join("");
  byId("apparatus").innerHTML = `<svg viewBox="0 0 400 205" aria-hidden="true"><rect x="10" y="148" width="380" height="8" rx="4" fill="#607e69"/>
    ${beams}${filter}${bath}<path d="M35 145 V55 H60" fill="none" stroke="#21463b" stroke-width="8"/><path d="M54 41 H79 L88 69 H54 Z" fill="#21463b"/>
    <rect x="${x-24}" y="48" width="48" height="101" rx="9" fill="#f9fff7" stroke="#315448" stroke-width="3"/>
    <rect x="${x-20}" y="94" width="40" height="51" rx="5" fill="${indicator(pH).color}"/>${beads}
    ${dark ? '<rect x="'+(x-25)+'" y="48" width="50" height="100" rx="6" fill="#52616a"/><text x="'+(x-13)+'" y="100" fill="white">Foil</text>' : ""}
    <rect x="${x-26}" y="40" width="52" height="11" rx="3" fill="#315448"/>
    <text x="16" y="174" fill="#173d32">Lamp</text></svg>`;
  let extra = "";
  if (page === "intensity" && !dark) {
    const distance = Number.parseInt(label,10);
    extra = " · Approx. relative light intensity " + (100 * (20/distance)**2).toFixed(0) + "% (20 cm = 100%).";
  }
  if (page === "surface") {
    const g = geometry();
    byId("geometry").textContent = "Sphere diameter 4 mm; disk diameter 6 mm and thickness " + g.height.toFixed(2) +
      " mm. SA:V is " + g.sphere.toFixed(2) + " mm⁻¹ (sphere) and " + g.disk.toFixed(2) + " mm⁻¹ (disk, including rim).";
  }
  byId("setup").textContent = label + extra + (dark ? " · Indicator read after removing foil." : "");
}
function summaries(labKey, runs) {
  return labs[labKey].treatments.flatMap(([name], index) => {
    const matches = runs.filter(run => run.treatment === index);
    if (!matches.length) return [];
    return [{name, count:matches.length, change:mean(matches.map(run => delta(run.readings))),
      points:sampleTimes.map((_,t) => mean(matches.map(run => run.readings[t])))}];
  });
}
function results() {
  byId("share").disabled = state.runs.length === 0;
  if (!state.runs.length) {
    byId("graph").textContent = "Run a trial to build the graph and data table.";
    byId("table").innerHTML = "";
    return;
  }
  const rows = summaries(page, state.runs);
  const colors = ["#145546","#914500","#6b367f","#1d608b","#935113"];
  const dashes = ["","8 4","3 4","12 3 3 3","2 3 8 3"];
  const x = minutes => 55 + minutes * 4.1;
  const y = ph => 162 - (ph - 6.9) * 62;
  const axes = [7,7.5,8,8.5,9].map(ph => `<path d="M55 ${y(ph)}H383" stroke="#a4b4a3"/><text x="29" y="${y(ph)+4}">${ph}</text>`).join("");
  const ticks = sampleTimes.map(t => `<text x="${x(t)}" y="182" text-anchor="middle">${t}</text>`).join("");
  const lines = rows.map((row,i) => `<polyline points="${row.points.map((value,k) => x(sampleTimes[k])+","+y(value)).join(" ")}" fill="none" stroke="${colors[i]}" stroke-width="2.5" stroke-dasharray="${dashes[i]}"/>`).join("");
  byId("graph").innerHTML = `<svg viewBox="0 0 405 210" role="img" aria-label="Mean indicator pH over time. Exact trial readings are listed in the table."><g font-family="system-ui" font-size="11" fill="#18392f">${axes}${ticks}${lines}<text x="8" y="22">pH</text><text x="190" y="201">Simulated time (min)</text></g></svg>
    <figcaption>Mean pH over time by treatment. Legend and mean change:</figcaption><ul>${rows.map((row,i) =>
    '<li><span style="color:'+colors[i]+';font-weight:750">' + ["Solid","Dashed","Dotted","Dash-dot","Mixed"][i] + '</span> · ' + row.name + ' · Mean ΔpH ' + signed(row.change) + ' (n=' + row.count + ')</li>').join("")}</ul>`;
  byId("table").innerHTML = '<table><caption>Individual simulated trials</caption><thead><tr><th scope="col">Trial</th><th scope="col">Treatment</th>' +
    sampleTimes.map(t => '<th scope="col">'+t+' min pH</th>').join("") + '<th scope="col">ΔpH</th></tr></thead><tbody>' +
    state.runs.map((run,i) => '<tr><th scope="row">'+(i+1)+'</th><td>'+lab.treatments[run.treatment][0]+'</td>'+
      run.readings.map(n => '<td>'+n.toFixed(2)+'</td>').join("")+'<td>'+signed(delta(run.readings))+'</td></tr>').join("")+'</tbody></table>';
}

function validateEvidence(data) {
  if (!data || data.format !== "algal-evidence-v1" || !Object.hasOwn(labs,data.lab)
      || !Array.isArray(data.runs) || !data.runs.length || data.runs.length > 300) return null;
  const valid = data.runs.every(run => run && Number.isInteger(run.treatment)
    && run.treatment >= 0 && run.treatment < labs[data.lab].treatments.length
    && Array.isArray(run.readings) && run.readings.length === sampleTimes.length
    && run.readings.every(value => Number.isFinite(value) && value >= 0 && value <= 14));
  if (!valid) return null;
  // Retain only experimental values, even if an imported file has extra fields.
  return {lab:data.lab,runs:data.runs.map(({treatment,readings}) => ({treatment,readings}))};
}
function renderSynthesis() {
  const fields = [
    ...Object.keys(labs).map(id => ["group-" + id, labs[id].title + " · Record one numerical comparison from the group share-out."]),
    ["claim","Claim · What do the four investigations show about factors that influence net CO₂ exchange?"],
    ["evidence","Evidence · Use a numerical comparison from each investigation. Include treatment labels and units."],
    ["reasoning","Reasoning · Explain how the factors influence net CO₂ exchange and how pH gives indirect evidence."],
    ["evaluation","Evaluation · Identify one limitation of comparing these simulations and propose a follow-up test."]
  ];
  main.innerHTML = `<section class="hero"><p class="eyebrow">Group share-out</p><h1>Class Synthesis</h1>
    <p>Compare results across the four investigations. Use each reference within its own lab before drawing a broader conclusion.</p></section>
    <section class="panel"><h2>Gather Evidence</h2><p>Import one or more anonymous evidence files. You can also use the fields below to record numbers from group reports. Include the treatment and reference, mean ΔpH, and trial count if available.</p>
    <label for="import">Import group evidence files</label><input id="import" type="file" accept=".json,application/json" multiple>
    <p role="status" id="import-status"></p><div id="pool"></div><div class="prompts">${textFields(fields.slice(0,4))}</div></section>
    ${gradingPanel(page)}
    <section class="panel"><h2>Write Your Class CER</h2><div class="prompts">${textFields(fields.slice(4))}</div>${reportControls()}</section>`;
  function poolRows(labKey) {
    const local = readLocal(prefix + labKey, fresh()).runs;
    return [...(local.length ? [{ runs:local, name:"This browser" }] : []),
      ...state.imported.filter(packet => packet.lab === labKey).map((packet,index) => ({runs:packet.runs,name:"Imported group "+(index+1)}))];
  }
  function showPool() {
    byId("pool").innerHTML = Object.entries(labs).map(([labKey, definition]) => {
      const groups = poolRows(labKey);
      return '<h3>'+definition.title+'</h3>' + (groups.length ? groups.map(group =>
        '<p><strong>' + group.name + '</strong> · ' + summaries(labKey,group.runs).map(row =>
        row.name + ': ' + signed(row.change) + ' pH units (n=' + row.count + ')').join(' · ') + '</p>').join("") :
        '<p class="muted">No data here yet. Import a file or enter share-out evidence below.</p>');
    }).join("");
  }
  showPool();
  bindFields();
  const invalidateGrade = bindGrading(poolRows);
  byId("import").addEventListener("change", async event => {
    const files = [...event.target.files];
    event.target.disabled = byId("clear").disabled = true;
    let added = 0;
    let skipped = 0;
    for (const file of files) {
      try {
        const packet = file.size < 100000 ? validateEvidence(JSON.parse(await file.text())) : null;
        if (!packet) { skipped++; continue; }
        state.imported.push(packet);
        added++;
      } catch { skipped++; }
    }
    save();
    showPool();
    invalidateGrade();
    byId("import-status").textContent = added + " file(s) imported. " + skipped + " file(s) could not be read as lab evidence.";
    event.target.value = "";
    event.target.disabled = byId("clear").disabled = false;
  });
  byId("report").addEventListener("click", () => {
    const groupResults = Object.keys(labs).map(labKey => labs[labKey].title + "\n" +
      (poolRows(labKey).map(group => group.name + ": " + summaries(labKey, group.runs).map(row =>
      row.name + " = " + signed(row.change) + " pH units (n=" + row.count + ")").join(" | ")).join("\n") || "[No file data]")).join("\n\n");
    download("class-synthesis-report.txt", "Algal Bead Virtual Lab · Class synthesis\n\nSimulated results (mean ΔpH)\n\n" +
      groupResults + "\n\n" + fieldReport(fields) + "\n\n" + gradeReport(poolRows));
  });
}
if (lab) renderLab();
if (page === "synthesis") renderSynthesis();
