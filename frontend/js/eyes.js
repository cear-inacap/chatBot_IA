const face = document.querySelector(".face");
const buttons = document.querySelectorAll(".emotion-button");

const emotions = new Set(["sleepy", "listening", "thinking", "talking"]);
const motion = {
  x: 0,
  y: 0,
  irisX: 0,
  irisY: 0,
  targetX: 0,
  targetY: 0,
  targetIrisX: 0,
  targetIrisY: 0,
};

let currentEmotion = "sleepy";
let transitionTimer = 0;
let targetTimer = 0;
let listeningStep = 0;

function cleanEmotion(value) {
  const emotion = String(value || "").trim().toLowerCase();
  return emotions.has(emotion) ? emotion : "listening";
}

function updateButtons(emotion) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.emotion === emotion);
  });
}

function setEmotion(value) {
  const nextEmotion = cleanEmotion(value);

  if (nextEmotion === currentEmotion && !face.classList.contains("is-transitioning")) {
    return;
  }

  window.clearTimeout(transitionTimer);
  face.classList.add("is-transitioning");

  transitionTimer = window.setTimeout(() => {
    currentEmotion = nextEmotion;
    face.dataset.emotion = nextEmotion;
    updateButtons(nextEmotion);
    scheduleTarget();

    window.setTimeout(() => {
      face.classList.remove("is-transitioning");
    }, 80);
  }, 170);
}

function pickTarget() {
  const ranges = {
    sleepy: [2, 1, 0, 0],
    listening: [0, 0, 0, 0],
    thinking: [3, 8, 28, 28],
    talking: [4, 3, 24, 16],
  };

  const [eyeRangeX, eyeRangeY, irisRangeX, irisRangeY] = ranges[currentEmotion];

  motion.targetX = (Math.random() - 0.5) * eyeRangeX;
  motion.targetY = (Math.random() - 0.5) * eyeRangeY;

  if (currentEmotion === "listening") {
    const eyeScan = [
      [-8, -2],
      [6, -3],
      [10, 2],
      [2, 5],
      [-9, 3],
      [-3, -1],
    ];

    const irisScan = [
      [-10, -3],
      [8, -4],
      [12, 3],
      [3, 6],
      [-11, 4],
      [-4, -1],
    ];

    const eyeTarget = eyeScan[listeningStep % eyeScan.length];
    const irisTarget = irisScan[listeningStep % irisScan.length];

    motion.targetX = eyeTarget[0];
    motion.targetY = eyeTarget[1];
    motion.targetIrisX = irisTarget[0];
    motion.targetIrisY = irisTarget[1];

    listeningStep += 1;
    return;
  }

  motion.targetIrisX = (Math.random() - 0.5) * irisRangeX;
  motion.targetIrisY = (Math.random() - 0.5) * irisRangeY;
}

function scheduleTarget() {
  window.clearTimeout(targetTimer);
  pickTarget();

  const delays = {
    sleepy: 2400,
    listening: 1800,
    thinking: 1500,
    talking: 1200,
  };

  targetTimer = window.setTimeout(scheduleTarget, delays[currentEmotion]);
}

function animate() {
  const now = Date.now();

  const ease = currentEmotion === "listening" ? 0.03 : 0.08;
  const irisEase = currentEmotion === "listening" ? 0.025 : 0.06;

  const sleepyDrift = currentEmotion === "sleepy"
    ? Math.sin(now * 0.0016) * 2
    : 0;

  const talkingBounce = currentEmotion === "talking"
    ? Math.sin(now * 0.006) * 1.2
    : 0;

  const listeningSway = currentEmotion === "listening"
    ? Math.sin(now * 0.0012) * 1.2
    : 0;

  const lookIntent = currentEmotion === "listening"
    ? (Math.sin(now * 0.0025) + 1) / 2
    : 0;

  motion.x += (motion.targetX - motion.x) * ease;
  motion.y += (motion.targetY - motion.y) * ease;
  motion.irisX += (motion.targetIrisX - motion.irisX) * irisEase;
  motion.irisY += (motion.targetIrisY - motion.irisY) * irisEase;

  face.style.setProperty("--eye-x", `${motion.x.toFixed(2)}px`);
  face.style.setProperty(
    "--eye-y",
    `${(motion.y + sleepyDrift + talkingBounce + listeningSway).toFixed(2)}px`
  );

  face.style.setProperty(
    "--iris-x",
    `${(motion.irisX + listeningSway).toFixed(2)}px`
  );

  face.style.setProperty("--iris-y", `${motion.irisY.toFixed(2)}px`);
  face.style.setProperty("--look-intent", lookIntent.toFixed(2));
  face.style.setProperty("--tilt", `${(motion.x * 0.11).toFixed(2)}deg`);

  window.requestAnimationFrame(animate);
}

buttons.forEach((button) => {
  button.addEventListener("click", () => setEmotion(button.dataset.emotion));
});

window.addEventListener("keydown", (event) => {
  const keys = {
    "1": "sleepy",
    "2": "listening",
    "3": "thinking",
    "4": "talking",
  };

  if (keys[event.key]) {
    setEmotion(keys[event.key]);
  }
});

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  const socket = new WebSocket(`${protocol}//${host}:8765`);

  socket.addEventListener("open", () => setEmotion("listening"));
  socket.addEventListener("message", (event) => setEmotion(event.data));
  socket.addEventListener("close", () => setEmotion("sleepy"));
  socket.addEventListener("error", () => socket.close());
}

try {
  connectWebSocket();
} catch (error) {
  setEmotion("sleepy");
}

window.setEmotion = setEmotion;
scheduleTarget();
animate();