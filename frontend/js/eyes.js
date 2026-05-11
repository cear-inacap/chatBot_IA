const face = document.querySelector(".face");
const supportText = document.querySelector("[data-support-text]");

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
let listeningStep = 0;
let socketReconnectTimer = 0;

document.documentElement.style.setProperty("--eye-size", EYE_SIZE);

function cleanEmotion(value) {
  const emotion = String(value || "").trim().toLowerCase();
  const normalized = emotionAliases.get(emotion) || emotion;

  return emotions.has(normalized) ? normalized : "";
}

function updateSupportEmotion(emotion) {
  if (supportText) {
    supportText.dataset.emotion = emotion;
  }
}

function setEmotion(value, options = {}) {
  const nextEmotion = cleanEmotion(value);

  if (!nextEmotion) {
    return false;
  }

  if (
    nextEmotion === currentEmotion &&
    !face.classList.contains("is-transitioning")
  ) {
    updateSupportEmotion(currentEmotion);
    return true;
  }

  window.clearTimeout(transitionTimer);
  window.clearTimeout(transitionEndTimer);
  face.classList.add("is-transitioning");
  face.dataset.transitionFrom = currentEmotion;
  face.dataset.transitionTo = nextEmotion;

  transitionTimer = window.setTimeout(() => {
    const previousEmotion = currentEmotion;

    currentEmotion = nextEmotion;
    face.dataset.emotion = nextEmotion;
    face.dataset.previousEmotion = previousEmotion;
    updateSupportEmotion(nextEmotion);
    scheduleTarget();

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

function setSupportText(value) {
  if (!supportText) {
    return;
  }

  const text = String(value || "").trim();
  supportText.textContent = text;
  supportText.classList.toggle("has-text", text.length > 0);
}

function parseBackendMessage(data) {
  const rawMessage = String(data || "").trim();

  if (!rawMessage) {
    return;
  }

  try {
    const payload = JSON.parse(rawMessage);

    if (payload && typeof payload === "object") {
      if (payload.emotion) {
        setEmotion(payload.emotion);
      }

      const text = payload.text ?? payload.label ?? payload.message;

      if (text !== undefined) {
        setSupportText(text);
      }

      return;
    }
  } catch (error) {
    // Plain string messages are still supported.
  }

  if (setEmotion(rawMessage)) {
    return;
  }

  setSupportText(rawMessage);
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
    parseBackendMessage(event.data)
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
window.setSupportText = setSupportText;
window.setEyeSize = (size) => {
  const nextSize = Number(size);

  if (Number.isFinite(nextSize) && nextSize > 0) {
    document.documentElement.style.setProperty("--eye-size", nextSize);
  }
};

scheduleTarget();
updateSupportEmotion(currentEmotion);
animate();
