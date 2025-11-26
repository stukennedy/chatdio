/**
 * Conversational Audio Demo
 *
 * This example demonstrates all the key features of the chatdio library:
 * - Microphone capture with echo cancellation
 * - Audio playback with buffering
 * - Device selection
 * - Turn management (barge-in)
 * - Real-time visualization
 * - WebSocket integration
 */

// Import from the built library
// In a real project: import { ConversationalAudio } from 'chatdio';
import { ConversationalAudio, VisualizationUtils } from "/dist/index.js";

// DOM Elements
const elements = {
  // Buttons
  initBtn: document.getElementById("initBtn"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  connectBtn: document.getElementById("connectBtn"),
  startTurnBtn: document.getElementById("startTurnBtn"),
  interruptBtn: document.getElementById("interruptBtn"),
  playTestBtn: document.getElementById("playTestBtn"),
  clearLogBtn: document.getElementById("clearLogBtn"),

  // Inputs
  wsUrl: document.getElementById("wsUrl"),
  inputDevice: document.getElementById("inputDevice"),
  outputDevice: document.getElementById("outputDevice"),
  volumeSlider: document.getElementById("volumeSlider"),

  // Status
  wsStatusDot: document.getElementById("wsStatusDot"),
  wsStatusText: document.getElementById("wsStatusText"),

  // Visualization
  micLevel: document.getElementById("micLevel"),
  micLevelBar: document.getElementById("micLevelBar"),
  micCanvas: document.getElementById("micCanvas"),
  playbackLevel: document.getElementById("playbackLevel"),
  playbackLevelBar: document.getElementById("playbackLevelBar"),
  playbackCanvas: document.getElementById("playbackCanvas"),
  volumeValue: document.getElementById("volumeValue"),

  // Turn info
  turnInfo: document.getElementById("turnInfo"),
  bargeInToggle: document.getElementById("bargeInToggle"),

  // Log
  logContainer: document.getElementById("logContainer"),
};

// Create the ConversationalAudio instance
const audio = new ConversationalAudio({
  microphone: {
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    bufferSize: 2048,
  },
  playback: {
    sampleRate: 16000, // Match microphone sample rate for echo demo
    bitDepth: 16,
    channels: 1,
  },
  deviceManager: {
    autoFallback: true,
  },
  activityAnalyzer: {
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    updateInterval: 50,
  },
  websocket: {
    // Parse incoming audio messages - handle binary or JSON with turnId
    parseIncomingAudio: (event) => {
      // Binary audio - return directly (no turn ID from server = accept all)
      if (event.data instanceof ArrayBuffer) {
        return { data: event.data };
      }
      if (event.data instanceof Blob) {
        // Will be handled by default binary handler
        return null;
      }
      // JSON audio with optional turn ID
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "audio" && message.data) {
            // Decode base64 audio
            const binaryString = atob(message.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return {
              data: bytes.buffer,
              turnId: message.turnId, // May be undefined
            };
          }
        } catch {
          // Not JSON audio, ignore
        }
      }
      return null;
    },
  },
});

// Track turns for display
const turnHistory = [];

// Track interrupted turn IDs to filter their audio
const interruptedTurnIds = new Set();

// Barge-in state
let bargeInEnabled = true;
let lastSpeakingState = false;
let bargeInCooldown = false;

// ==================== Logging ====================

function log(message, type = "info") {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">${time}</span>${message}`;
  elements.logContainer.appendChild(entry);
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

elements.clearLogBtn.addEventListener("click", () => {
  elements.logContainer.innerHTML = "";
  log("Log cleared");
});

// ==================== Event Handlers ====================

// Microphone events
audio.on("mic:start", () => {
  log("🎤 Microphone started", "success");
  updateButtonStates();
});

audio.on("mic:stop", () => {
  log("🎤 Microphone stopped");
  updateButtonStates();
});

audio.on("mic:error", (error) => {
  log(`🎤 Microphone error: ${error.message}`, "error");
});

audio.on("mic:activity", (data) => {
  const level = Math.round(data.volume * 100);
  elements.micLevel.textContent = `${level}%`;
  elements.micLevelBar.style.width = `${Math.min(level * 2, 100)}%`;
  elements.micLevelBar.classList.toggle("speaking", data.isSpeaking);

  // Draw waveform
  drawWaveform(elements.micCanvas, data.timeDomainData, "#6366f1");

  // Barge-in detection: if user starts speaking while playback is active
  if (bargeInEnabled && !bargeInCooldown) {
    const justStartedSpeaking = data.isSpeaking && !lastSpeakingState;
    const isPlaybackActive = audio.isPlaybackActive();

    if (justStartedSpeaking && isPlaybackActive) {
      log("⚡ Barge-in detected! Interrupting playback...", "event");

      // Interrupt the current turn and start a new one
      const result = audio.interruptTurn();
      if (result.interruptedTurnId) {
        log(
          `Interrupted turn ${result.interruptedTurnId.slice(
            -8
          )}, new turn: ${result.newTurnId.slice(-8)}`,
          "event"
        );
      }

      // Brief cooldown to prevent rapid interrupts
      bargeInCooldown = true;
      setTimeout(() => {
        bargeInCooldown = false;
      }, 500);
    }
  }

  lastSpeakingState = data.isSpeaking;
});

// Microphone device events
audio.on("mic:device-lost", () => {
  log("🎤 Microphone device lost! Attempting to recover...", "error");
});

audio.on("mic:device-changed", (deviceId) => {
  log(`🎤 Microphone switched to: ${deviceId || "default device"}`, "event");
  updateDeviceLists();
});

audio.on("mic:restarting", () => {
  log("🎤 Microphone restarting...", "event");
});

// Playback events
audio.on("playback:start", () => {
  log("🔊 Playback started", "success");
  updateButtonStates();
});

audio.on("playback:stop", () => {
  log("🔊 Playback stopped");
  updateButtonStates();
});

audio.on("playback:ended", () => {
  log("🔊 Playback ended (buffer empty)");
});

audio.on("playback:error", (error) => {
  log(`🔊 Playback error: ${error.message}`, "error");
});

audio.on("playback:activity", (data) => {
  const level = Math.round(data.volume * 100);
  elements.playbackLevel.textContent = `${level}%`;
  elements.playbackLevelBar.style.width = `${Math.min(level * 2, 100)}%`;

  // Draw waveform
  drawWaveform(elements.playbackCanvas, data.timeDomainData, "#22c55e");
});

// WebSocket events
audio.on("ws:connected", () => {
  log("🌐 WebSocket connected", "success");
  updateConnectionStatus("connected");
});

audio.on("ws:disconnected", (code, reason) => {
  log(`🌐 WebSocket disconnected: ${reason} (${code})`);
  updateConnectionStatus("disconnected");
});

audio.on("ws:reconnecting", (attempt) => {
  log(`🌐 Reconnecting... attempt ${attempt}`, "event");
  updateConnectionStatus("connecting");
});

audio.on("ws:error", (error) => {
  log(`🌐 WebSocket error: ${error.message}`, "error");
  updateConnectionStatus("error");
});

audio.on("ws:audio", (data) => {
  log(`🔊 Received audio: ${data.byteLength} bytes`, "event");
});

audio.on("ws:message", (message) => {
  log(`📨 Received message: ${JSON.stringify(message)}`, "event");
});

// Device events
audio.on("device:changed", (devices) => {
  log(`📱 Devices changed: ${devices.length} devices`);
  updateDeviceLists();
});

audio.on("device:disconnected", (device) => {
  log(`📱 Device disconnected: ${device.label}`, "error");
});

// Turn events
audio.on("turn:started", (turnId, previousTurnId) => {
  log(`🔄 Turn started: ${turnId}`, "event");
  turnHistory.push({ id: turnId, status: "active" });
  updateTurnDisplay();

  // Tell server about our new turn ID so it can tag audio with it
  if (audio.isWebSocketConnected()) {
    audio.sendMessage({
      type: "turn:start",
      turnId: turnId,
    });
  }
});

audio.on("turn:interrupted", (turnId) => {
  log(`⚡ Turn interrupted: ${turnId}`, "error");
  // Track this turn ID so we can ignore its audio
  interruptedTurnIds.add(turnId);
  const turn = turnHistory.find((t) => t.id === turnId);
  if (turn) turn.status = "interrupted";
  updateTurnDisplay();
});

audio.on("turn:ended", (turnId) => {
  log(`✓ Turn ended: ${turnId}`, "success");
  const turn = turnHistory.find((t) => t.id === turnId);
  if (turn) turn.status = "ended";
  updateTurnDisplay();
});

// ==================== UI Updates ====================

function updateButtonStates() {
  const isInitialized =
    audio.isMicrophoneActive() || elements.startBtn.disabled === false;
  const isRunning = audio.isMicrophoneActive();

  elements.startBtn.disabled = !isInitialized || isRunning;
  elements.stopBtn.disabled = !isRunning;
  elements.startTurnBtn.disabled = !isInitialized;
  elements.interruptBtn.disabled = !isInitialized;
  elements.playTestBtn.disabled = !isInitialized;
}

function updateConnectionStatus(status) {
  elements.wsStatusDot.className = "status-dot";

  switch (status) {
    case "connected":
      elements.wsStatusDot.classList.add("active");
      elements.wsStatusText.textContent = "Connected";
      elements.connectBtn.textContent = "Disconnect";
      break;
    case "connecting":
      elements.wsStatusDot.classList.add("connecting");
      elements.wsStatusText.textContent = "Connecting...";
      break;
    case "error":
      elements.wsStatusDot.classList.add("error");
      elements.wsStatusText.textContent = "Error";
      elements.connectBtn.textContent = "Connect";
      break;
    default:
      elements.wsStatusText.textContent = "Disconnected";
      elements.connectBtn.textContent = "Connect";
  }
}

function updateDeviceLists() {
  const inputDevices = audio.getInputDevices();
  const outputDevices = audio.getOutputDevices();

  elements.inputDevice.innerHTML = inputDevices
    .map(
      (d) =>
        `<option value="${d.deviceId}">${d.label}${
          d.isDefault ? " (Default)" : ""
        }</option>`
    )
    .join("");

  elements.outputDevice.innerHTML = outputDevices
    .map(
      (d) =>
        `<option value="${d.deviceId}">${d.label}${
          d.isDefault ? " (Default)" : ""
        }</option>`
    )
    .join("");

  // Check if output selection is supported
  if (!audio.isOutputSelectionSupported()) {
    elements.outputDevice.innerHTML =
      '<option value="">Not supported (Safari)</option>';
  }
}

function updateTurnDisplay() {
  const currentTurnId = audio.getCurrentTurnId();
  const recentTurns = turnHistory.slice(-3);

  if (recentTurns.length === 0) {
    elements.turnInfo.innerHTML =
      '<span style="color: var(--text-muted);">No active turn</span>';
    return;
  }

  elements.turnInfo.innerHTML = recentTurns
    .map((turn) => {
      const shortId = turn.id.slice(-8);
      let className = "turn-badge";
      if (turn.status === "interrupted") className += " interrupted";
      if (turn.id === currentTurnId) className += " active";
      return `<span class="${className}">${shortId}</span>`;
    })
    .join("");
}

// ==================== Visualization ====================

function drawWaveform(canvas, timeDomainData, color) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, width, height);

  if (!timeDomainData) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  const sliceWidth = width / timeDomainData.length;
  let x = 0;

  for (let i = 0; i < timeDomainData.length; i++) {
    const v = timeDomainData[i] / 255;
    const y = v * height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.stroke();
}

// Setup canvas sizes
function setupCanvases() {
  [elements.micCanvas, elements.playbackCanvas].forEach((canvas) => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext("2d");
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  });
}

// ==================== Button Actions ====================

elements.initBtn.addEventListener("click", async () => {
  try {
    log("Initializing audio...");
    await audio.initialize();
    log("Audio initialized!", "success");

    // Enable controls
    elements.startBtn.disabled = false;
    elements.inputDevice.disabled = false;
    elements.outputDevice.disabled = false;
    elements.startTurnBtn.disabled = false;
    elements.interruptBtn.disabled = false;
    elements.playTestBtn.disabled = false;
    elements.initBtn.disabled = true;

    // Update device lists
    updateDeviceLists();

    // Select current devices
    const currentInput = audio.getCurrentInputDevice();
    const currentOutput = audio.getCurrentOutputDevice();
    if (currentInput) elements.inputDevice.value = currentInput.deviceId;
    if (currentOutput) elements.outputDevice.value = currentOutput.deviceId;
  } catch (error) {
    log(`Initialization failed: ${error.message}`, "error");
  }
});

elements.startBtn.addEventListener("click", async () => {
  try {
    await audio.startMicrophone();
    updateButtonStates();
  } catch (error) {
    log(`Start failed: ${error.message}`, "error");
  }
});

elements.stopBtn.addEventListener("click", () => {
  audio.stopConversation();
  updateButtonStates();
});

elements.connectBtn.addEventListener("click", async () => {
  const url = elements.wsUrl.value.trim();

  if (audio.isWebSocketConnected()) {
    audio.disconnectWebSocket();
    return;
  }

  if (!url) {
    log("Please enter a WebSocket URL", "error");
    return;
  }

  try {
    updateConnectionStatus("connecting");
    await audio.connectWebSocket(url);

    // Start a turn when connected
    const turnId = audio.startTurn();
    log(`Session started with turn: ${turnId.slice(-8)}`, "event");
  } catch (error) {
    log(`Connection failed: ${error.message}`, "error");
    updateConnectionStatus("error");
  }
});

elements.startTurnBtn.addEventListener("click", () => {
  const turnId = audio.startTurn();
  log(`Started new turn: ${turnId}`, "event");
});

elements.interruptBtn.addEventListener("click", () => {
  const result = audio.interruptTurn();
  if (result.interruptedTurnId) {
    log(
      `Interrupted turn ${result.interruptedTurnId}, new turn: ${result.newTurnId}`,
      "event"
    );
  } else {
    log("No turn to interrupt", "event");
  }
});

elements.playTestBtn.addEventListener("click", async () => {
  // Generate a simple test tone (440Hz sine wave)
  const sampleRate = 24000;
  const duration = 0.5; // 500ms
  const frequency = 440; // Hz
  const numSamples = Math.floor(sampleRate * duration);

  const pcmData = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Apply envelope to avoid clicks
    const envelope = Math.min(1, Math.min(t * 20, (duration - t) * 20));
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3 * envelope;
    pcmData[i] = sample * 32767;
  }

  try {
    await audio.playAudio(pcmData.buffer);
    log("Playing test tone (440Hz)", "event");
  } catch (error) {
    log(`Failed to play test tone: ${error.message}`, "error");
  }
});

// Device selection
elements.inputDevice.addEventListener("change", async () => {
  const deviceId = elements.inputDevice.value;
  try {
    await audio.setInputDevice(deviceId);
    log(
      `Input device changed: ${
        elements.inputDevice.options[elements.inputDevice.selectedIndex].text
      }`
    );
  } catch (error) {
    log(`Failed to change input device: ${error.message}`, "error");
  }
});

elements.outputDevice.addEventListener("change", async () => {
  const deviceId = elements.outputDevice.value;
  try {
    await audio.setOutputDevice(deviceId);
    log(
      `Output device changed: ${
        elements.outputDevice.options[elements.outputDevice.selectedIndex].text
      }`
    );
  } catch (error) {
    log(`Failed to change output device: ${error.message}`, "error");
  }
});

// Volume control
elements.volumeSlider.addEventListener("input", () => {
  const volume = elements.volumeSlider.value / 100;
  audio.setVolume(volume);
  elements.volumeValue.textContent = `${elements.volumeSlider.value}%`;
});

// Barge-in toggle
elements.bargeInToggle.addEventListener("change", () => {
  bargeInEnabled = elements.bargeInToggle.checked;
  log(`Auto barge-in ${bargeInEnabled ? "enabled" : "disabled"}`, "event");
});

// ==================== Initialization ====================

window.addEventListener("load", () => {
  setupCanvases();
  log('Ready! Click "Initialize Audio" to begin.');
});

window.addEventListener("resize", () => {
  setupCanvases();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  audio.dispose();
});
