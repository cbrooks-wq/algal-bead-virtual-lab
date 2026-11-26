// Teaching model parameters. Each treatment stores its name and net pH change
// per simulated 10 minutes near the start of a trial.
const labs = {
  intensity: {
    title: "Light Intensity", color: "#a16a10",
    question: "How does distance from a lamp affect net CO₂ exchange?",
    intro: "Move a vial closer to or farther from the lamp. Compare your results with a foil-wrapped vial.",
    variable: "Distance from lamp (cm)", reference: "Foil-wrapped dark control",
    fixed: "Lamp, temperature, bead amount, and indicator volume.",
    prompt: "Compare a near and a far vial. How does the foil control help you explain the trend?",
    treatments: [["Foil-wrapped dark control",-.17],["10 cm",.13],["20 cm",.23],["35 cm",.13],["50 cm",.04]]
  },
  spectrum: {
    title:"Light Color", color:"#79549a",
    question:"How does the color of light affect net CO₂ exchange?",
    intro:"Place a colored filter between the lamp and vial. Photon flux at the vial is held equal across the lit treatments.",
    variable:"Light color", reference:"White light",
    fixed:"Photon flux at the vial, temperature, bead amount, and indicator volume.",
    prompt:"Which two colors show the biggest difference? What does a comparison with white light tell you?",
    treatments:[["White light",.17],["Red (~660 nm)",.22],["Blue (~450 nm)",.20],["Yellow (~580 nm)",.05],["Green (~530 nm)",.025]]
  },
  temperature: {
    title:"Temperature", color:"#247588",
    question:"How does water-bath temperature affect net CO₂ exchange?",
    intro:"Choose a water bath. Keep the lamp settings the same while you compare cold, moderate, and hot conditions.",
    variable:"Water-bath temperature (°C)", reference:"26 °C reference",
    fixed:"Light spectrum and intensity, bead amount, and indicator volume.",
    prompt:"Which tested temperature showed the greatest increase? What do these trials let you conclude about temperatures you did not test?",
    treatments:[["8 °C",.036],["18 °C",.12],["26 °C reference",.23],["34 °C",.14],["44 °C",-.065]]
  },
  surface: {
    title:"Surface Area to Volume", color:"#38734c",
    question:"How does flattening an algal bead affect net CO₂ exchange?",
    intro:"Compare an intact sphere with a flattened bead modeled as a cylinder. Bead volume and amount of algae are held constant.",
    variable:"Bead shape and surface-area-to-volume ratio", reference:"Intact sphere",
    fixed:"Bead volume and algae amount, light, temperature, and indicator volume.",
    prompt:"Compare ΔpH for the two shapes. Explain how exposed area and diffusion distance could contribute. What else might flattening change in a real lab?",
    treatments:[["Intact sphere",.115],["Flattened disk",.195]]
  }
};
const sampleTimes = [0,10,20,40,80];

function simulate(key, treatment, replicate) {
  const rate = labs[key].treatments[treatment][1];
  const variation = Math.sin((treatment + 1) * 9 + replicate * 7 + key.length);
  const initial = 8 + .035 * variation;
  return sampleTimes.map(time => Number((initial + (rate + variation * .014) * 5.8 * (1 - Math.exp(-time / 58))).toFixed(2)));
}

function geometry() {
  const radius = 2;
  const volume = 4 * Math.PI * radius ** 3 / 3;
  const diskRadius = 3;
  const height = volume / (Math.PI * diskRadius ** 2);
  return {height, sphere:4 * Math.PI * radius ** 2 / volume, disk:2 * Math.PI * diskRadius * (diskRadius + height) / volume};
}
