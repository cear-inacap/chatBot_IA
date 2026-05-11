const face = document.querySelector(".face");
const buttons = document.querySelectorAll(".emotion-button");
const emotionSelect = document.querySelector("[data-emotion-select]");
const transitionFromSelect = document.querySelector("[data-transition-from]");
const transitionToSelect = document.querySelector("[data-transition-to]");
const cycleDelayInput = document.querySelector("[data-cycle-delay]");
const applyEmotionButton = document.querySelector("[data-apply-emotion]");
const testTransitionButton = document.querySelector("[data-test-transition]");
const cycleEmotionsButton = document.querySelector("[data-cycle-emotions]");
const debugStatus = document.querySelector("[data-debug-status]");

const EYE_SIZE = 1;
const emotions = new Set(["sleepy", "listening", "thinking", "talking"]);
const emotionAliases = new Map([
  ["thingking", "thinking"],
  ["think", "thinking"],
  ["listen", "listening"],
  ["talk", "talking"],
  ["sleep", "sleepy"],
]);

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
let transitionEndTimer = 0;
let targetTimer = 0;
let cycleTimer = 0;
let listeningStep = 0;
let isCycling = false;
let socketReconnectTimer = 0;

document.documentElement.style.setProperty("--eye-size", EYE_SIZE);

function cleanEmotion(value) {
  const emotion = String(value || "").trim().toLowerCase();
  const normalized = emotionAliases.get(emotion) || emotion;

  return emotions.has(normalized) ? normalized : "";
}

function updateButtons(emotion) {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.emotion === emotion);
  });
}

function updateDebugPanel(emotion, label = emotion) {
  if (emotionSelect) {
    emotionSelect.value = emotion;
  }

  if (transitionFromSelect) {
    transitionFromSelect.value = currentEmotion;
  }

  if (debugStatus) {
    debugStatus.value = label;
  }
}

function setEmotion(value, options = {}) {
  const nextEmotion = cleanEmotion(value);

  if (!nextEmotion) {
    updateDebugPanel(currentEmotion, "invalid");
    return false;
  }

  if (
    nextEmotion === currentEmotion &&
    !face.classList.contains("is-transitioning")
  ) {
    updateDebugPanel(currentEmotion);
    return true;
  }

  window.clearTimeout(transitionTimer);
  window.clearTimeout(transitionEndTimer);
  face.classList.add("is-transitioning");
  face.dataset.transitionFrom = currentEmotion;
  face.dataset.transitionTo = nextEmotion;
  updateDebugPanel(currentEmotion, `${currentEmotion} -> ${nextEmotion}`);

  transitionTimer = window.setTimeout(() => {
    const previousEmotion = currentEmotion;

    currentEmotion = nextEmotion;
    face.dataset.emotion = nextEmotion;
    face.dataset.previousEmotion = previousEmotion;
    updateButtons(nextEmotion);
    scheduleTarget();
    updateDebugPanel(nextEmotion);

    if (typeof options.onDone === "function") {
      options.onDone();
    }

    transitionEndTimer = window.setTimeout(() => {
      face.classList.remove("is-transitioning");
      delete face.dataset.transitionFrom;
      delete face.dataset.transitionTo;
    }, 80);
  }, 170);

  return true;
}

function pickTarget() {
  const ranges = {
    sleepy: [2, 1, 0, 0],
    listening: [0, 0, 0, 0],
    thinking: [3, 8, 28, 28],
    talking: [0, 0, 0, 0],
  };

  const [eyeRangeX, eyeRangeY, irisRangeX, irisRangeY] =
    ranges[currentEmotion];

  motion.targetX = (Math.random() - 0.5) * eyeRangeX;
  motion.targetY = (Math.random() - 0.5) * eyeRangeY;

  if (currentEmotion === "listening") {
    const bounds = getListeningBounds();
    const eyeScan = [
      [-0.72, -0.32],
      [0.48, -0.46],
      [0.68, 0.12],
      [0.18, 0.42],
      [-0.58, 0.3],
      [-0.24, -0.08],
    ];

    const irisScan = [
      [-0.72, -0.42],
      [0.56, -0.48],
      [0.7, 0.2],
      [0.2, 0.48],
      [-0.62, 0.36],
      [-0.28, -0.08],
    ];

    const eyeTarget = eyeScan[listeningStep % eyeScan.length];
    const irisTarget = irisScan[listeningStep % irisScan.length];

    motion.targetX = eyeTarget[0] * bounds.x;
    motion.targetY = eyeTarget[1] * bounds.y;
    motion.targetIrisX = irisTarget[0] * bounds.irisX;
    motion.targetIrisY = irisTarget[1] * bounds.irisY;

    listeningStep += 1;
    return;
  }

  motion.targetIrisX = (Math.random() - 0.5) * irisRangeX;
  motion.targetIrisY = (Math.random() - 0.5) * irisRangeY;
}

function getListeningBounds() {
  return {
    x: Math.min(34, window.innerWidth * 0.035),
    y: Math.min(18, window.innerHeight * 0.026),
    irisX: Math.min(24, window.innerWidth * 0.028),
    irisY: Math.min(16, window.innerHeight * 0.024),
  };
}

function scheduleTarget() {
  window.clearTimeout(targetTimer);
  pickTarget();

  const delays = {
    sleepy: 2400,
    listening: 2300,
    thinking: 1500,
    talking: 1200,
  };

  targetTimer = window.setTimeout(scheduleTarget, delays[currentEmotion]);
}

function animate() {
  const now = Date.now();

  const ease = currentEmotion === "listening" ? 0.03 : 0.08;
  const irisEase = currentEmotion === "listening" ? 0.025 : 0.06;

  const sleepyDrift =
    currentEmotion === "sleepy"
      ? Math.sin(now * 0.0016) * 2
      : 0;

  const talkingFloat =
    currentEmotion === "talking"
      ? Math.sin(now * 0.00145) * 8
      : 0;

  const listeningSway =
    currentEmotion === "listening"
      ? Math.sin(now * 0.0012) * 0.55
      : 0;

  const lookIntent =
    currentEmotion === "listening"
      ? (Math.sin(now * 0.0025) + 1) / 2
      : 0;

  motion.x += (motion.targetX - motion.x) * ease;
  motion.y += (motion.targetY - motion.y) * ease;
  motion.irisX += (motion.targetIrisX - motion.irisX) * irisEase;
  motion.irisY += (motion.targetIrisY - motion.irisY) * irisEase;

  face.style.setProperty("--eye-x", `${motion.x.toFixed(2)}px`);

  face.style.setProperty(
    "--eye-y",
    `${(
      motion.y +
      sleepyDrift +
      talkingFloat +
      listeningSway
    ).toFixed(2)}px`
  );

  face.style.setProperty(
    "--iris-x",
    `${(motion.irisX + listeningSway).toFixed(2)}px`
  );

  face.style.setProperty(
    "--iris-y",
    `${motion.irisY.toFixed(2)}px`
  );

  face.style.setProperty(
    "--look-intent",
    lookIntent.toFixed(2)
  );

  face.style.setProperty(
    "--tilt",
    `${(motion.x * 0.11).toFixed(2)}deg`
  );

  window.requestAnimationFrame(animate);
}

buttons.forEach((button) => {
  button.addEventListener("click", () =>
    setEmotion(button.dataset.emotion)
  );
});

if (applyEmotionButton && emotionSelect) {
  applyEmotionButton.addEventListener("click", () =>
    setEmotion(emotionSelect.value)
  );
}

if (emotionSelect) {
  emotionSelect.addEventListener("change", () =>
    setEmotion(emotionSelect.value)
  );
}

if (testTransitionButton && transitionFromSelect && transitionToSelect) {
  testTransitionButton.addEventListener("click", () => {
    stopCycle();

    const fromEmotion = transitionFromSelect.value;
    const toEmotion = transitionToSelect.value;
    const runNext = () => window.setTimeout(() => {
      setEmotion(toEmotion);
    }, 260);

    if (fromEmotion === currentEmotion) {
      runNext();
      return;
    }

    setEmotion(fromEmotion, { onDone: runNext });
  });
}

function getCycleDelay() {
  const delay = Number(cycleDelayInput?.value || 1400);

  return Number.isFinite(delay)
    ? Math.min(Math.max(delay, 600), 6000)
    : 1400;
}

function cycleNextEmotion() {
  if (!isCycling) {
    return;
  }

  const emotionList = Array.from(emotions);
  const currentIndex = emotionList.indexOf(currentEmotion);
  const nextEmotion = emotionList[(currentIndex + 1) % emotionList.length];

  setEmotion(nextEmotion);
  cycleTimer = window.setTimeout(cycleNextEmotion, getCycleDelay());
}

function startCycle() {
  isCycling = true;
  cycleEmotionsButton?.classList.add("is-running");

  if (cycleEmotionsButton) {
    cycleEmotionsButton.textContent = "Detener ciclo";
  }

  cycleNextEmotion();
}

function stopCycle() {
  isCycling = false;
  window.clearTimeout(cycleTimer);
  cycleEmotionsButton?.classList.remove("is-running");

  if (cycleEmotionsButton) {
    cycleEmotionsButton.textContent = "Auto ciclo";
  }
}

if (cycleEmotionsButton) {
  cycleEmotionsButton.addEventListener("click", () => {
    if (isCycling) {
      stopCycle();
      return;
    }

    startCycle();
  });
}

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
  const protocol =
    window.location.protocol === "https:"
      ? "wss:"
      : "ws:";

  const host = window.location.hostname || "localhost";
  let socketWasOpen = false;

  const socket = new WebSocket(
    `${protocol}//${host}:8765`
  );

  socket.addEventListener("open", () => {
    socketWasOpen = true;
    setEmotion("listening");
  });

  socket.addEventListener("message", (event) =>
    setEmotion(event.data)
  );

  socket.addEventListener("close", () => {
    if (socketWasOpen) {
      setEmotion("sleepy");
    }

    window.clearTimeout(socketReconnectTimer);
    socketReconnectTimer = window.setTimeout(connectWebSocket, 1600);
  });

  socket.addEventListener("error", () =>
    socket.close()
  );
}

try {
  connectWebSocket();
} catch (error) {
  setEmotion("sleepy");
}

window.setEmotion = setEmotion;
window.setEyeSize = (size) => {
  const nextSize = Number(size);

  if (Number.isFinite(nextSize) && nextSize > 0) {
    document.documentElement.style.setProperty("--eye-size", nextSize);
  }
};

scheduleTarget();
updateDebugPanel(currentEmotion);
animate();
