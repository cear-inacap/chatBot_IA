// ======================================
// 👀 INABOT EYES ENGINE (FINAL STABLE)
// ======================================

window.addEventListener("DOMContentLoaded", () => {

  const eyes = document.querySelectorAll('.eye');

  // ===============================
  // ⚙️ ESTADO GLOBAL
  // ===============================
  let currentX = 50, currentY = 50;
  let targetX = 50, targetY = 50;
  let velocityX = 0, velocityY = 0;

  let emotion = "normal";
  let t = 0;

  // 🔥 suavizado
  let currentScales = [1, 1];
  let targetScales = [1, 1];

  // ===============================
  // 🎯 TARGET MOVIMIENTO
  // ===============================
  function pickNewTarget() {
    if (emotion !== "normal" && emotion !== "listening") return;

    targetX = 20 + Math.random() * 60;
    targetY = 20 + Math.random() * 60;
  }

  setInterval(pickNewTarget, 2000);

  // ===============================
  // 🌊 ONDA
  // ===============================
  function getWaveBorderRadius() {

    const amp = 20;

    const a = Math.sin(t * 1.2) * amp;
    const b = Math.sin(t * 0.9 + 1.3) * amp;
    const c = Math.sin(t * 1.4 + 0.6) * amp;
    const d = Math.sin(t * 0.8 + 2.1) * amp;

    return `
      ${80 + a}px ${80 + b}px
      ${80 + c}px ${80 + d}px /
      ${80 + d}px ${80 + c}px
      ${80 + b}px ${80 + a}px
    `;
  }

  // ===============================
  // 💫 LOOP PRINCIPAL
  // ===============================
  function animate() {

    t += 0.05;

    const stiffness = 0.04;
    const damping = 0.75;

    velocityX += (targetX - currentX) * stiffness;
    velocityY += (targetY - currentY) * stiffness;

    velocityX *= damping;
    velocityY *= damping;

    currentX += velocityX;
    currentY += velocityY;

    // movimiento más grande
    let moveX = 1.2;
    let moveY = 0.8;

    const offsetX = (currentX - 50) * moveX;
    const offsetY = (currentY - 50) * moveY;

    // mover gradiente
    eyes.forEach(e => {
      e.style.setProperty('--x', `${currentX}%`);
      e.style.setProperty('--y', `${currentY}%`);
    });

    // ===========================
    // 🎭 TARGET POR ESTADO
    // ===========================
    let border = "80px";

    switch (emotion) {

      case "thinking":
        border = getWaveBorderRadius();

        targetScales[0] = 0.85 + Math.sin(t * 1.2) * 0.02;
        targetScales[1] = 0.85 + Math.sin(t * 1.2 + 1.2) * 0.02;
        break;

      case "talking":
        border = getWaveBorderRadius();

        targetScales[0] = 1 + Math.sin(t * 2) * 0.06;
        targetScales[1] = 1 + Math.sin(t * 2 + 1.5) * 0.06;
        break;

      case "sleepy":
        targetScales = [0.5, 0.5];
        break;

      case "normal":
      case "listening":
      default:
        targetScales = [1, 1];
        break;
    }

    // ===========================
    // 🔥 INTERPOLACIÓN SUAVE
    // ===========================
    const smooth = 0.1;

    currentScales[0] += (targetScales[0] - currentScales[0]) * smooth;
    currentScales[1] += (targetScales[1] - currentScales[1]) * smooth;

    // ===========================
    // 🎨 APLICACIÓN FINAL
    // ===========================
    eyes.forEach((e, i) => {
      e.style.borderRadius = border;

      e.style.transform = `
        translate(${offsetX}px, ${offsetY}px)
        scale(${currentScales[i]})
      `;
    });

    requestAnimationFrame(animate);
  }

  animate();

  // ===============================
  // 😴 PARPADEO
  // ===============================
  function blink() {

    eyes.forEach(e => {
      e.style.transform += " scaleY(0.05)";
    });

    setTimeout(() => {
      eyes.forEach(e => {
        e.style.transform = e.style.transform.replace(" scaleY(0.05)", "");
      });
    }, 120);
  }

  function randomBlink() {
    blink();
    setTimeout(randomBlink, 3000 + Math.random() * 4000);
  }

  randomBlink();

  // ===============================
  // 🎭 CONTROL EMOCIONES
  // ===============================
  function setEmotion(newEmotion) {

    console.log("Estado:", newEmotion);

    emotion = newEmotion;

    eyes.forEach(e => {
      e.style.filter = "";
      e.style.boxShadow = "";
    });

    if (newEmotion === "thinking") {
      eyes.forEach(e => {
        e.style.filter = "hue-rotate(60deg)";
      });
    }

    if (newEmotion === "talking") {
      eyes.forEach(e => {
        e.style.filter = "hue-rotate(120deg)";
        e.style.boxShadow = "0 0 80px rgba(0,255,0,0.4)";
      });
    }

    if (newEmotion === "sleepy") {
      eyes.forEach(e => {
        e.style.filter = "grayscale(1)";
      });
    }
  }

  window.setEmotion = setEmotion;

  // ===============================
  // 🌐 WEBSOCKET ROBUSTO
  // ===============================
  // ===============================
// 🌐 WEBSOCKET AUTO-RECONNECT TOTAL
// ===============================

let ws = null;
let reconnectDelay = 2000;
let isConnecting = false;

function connectWebSocket() {

  if (isConnecting) return;
  isConnecting = true;

  const url = `ws://${window.location.hostname}:8765`;
  console.log("Intentando conectar a:", url);

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.log("Error creando WS:", err);
    retryConnection();
    return;
  }

  ws.onopen = () => {
    console.log("WS conectado");
    isConnecting = false;
    reconnectDelay = 2000;

    setEmotion("listening");
  };

  ws.onmessage = (event) => {
    console.log("WS:", event.data);
    setEmotion(event.data);
  };

  ws.onerror = (err) => {
    console.log("WS error:", err);
    // 👇 importante: forzar cierre para activar reconexión
    ws.close();
  };

  ws.onclose = () => {
    console.log("WS cerrado");
    isConnecting = false;

    setEmotion("sleepy");

    retryConnection();
  };
}

// ===============================
// 🔁 REINTENTO INTELIGENTE
// ===============================
function retryConnection() {

  console.log("Reintentando en", reconnectDelay / 1000, "seg");

  setEmotion("thinking");

  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay + 1000, 10000); // backoff
    connectWebSocket();
  }, reconnectDelay);
}

// iniciar
connectWebSocket();

});