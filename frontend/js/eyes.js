const face = document.querySelector(".face");
const supportText = document.querySelector("[data-support-text]");
const wakeButton = document.querySelector("[data-wake-button]");
const volumeControls = document.querySelector("[data-volume-controls]");
const volumeDownButton = document.querySelector("[data-volume-down]");
const volumeUpButton = document.querySelector("[data-volume-up]");

const EYE_SIZE = 1;
const emotions = new Set([
  "disconnected",
  "sleepy",
  "listening",
  "thinking",
  "talking",
]);
const emotionAliases = new Map([
  ["offline", "disconnected"],
  ["disconnect", "disconnected"],
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

let currentEmotion = "disconnected";
let transitionTimer = 0;
let transitionEndTimer = 0;
let targetTimer = 0;
let listeningStep = 0;
let socketReconnectTimer = 0;
let socket = null;

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

  if (wakeButton) {
    wakeButton.classList.toggle("is-visible", emotion === "sleepy");
  }

  if (volumeControls) {
    volumeControls.classList.toggle("is-disabled", emotion === "disconnected");
  }

  updateVolumeButtons();
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

function sendBackendCommand(command) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setSupportText("Conectando...");
    return;
  }

  socket.send(JSON.stringify({ command }));
}

function updateVolumeButtons() {
  const disabled =
    currentEmotion === "disconnected" ||
    !socket ||
    socket.readyState !== WebSocket.OPEN;

  [volumeDownButton, volumeUpButton].forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
}

function pickTarget() {
  const ranges = {
    sleepy: [2, 1, 0, 0],
    disconnected: [1, 0.5, 0, 0],
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
    disconnected: 3000,
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
    ["disconnected", "sleepy"].includes(currentEmotion)
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

function connectWebSocket() {
  const protocol =
    window.location.protocol === "https:"
      ? "wss:"
      : "ws:";

  const host = window.location.hostname || "localhost";

  socket = new WebSocket(
    `${protocol}//${host}:8765`
  );

  updateVolumeButtons();

  socket.addEventListener("open", () =>
    updateVolumeButtons()
  );

  socket.addEventListener("message", (event) =>
    parseBackendMessage(event.data)
  );

  socket.addEventListener("close", () => {
    setEmotion("disconnected");
    setSupportText("Desconectado");
    updateVolumeButtons();

    window.clearTimeout(socketReconnectTimer);
    socketReconnectTimer = window.setTimeout(connectWebSocket, 1600);
  });

  socket.addEventListener("error", () =>
    socket.close()
  );
}

if (wakeButton) {
  wakeButton.addEventListener("click", () => {
    setSupportText("Despertando...");
    sendBackendCommand("wake");
  });
}

if (volumeDownButton) {
  volumeDownButton.addEventListener("click", () =>
    sendBackendCommand("volume_down")
  );
}

if (volumeUpButton) {
  volumeUpButton.addEventListener("click", () =>
    sendBackendCommand("volume_up")
  );
}

try {
  connectWebSocket();
} catch (error) {
  setEmotion("disconnected");
  setSupportText("Desconectado");
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
