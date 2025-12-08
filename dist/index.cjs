"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ActivityAnalyzer: () => ActivityAnalyzer,
  AudioDeviceManager: () => AudioDeviceManager,
  AudioFormatConverter: () => AudioFormatConverter,
  AudioPlayback: () => AudioPlayback,
  AudioRouter: () => AudioRouter,
  Chatdio: () => Chatdio,
  MicrophoneCapture: () => MicrophoneCapture,
  TypedEventEmitter: () => TypedEventEmitter,
  VisualizationUtils: () => VisualizationUtils,
  WebSocketBridge: () => WebSocketBridge,
  arrayBufferToBase64: () => arrayBufferToBase64,
  audioWorkletProcessorCode: () => audioWorkletProcessorCode,
  base64ToArrayBuffer: () => base64ToArrayBuffer,
  base64ToUint8Array: () => base64ToUint8Array,
  createWorkletBlobUrl: () => createWorkletBlobUrl,
  pcm16ToFloat32: () => pcm16ToFloat32,
  uint8ArrayToBase64: () => uint8ArrayToBase64
});
module.exports = __toCommonJS(index_exports);

// src/EventEmitter.ts
var TypedEventEmitter = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.listeners.get(event).add(listener);
    return this;
  }
  off(event, listener) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }
  once(event, listener) {
    const onceListener = ((...args) => {
      this.off(event, onceListener);
      listener(...args);
    });
    return this.on(event, onceListener);
  }
  emit(event, ...args) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.size === 0) {
      return false;
    }
    eventListeners.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });
    return true;
  }
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
  listenerCount(event) {
    return this.listeners.get(event)?.size ?? 0;
  }
};

// src/AudioDeviceManager.ts
var AudioDeviceManager = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.devices = [];
    this.currentInputId = null;
    this.currentOutputId = null;
    this.pollInterval = null;
    this.permissionGranted = false;
    this.handleDeviceChange = async () => {
      await this.refreshDevices();
    };
    this.config = {
      autoFallback: config.autoFallback ?? true,
      pollInterval: config.pollInterval ?? 1e3
    };
  }
  /**
   * Initialize device manager and request permissions
   * Must be called from a user gesture (click/touch) for Safari/Firefox
   */
  async initialize() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error("MediaDevices API not supported in this browser");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.permissionGranted = true;
    } catch (error) {
      throw new Error(
        `Microphone permission denied: ${error.message}`
      );
    }
    await this.refreshDevices();
    this.startPolling();
    if (navigator.mediaDevices.ondevicechange !== void 0) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        this.handleDeviceChange
      );
    }
  }
  /**
   * Clean up resources
   */
  dispose() {
    this.stopPolling();
    if (navigator.mediaDevices.ondevicechange !== void 0) {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        this.handleDeviceChange
      );
    }
    this.removeAllListeners();
  }
  /**
   * Get all available audio devices
   */
  getDevices() {
    return [...this.devices];
  }
  /**
   * Get input (microphone) devices
   */
  getInputDevices() {
    return this.devices.filter((d) => d.kind === "audioinput");
  }
  /**
   * Get output (speaker) devices
   */
  getOutputDevices() {
    return this.devices.filter((d) => d.kind === "audiooutput");
  }
  /**
   * Get currently selected input device
   */
  getCurrentInput() {
    return this.devices.find((d) => d.deviceId === this.currentInputId) ?? null;
  }
  /**
   * Get currently selected output device
   */
  getCurrentOutput() {
    return this.devices.find((d) => d.deviceId === this.currentOutputId) ?? null;
  }
  /**
   * Set the input device
   */
  async setInputDevice(deviceId) {
    const device = this.devices.find(
      (d) => d.deviceId === deviceId && d.kind === "audioinput"
    );
    if (!device) {
      throw new Error(`Input device not found: ${deviceId}`);
    }
    this.currentInputId = deviceId;
    this.emit("input-changed", device);
  }
  /**
   * Set the output device
   * Note: Not supported in Safari - will fall back to default
   */
  async setOutputDevice(deviceId) {
    const device = this.devices.find(
      (d) => d.deviceId === deviceId && d.kind === "audiooutput"
    );
    if (!device) {
      throw new Error(`Output device not found: ${deviceId}`);
    }
    this.currentOutputId = deviceId;
    this.emit("output-changed", device);
  }
  /**
   * Check if output device selection is supported
   * (Not available in Safari)
   */
  isOutputSelectionSupported() {
    const audio = document.createElement("audio");
    return "setSinkId" in audio;
  }
  /**
   * Get the device ID to use for input
   */
  getInputDeviceId() {
    return this.currentInputId ?? void 0;
  }
  /**
   * Get the device ID to use for output
   */
  getOutputDeviceId() {
    return this.currentOutputId ?? void 0;
  }
  /**
   * Refresh the device list
   */
  async refreshDevices() {
    try {
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = rawDevices.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput").map((d, index) => this.mapDevice(d, index));
      const oldDeviceIds = new Set(this.devices.map((d) => d.deviceId));
      const newDeviceIds = new Set(audioDevices.map((d) => d.deviceId));
      for (const device of this.devices) {
        if (!newDeviceIds.has(device.deviceId)) {
          this.emit("device-disconnected", device);
          if (this.config.autoFallback) {
            if (device.deviceId === this.currentInputId) {
              const defaultInput = audioDevices.find(
                (d) => d.kind === "audioinput" && d.isDefault
              );
              this.currentInputId = defaultInput?.deviceId ?? null;
              this.emit("input-changed", defaultInput ?? null);
            }
            if (device.deviceId === this.currentOutputId) {
              const defaultOutput = audioDevices.find(
                (d) => d.kind === "audiooutput" && d.isDefault
              );
              this.currentOutputId = defaultOutput?.deviceId ?? null;
              this.emit("output-changed", defaultOutput ?? null);
            }
          }
        }
      }
      const hasChanged = this.devices.length !== audioDevices.length || audioDevices.some((d) => !oldDeviceIds.has(d.deviceId));
      this.devices = audioDevices;
      if (hasChanged) {
        this.emit("devices-changed", this.devices);
      }
    } catch (error) {
      this.emit("error", error);
    }
  }
  mapDevice(device, index) {
    const label = device.label || `${device.kind === "audioinput" ? "Microphone" : "Speaker"} ${index + 1}`;
    return {
      deviceId: device.deviceId,
      label,
      kind: device.kind,
      isDefault: device.deviceId === "default" || label.toLowerCase().includes("default")
    };
  }
  startPolling() {
    this.pollInterval = window.setInterval(() => {
      this.refreshDevices();
    }, this.config.pollInterval);
  }
  stopPolling() {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
};

// src/audio-worklet-processor.ts
var js = String.raw;
var audioWorkletProcessorCode = js`
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    
    // Accumulate samples into buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];
      
      if (this.bufferIndex >= this.bufferSize) {
        // Send buffer to main thread
        this.port.postMessage({
          type: 'audio',
          buffer: this.buffer.slice(),
        });
        this.bufferIndex = 0;
      }
    }

    // Calculate RMS level for this frame
    let sum = 0;
    for (let i = 0; i < inputChannel.length; i++) {
      sum += inputChannel[i] * inputChannel[i];
    }
    const level = Math.sqrt(sum / inputChannel.length);
    
    this.port.postMessage({
      type: 'level',
      level: level,
    });

    return true;
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
`;
function createWorkletBlobUrl() {
  const blob = new Blob([audioWorkletProcessorCode], {
    type: "application/javascript"
  });
  return URL.createObjectURL(blob);
}

// src/MicrophoneCapture.ts
var MicrophoneCapture = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.processorNode = null;
    this.analyzerNode = null;
    this.isCapturing = false;
    this.useWorklet = false;
    this.workletBlobUrl = null;
    // For resampling
    this.inputSampleRate = 48e3;
    // Auto-restart on device issues
    this.autoRestart = true;
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    this.restartDelay = 500;
    this.handleTrackEnded = () => {
      console.warn("Audio track ended (device disconnected)");
      this.emit("device-lost");
      if (this.autoRestart && this.isCapturing) {
        this.handleAutoRestart();
      }
    };
    this.handleTrackMuted = () => {
      const track = this.mediaStream?.getAudioTracks()[0];
      if (track && track.readyState === "ended") {
        this.handleTrackEnded();
      }
    };
    this.handleAudioProcess = (event) => {
      if (!this.isCapturing) return;
      const inputData = event.inputBuffer.getChannelData(0);
      const level = this.calculateLevel(inputData);
      this.emit("level", level);
      const outputData = this.resample(inputData);
      const pcmData = this.floatTo16BitPCM(outputData);
      this.emit("data", pcmData.buffer);
    };
    this.config = {
      sampleRate: config.sampleRate ?? 16e3,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
      deviceId: config.deviceId ?? "",
      bufferSize: config.bufferSize ?? 2048
    };
  }
  /**
   * Enable or disable auto-restart on device issues
   */
  setAutoRestart(enabled) {
    this.autoRestart = enabled;
  }
  /**
   * Check if AudioWorklet is supported
   */
  isWorkletSupported() {
    return typeof AudioWorkletNode !== "undefined" && typeof AudioContext !== "undefined" && "audioWorklet" in AudioContext.prototype;
  }
  /**
   * Start capturing microphone audio
   * Must be called from a user gesture on Safari/Firefox
   */
  async start() {
    if (this.isCapturing) {
      return;
    }
    this.restartAttempts = 0;
    await this.startInternal();
  }
  async startInternal() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API not supported");
      }
      this.audioContext = new AudioContextClass();
      this.inputSampleRate = this.audioContext.sampleRate;
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      const constraints = {
        audio: {
          deviceId: this.config.deviceId ? { exact: this.config.deviceId } : void 0,
          echoCancellation: { ideal: this.config.echoCancellation },
          noiseSuppression: { ideal: this.config.noiseSuppression },
          autoGainControl: { ideal: this.config.autoGainControl }
        }
      };
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => this.handleTrackEnded();
        audioTrack.onmute = () => this.handleTrackMuted();
      }
      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      this.analyzerNode = this.audioContext.createAnalyser();
      this.analyzerNode.fftSize = 256;
      this.analyzerNode.smoothingTimeConstant = 0.3;
      if (this.isWorkletSupported()) {
        try {
          await this.setupWorkletNode();
          this.useWorklet = true;
        } catch {
          console.warn(
            "AudioWorklet setup failed, falling back to ScriptProcessorNode"
          );
          this.setupScriptProcessorNode();
          this.useWorklet = false;
        }
      } else {
        this.setupScriptProcessorNode();
        this.useWorklet = false;
      }
      this.isCapturing = true;
      this.emit("start");
    } catch (error) {
      this.cleanup();
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }
  async setupWorkletNode() {
    if (!this.audioContext || !this.sourceNode || !this.analyzerNode) {
      throw new Error("Audio context not ready");
    }
    if (!this.workletBlobUrl) {
      this.workletBlobUrl = createWorkletBlobUrl();
    }
    await this.audioContext.audioWorklet.addModule(this.workletBlobUrl);
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "microphone-processor"
    );
    this.workletNode.port.onmessage = (event) => {
      if (!this.isCapturing) return;
      if (event.data.type === "audio") {
        const floatData = event.data.buffer;
        const resampledData = this.resample(floatData);
        const pcmData = this.floatTo16BitPCM(resampledData);
        this.emit("data", pcmData.buffer);
      } else if (event.data.type === "level") {
        this.emit("level", event.data.level);
      }
    };
    this.sourceNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }
  setupScriptProcessorNode() {
    if (!this.audioContext || !this.sourceNode || !this.analyzerNode) {
      throw new Error("Audio context not ready");
    }
    this.processorNode = this.audioContext.createScriptProcessor(
      this.config.bufferSize,
      1,
      // mono input
      1
      // mono output
    );
    this.processorNode.onaudioprocess = this.handleAudioProcess;
    this.sourceNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }
  async handleAutoRestart() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error("Max restart attempts reached");
      this.emit(
        "error",
        new Error("Device lost and could not reconnect after multiple attempts")
      );
      this.stop();
      return;
    }
    this.restartAttempts++;
    this.emit("restarting");
    this.cleanupInternal();
    await new Promise((resolve) => setTimeout(resolve, this.restartDelay));
    try {
      const previousDeviceId = this.config.deviceId;
      this.config.deviceId = "";
      await this.startInternal();
      if (previousDeviceId) {
        this.emit("device-changed", "default");
      }
    } catch (error) {
      console.error("Failed to restart after device loss:", error);
      this.handleAutoRestart();
    }
  }
  /**
   * Stop capturing microphone audio
   */
  stop() {
    if (!this.isCapturing) {
      return;
    }
    this.cleanup();
    this.isCapturing = false;
    this.emit("stop");
  }
  /**
   * Check if currently capturing
   */
  isActive() {
    return this.isCapturing;
  }
  /**
   * Change the input device
   * Will seamlessly restart capture with new device
   */
  async setDevice(deviceId) {
    const wasCapturing = this.isCapturing;
    this.config.deviceId = deviceId;
    if (wasCapturing) {
      this.emit("restarting");
      this.cleanupInternal();
      await this.startInternal();
      this.emit("device-changed", deviceId);
    }
  }
  /**
   * Get the current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration
   */
  async updateConfig(config) {
    const needsRestart = this.isCapturing && (config.deviceId !== void 0 || config.echoCancellation !== void 0 || config.noiseSuppression !== void 0 || config.autoGainControl !== void 0);
    Object.assign(this.config, config);
    if (needsRestart) {
      this.emit("restarting");
      this.cleanupInternal();
      await this.startInternal();
    }
  }
  /**
   * Get the analyzer node for external visualization
   */
  getAnalyzerNode() {
    return this.analyzerNode;
  }
  /**
   * Get current audio context sample rate
   */
  getInputSampleRate() {
    return this.inputSampleRate;
  }
  /**
   * Get target output sample rate
   */
  getOutputSampleRate() {
    return this.config.sampleRate;
  }
  /**
   * Check if using AudioWorklet (vs deprecated ScriptProcessorNode)
   */
  isUsingWorklet() {
    return this.useWorklet;
  }
  calculateLevel(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }
  resample(input) {
    const inputRate = this.inputSampleRate;
    const outputRate = this.config.sampleRate;
    if (inputRate === outputRate) {
      return input;
    }
    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    return output;
  }
  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return output;
  }
  cleanupInternal() {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.stop();
      });
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {
      });
    }
    this.audioContext = null;
  }
  cleanup() {
    this.cleanupInternal();
    if (this.workletBlobUrl) {
      URL.revokeObjectURL(this.workletBlobUrl);
      this.workletBlobUrl = null;
    }
  }
};
var AudioFormatConverter = class _AudioFormatConverter {
  /**
   * Convert Float32Array to specified bit depth
   */
  static floatToPCM(input, bitDepth) {
    switch (bitDepth) {
      case 8:
        return _AudioFormatConverter.floatTo8Bit(input).buffer;
      case 16:
        return _AudioFormatConverter.floatTo16Bit(input).buffer;
      case 24:
        return _AudioFormatConverter.floatTo24Bit(input);
      case 32:
        return _AudioFormatConverter.floatTo32Bit(input).buffer;
      default:
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
    }
  }
  /**
   * Convert PCM data to Float32Array
   */
  static pcmToFloat(input, bitDepth) {
    switch (bitDepth) {
      case 8:
        return _AudioFormatConverter.int8ToFloat(new Int8Array(input));
      case 16:
        return _AudioFormatConverter.int16ToFloat(new Int16Array(input));
      case 24:
        return _AudioFormatConverter.int24ToFloat(input);
      case 32:
        return _AudioFormatConverter.int32ToFloat(new Int32Array(input));
      default:
        throw new Error(`Unsupported bit depth: ${bitDepth}`);
    }
  }
  static floatTo8Bit(input) {
    const output = new Int8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s * 127;
    }
    return output;
  }
  static floatTo16Bit(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return output;
  }
  static floatTo24Bit(input) {
    const output = new ArrayBuffer(input.length * 3);
    const view = new DataView(output);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      const val = s < 0 ? s * 8388608 : s * 8388607;
      const intVal = Math.floor(val);
      view.setUint8(i * 3, intVal & 255);
      view.setUint8(i * 3 + 1, intVal >> 8 & 255);
      view.setUint8(i * 3 + 2, intVal >> 16 & 255);
    }
    return output;
  }
  static floatTo32Bit(input) {
    const output = new Int32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 2147483648 : s * 2147483647;
    }
    return output;
  }
  static int8ToFloat(input) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 127;
    }
    return output;
  }
  static int16ToFloat(input) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] < 0 ? input[i] / 32768 : input[i] / 32767;
    }
    return output;
  }
  static int24ToFloat(input) {
    const view = new DataView(input);
    const numSamples = input.byteLength / 3;
    const output = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      let val = view.getUint8(i * 3) | view.getUint8(i * 3 + 1) << 8 | view.getUint8(i * 3 + 2) << 16;
      if (val & 8388608) {
        val |= 4278190080;
      }
      output[i] = val < 0 ? val / 8388608 : val / 8388607;
    }
    return output;
  }
  static int32ToFloat(input) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] < 0 ? input[i] / 2147483648 : input[i] / 2147483647;
    }
    return output;
  }
};

// src/AudioPlayback.ts
var AudioPlayback = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.audioContext = null;
    this.gainNode = null;
    this.analyzerNode = null;
    this.audioElement = null;
    this.mediaStreamDestination = null;
    this.audioQueue = [];
    this.currentSource = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    // For buffer management
    this.bufferCheckInterval = null;
    this.lowBufferThreshold = 0.5;
    // seconds
    // Turn management
    this.currentTurnId = null;
    this.currentSourceTurnId = null;
    this.config = {
      sampleRate: config.sampleRate ?? 16e3,
      bitDepth: config.bitDepth ?? 16,
      channels: config.channels ?? 1,
      deviceId: config.deviceId ?? "",
      bufferAhead: config.bufferAhead ?? 0.1
    };
  }
  /**
   * Initialize the audio playback system
   *
   * Note: Unlike microphone access, AudioContext playback does NOT require
   * a user gesture at the exact moment of initialization. It only requires
   * that SOME user interaction has occurred on the page at some point.
   *
   * In typical conversational AI apps, the user will have clicked a button
   * to connect/start, which satisfies the browser's autoplay policy.
   *
   * If you're creating playback before any user interaction, the AudioContext
   * will start in 'suspended' state and will auto-resume when audio is queued
   * (assuming a user interaction has occurred by then).
   */
  async initialize() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API not supported");
    }
    this.audioContext = new AudioContextClass();
    console.log("[AudioPlayback] AudioContext created, state:", this.audioContext.state, "sampleRate:", this.audioContext.sampleRate);
    if (this.audioContext.state === "suspended") {
      console.log("[AudioPlayback] AudioContext suspended, attempting initial resume...");
      this.audioContext.resume().then(() => {
        console.log("[AudioPlayback] Initial resume succeeded, state:", this.audioContext?.state);
      }).catch((err) => {
        console.log("[AudioPlayback] Initial resume failed (expected if no user gesture):", err);
      });
    }
    this.audioContext.addEventListener("statechange", () => {
      if (this.audioContext?.state === "running" && this.audioQueue.length > 0 && !this.isPlaying && !this.isPaused) {
        this.playNext();
      }
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1;
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 256;
    this.analyzerNode.smoothingTimeConstant = 0.3;
    if (this.supportsOutputSelection() && this.config.deviceId) {
      this.setupAudioElementOutput();
    } else {
      this.gainNode.connect(this.analyzerNode);
      this.analyzerNode.connect(this.audioContext.destination);
    }
    this.startBufferMonitoring();
  }
  /**
   * Check if the AudioContext is ready to play audio
   */
  isReady() {
    return this.audioContext !== null && this.audioContext.state === "running";
  }
  /**
   * Get the current AudioContext state
   */
  getState() {
    return this.audioContext?.state ?? null;
  }
  /**
   * Manually ensure the AudioContext is running.
   * Call this from a user gesture if you need to pre-warm the context.
   *
   * IMPORTANT for iOS: This method should be called directly from a user
   * gesture (click/touch) to unlock audio playback. iOS Safari requires
   * audio to be initiated from user interaction.
   */
  async ensureRunning() {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    if (this.audioElement && this.audioElement.paused) {
      try {
        await this.audioElement.play();
      } catch {
      }
    }
  }
  /**
   * Unlock audio playback on iOS.
   *
   * iOS Safari requires audio to be "unlocked" by playing audio directly
   * in response to a user gesture (click/touch). Call this method from
   * your click/touch handler before attempting to play audio.
   *
   * This plays a tiny silent buffer which unlocks the audio system,
   * allowing subsequent programmatic audio playback.
   *
   * @example
   * ```typescript
   * button.addEventListener('click', async () => {
   *   await playback.unlockAudio();
   *   // Now audio will work even from non-user-gesture contexts
   * });
   * ```
   */
  async unlockAudio() {
    if (!this.audioContext) {
      throw new Error("AudioPlayback not initialized");
    }
    console.log("[AudioPlayback] unlockAudio called, state:", this.audioContext.state);
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
        console.log("[AudioPlayback] AudioContext resumed, new state:", this.audioContext.state);
      } catch (err) {
        console.error("[AudioPlayback] Failed to resume AudioContext:", err);
        throw err;
      }
    }
    const buffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
    console.log("[AudioPlayback] Silent buffer played for iOS unlock");
    if (this.audioElement && this.audioElement.paused) {
      try {
        await this.audioElement.play();
        console.log("[AudioPlayback] Audio element started");
      } catch (err) {
        console.warn("[AudioPlayback] Audio element play failed (may be expected):", err);
      }
    }
    console.log("[AudioPlayback] unlockAudio complete, final state:", this.audioContext.state);
  }
  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    this.stopBufferMonitoring();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    if (this.mediaStreamDestination) {
      this.mediaStreamDestination.disconnect();
      this.mediaStreamDestination = null;
    }
    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {
      });
    }
    this.audioContext = null;
    this.audioQueue = [];
    this.removeAllListeners();
  }
  /**
   * Queue audio data for playback
   * @param data - PCM audio data (raw bytes)
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queueAudio(data, turnId) {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      console.log("[AudioPlayback] Ignoring audio for old turn:", turnId);
      return;
    }
    console.log("[AudioPlayback] queueAudio called, bytes:", data.byteLength, "state:", this.audioContext.state);
    if (this.audioContext.state === "suspended") {
      console.warn("[AudioPlayback] AudioContext is suspended, attempting resume...");
      try {
        await this.audioContext.resume();
        console.log("[AudioPlayback] AudioContext resumed successfully, state:", this.audioContext.state);
      } catch (err) {
        console.warn(
          "[AudioPlayback] AudioContext suspended - audio queued but won't play until user interaction. Error:",
          err
        );
      }
    }
    const audioBuffer = this.createAudioBuffer(data);
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );
    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;
    if (!this.isPlaying && !this.isPaused && this.audioContext.state === "running") {
      this.playNext();
    }
  }
  /**
   * Queue PCM16 audio data for playback
   * Convenience method that handles conversion from 16-bit PCM internally.
   * @param data - PCM16 audio data (16-bit signed integer, little-endian)
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queuePcm16(data, turnId) {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      console.log("[AudioPlayback] Ignoring PCM16 audio for old turn:", turnId);
      return;
    }
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {
      }
    }
    const floatData = Float32Array.from(
      new Int16Array(data),
      (x) => x / 32768
    );
    const numSamples = floatData.length / this.config.channels;
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channels,
      numSamples,
      this.config.sampleRate
    );
    if (this.config.channels === 1) {
      audioBuffer.getChannelData(0).set(floatData);
    } else {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < numSamples; i++) {
        left[i] = floatData[i * 2];
        right[i] = floatData[i * 2 + 1];
      }
    }
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );
    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;
    if (!this.isPlaying && !this.isPaused && this.audioContext.state === "running") {
      this.playNext();
    }
  }
  /**
   * Queue pre-decoded AudioBuffer for playback
   * @param audioBuffer - Pre-decoded AudioBuffer
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queueAudioBuffer(audioBuffer, turnId) {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      return;
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );
    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;
    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }
  /**
   * Stop playback and clear queue
   */
  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.currentSourceTurnId = null;
    this.emit("stop");
  }
  // ==================== Turn Management ====================
  /**
   * Set the current turn ID. Audio from other turns will be ignored.
   * @param turnId - The turn ID to set as current, or null to clear
   */
  setCurrentTurn(turnId) {
    this.currentTurnId = turnId;
  }
  /**
   * Get the current turn ID
   */
  getCurrentTurn() {
    return this.currentTurnId;
  }
  /**
   * Interrupt the current turn: stop playback, clear buffer, and optionally set a new turn
   * @param newTurnId - Optional new turn ID to set after interruption
   * @returns The interrupted turn ID (if any)
   */
  interruptTurn(newTurnId) {
    const interruptedTurnId = this.currentTurnId;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.currentSourceTurnId = null;
    if (newTurnId !== void 0) {
      this.currentTurnId = newTurnId;
    }
    if (interruptedTurnId) {
      this.emit("turn-interrupted", interruptedTurnId);
    }
    this.emit("stop");
    return interruptedTurnId;
  }
  /**
   * Clear audio buffer for a specific turn (or all if no turnId provided)
   * Does not stop currently playing audio unless it's from the specified turn
   * @param turnId - The turn ID to clear, or undefined to clear all
   */
  clearTurnBuffer(turnId) {
    if (turnId === void 0) {
      this.audioQueue = [];
      this.nextPlayTime = this.audioContext?.currentTime ?? 0;
    } else {
      this.audioQueue = this.audioQueue.filter(
        (item) => item.turnId !== turnId
      );
      if (this.audioQueue.length > 0) {
        const lastItem = this.audioQueue[this.audioQueue.length - 1];
        this.nextPlayTime = lastItem.startTime + lastItem.buffer.duration;
      } else {
        this.nextPlayTime = this.audioContext?.currentTime ?? 0;
      }
      if (this.currentSourceTurnId === turnId && this.currentSource) {
        try {
          this.currentSource.stop();
        } catch {
        }
        this.currentSource.disconnect();
        this.currentSource = null;
        this.playNext();
      }
    }
  }
  /**
   * Check if audio for a specific turn should be accepted
   * @param turnId - The turn ID to check
   */
  shouldAcceptTurn(turnId) {
    return this.currentTurnId === null || this.currentTurnId === turnId;
  }
  /**
   * Get the number of queued items for a specific turn
   */
  getQueuedCountForTurn(turnId) {
    return this.audioQueue.filter((item) => item.turnId === turnId).length;
  }
  /**
   * Get buffered duration for a specific turn
   */
  getBufferedDurationForTurn(turnId) {
    return this.audioQueue.filter((item) => item.turnId === turnId).reduce((sum, item) => sum + item.buffer.duration, 0);
  }
  /**
   * Pause playback
   */
  pause() {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.suspend();
      this.isPaused = true;
    }
  }
  /**
   * Resume playback
   */
  async resume() {
    if (this.audioContext && this.isPaused) {
      await this.audioContext.resume();
      this.isPaused = false;
    }
  }
  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  /**
   * Get current volume
   */
  getVolume() {
    return this.gainNode?.gain.value ?? 1;
  }
  /**
   * Check if currently playing
   */
  isActive() {
    return this.isPlaying && !this.isPaused;
  }
  /**
   * Get buffered audio duration in seconds
   */
  getBufferedDuration() {
    return this.audioQueue.reduce((sum, item) => sum + item.buffer.duration, 0);
  }
  /**
   * Set output device (not supported in Safari)
   */
  async setOutputDevice(deviceId) {
    this.config.deviceId = deviceId;
    if (!this.supportsOutputSelection()) {
      console.warn(
        "Output device selection not supported in this browser (Safari)"
      );
      return;
    }
    if (this.audioElement) {
      try {
        await this.audioElement.setSinkId(deviceId);
      } catch (error) {
        this.emit(
          "error",
          new Error(`Failed to set output device: ${error.message}`)
        );
      }
    }
  }
  /**
   * Check if output device selection is supported
   */
  supportsOutputSelection() {
    const audio = document.createElement("audio");
    return "setSinkId" in audio;
  }
  /**
   * Get the analyzer node for external visualization
   */
  getAnalyzerNode() {
    return this.analyzerNode;
  }
  /**
   * Update audio format configuration
   */
  updateFormat(config) {
    if (config.sampleRate !== void 0)
      this.config.sampleRate = config.sampleRate;
    if (config.bitDepth !== void 0) this.config.bitDepth = config.bitDepth;
    if (config.channels !== void 0) this.config.channels = config.channels;
  }
  setupAudioElementOutput() {
    if (!this.audioContext || !this.gainNode || !this.analyzerNode) return;
    this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
    this.gainNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.mediaStreamDestination);
    this.audioElement = document.createElement("audio");
    this.audioElement.srcObject = this.mediaStreamDestination.stream;
    this.audioElement.autoplay = true;
    this.audioElement.setAttribute("playsinline", "true");
    this.audioElement.setAttribute("webkit-playsinline", "true");
    this.audioElement.play().catch(() => {
    });
    if (this.config.deviceId && "setSinkId" in this.audioElement) {
      this.audioElement.setSinkId(this.config.deviceId).catch((err) => {
        console.warn("Failed to set output device:", err);
      });
    }
  }
  createAudioBuffer(data) {
    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }
    const floatData = AudioFormatConverter.pcmToFloat(
      data,
      this.config.bitDepth
    );
    const numSamples = floatData.length / this.config.channels;
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channels,
      numSamples,
      this.config.sampleRate
    );
    if (this.config.channels === 1) {
      audioBuffer.getChannelData(0).set(floatData);
    } else {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < numSamples; i++) {
        left[i] = floatData[i * 2];
        right[i] = floatData[i * 2 + 1];
      }
    }
    return audioBuffer;
  }
  playNext() {
    if (!this.audioContext || !this.gainNode || this.audioQueue.length === 0) {
      if (this.isPlaying) {
        console.log("[AudioPlayback] playNext: queue empty, playback ended");
        this.isPlaying = false;
        this.currentSourceTurnId = null;
        this.emit("ended");
        this.emit("buffer-empty");
      }
      return;
    }
    const { buffer, startTime, turnId } = this.audioQueue.shift();
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      console.log("[AudioPlayback] playNext: skipping old turn audio");
      this.playNext();
      return;
    }
    console.log("[AudioPlayback] playNext: playing buffer, duration:", buffer.duration.toFixed(3), "s, sampleRate:", buffer.sampleRate, "contextState:", this.audioContext.state);
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.gainNode);
    this.currentSourceTurnId = turnId ?? null;
    this.currentSource.onended = () => {
      console.log("[AudioPlayback] playNext: buffer ended, playing next");
      this.playNext();
    };
    const currentTime = this.audioContext.currentTime;
    const playAt = Math.max(startTime, currentTime);
    try {
      this.currentSource.start(playAt);
      console.log("[AudioPlayback] playNext: started at", playAt.toFixed(3), "currentTime:", currentTime.toFixed(3));
    } catch (err) {
      console.error("[AudioPlayback] playNext: failed to start source:", err);
    }
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.emit("start");
    }
    this.emitLevel();
  }
  emitLevel() {
    if (!this.analyzerNode || !this.isPlaying) return;
    const dataArray = new Float32Array(this.analyzerNode.frequencyBinCount);
    this.analyzerNode.getFloatTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const level = Math.sqrt(sum / dataArray.length);
    this.emit("level", level);
  }
  startBufferMonitoring() {
    this.bufferCheckInterval = window.setInterval(() => {
      const buffered = this.getBufferedDuration();
      if (this.isPlaying && buffered < this.lowBufferThreshold && buffered > 0) {
        this.emit("buffer-low");
      }
    }, 100);
  }
  stopBufferMonitoring() {
    if (this.bufferCheckInterval !== null) {
      clearInterval(this.bufferCheckInterval);
      this.bufferCheckInterval = null;
    }
  }
};

// src/WebSocketBridge.ts
var WebSocketBridge = class extends TypedEventEmitter {
  constructor(config) {
    super();
    this.ws = null;
    this.state = "disconnected";
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.lastPongTime = 0;
    this.intentionalClose = false;
    // Buffer for outgoing audio when disconnected
    this.sendBuffer = [];
    this.maxSendBufferSize = 50;
    this.config = {
      url: config.url,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1e3,
      sendFormat: config.sendFormat ?? {
        sampleRate: 16e3,
        bitDepth: 16,
        channels: 1
      },
      receiveFormat: config.receiveFormat ?? {
        sampleRate: 16e3,
        bitDepth: 16,
        channels: 1
      },
      binaryMode: config.binaryMode ?? true,
      wrapOutgoingAudio: config.wrapOutgoingAudio,
      parseIncomingAudio: config.parseIncomingAudio
    };
  }
  /**
   * Get current connection state
   */
  getState() {
    return this.state;
  }
  /**
   * Check if connected
   */
  isConnected() {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }
  /**
   * Connect to the WebSocket server
   */
  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    this.intentionalClose = false;
    this.setState("connecting");
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        this.ws.binaryType = "arraybuffer";
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error("Connection timeout"));
          }
        }, 1e4);
        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.handleOpen();
          resolve();
        };
        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.handleClose(event);
        };
        this.ws.onerror = (event) => {
          clearTimeout(connectionTimeout);
          this.handleError(event);
          if (this.state === "connecting") {
            reject(new Error("Connection failed"));
          }
        };
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        this.setState("error");
        reject(error);
      }
    });
  }
  /**
   * Disconnect from the server
   */
  disconnect() {
    this.intentionalClose = true;
    this.stopReconnecting();
    this.stopPing();
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1e3, "Client disconnecting");
      }
      this.ws = null;
    }
    this.sendBuffer = [];
    this.setState("disconnected");
  }
  /**
   * Send audio data to the server
   */
  sendAudio(data) {
    if (!this.isConnected()) {
      if (this.sendBuffer.length < this.maxSendBufferSize) {
        this.sendBuffer.push(data);
      }
      return;
    }
    try {
      let payload;
      if (this.config.wrapOutgoingAudio) {
        payload = this.config.wrapOutgoingAudio(data);
      } else if (this.config.binaryMode) {
        payload = data;
      } else {
        payload = JSON.stringify({
          type: "audio",
          data: this.arrayBufferToBase64(data),
          format: this.config.sendFormat
        });
      }
      this.ws.send(payload);
    } catch (error) {
      this.emit("error", error);
    }
  }
  /**
   * Send a non-audio message to the server
   */
  sendMessage(message) {
    if (!this.isConnected()) {
      console.warn("Cannot send message: not connected");
      return;
    }
    try {
      const payload = typeof message === "string" ? message : JSON.stringify(message);
      this.ws.send(payload);
    } catch (error) {
      this.emit("error", error);
    }
  }
  /**
   * Update the WebSocket URL (will reconnect if connected)
   */
  async setUrl(url) {
    const wasConnected = this.isConnected();
    this.config.url = url;
    if (wasConnected) {
      this.disconnect();
      await this.connect();
    }
  }
  /**
   * Get send format configuration
   */
  getSendFormat() {
    return { ...this.config.sendFormat };
  }
  /**
   * Get receive format configuration
   */
  getReceiveFormat() {
    return { ...this.config.receiveFormat };
  }
  /**
   * Update audio format configurations
   */
  updateFormats(config) {
    if (config.sendFormat) {
      this.config.sendFormat = config.sendFormat;
    }
    if (config.receiveFormat) {
      this.config.receiveFormat = config.receiveFormat;
    }
  }
  handleOpen() {
    this.reconnectAttempts = 0;
    this.setState("connected");
    this.emit("connected");
    this.startPing();
    while (this.sendBuffer.length > 0 && this.isConnected()) {
      const data = this.sendBuffer.shift();
      this.sendAudio(data);
    }
  }
  handleClose(event) {
    this.stopPing();
    this.ws = null;
    this.emit("disconnected", event.code, event.reason || "Connection closed");
    if (!this.intentionalClose && this.config.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }
  handleError(event) {
    const error = new Error("WebSocket error");
    this.emit("error", error);
    if (this.state !== "reconnecting") {
      this.setState("error");
    }
  }
  handleMessage(event) {
    try {
      if (this.config.parseIncomingAudio) {
        const result = this.config.parseIncomingAudio(event);
        if (result) {
          if (result instanceof ArrayBuffer) {
            this.emit("audio", result);
          } else if (typeof result === "object" && "data" in result) {
            const parsed = result;
            this.emit("audio", parsed.data, parsed.turnId);
          }
          return;
        }
        this.emitNonAudioMessage(event.data);
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        this.emit("audio", event.data);
        return;
      }
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "audio" && parsed.data) {
            const audioData = this.base64ToArrayBuffer(parsed.data);
            this.emit("audio", audioData, parsed.turnId);
            return;
          }
          if (parsed.type === "pong") {
            this.lastPongTime = Date.now();
            return;
          }
          this.emit("message", parsed);
        } catch {
          this.emit("message", event.data);
        }
        return;
      }
      if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            this.emit("audio", reader.result);
          }
        };
        reader.readAsArrayBuffer(event.data);
        return;
      }
      this.emit("message", event.data);
    } catch (error) {
      this.emit("error", error);
    }
  }
  emitNonAudioMessage(data) {
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        this.emit("message", parsed);
      } catch {
        this.emit("message", data);
      }
    } else {
      this.emit("message", data);
    }
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.setState("error");
      this.emit("error", new Error("Max reconnection attempts reached"));
      return;
    }
    this.setState("reconnecting");
    this.reconnectAttempts++;
    this.emit("reconnecting", this.reconnectAttempts);
    const baseDelay = this.config.reconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1e3;
    const delay = Math.min(exponentialDelay + jitter, 3e4);
    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        await this.connect();
      } catch {
      }
    }, delay);
  }
  stopReconnecting() {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
  }
  startPing() {
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws.send(
            JSON.stringify({ type: "ping", timestamp: Date.now() })
          );
        } catch {
        }
      }
    }, 3e4);
  }
  stopPing() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.emit("state-change", state);
    }
  }
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
};

// src/ActivityAnalyzer.ts
var ActivityAnalyzer = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.analyzerNode = null;
    this.animationFrameId = null;
    this.intervalId = null;
    this.isRunning = false;
    // For speaking detection
    this.isSpeaking = false;
    this.speakingThreshold = 0.02;
    // RMS threshold
    this.silenceTimeout = 300;
    // ms of silence before speaking ends
    this.lastSoundTime = 0;
    this.peakLevel = 0;
    this.peakDecay = 0.95;
    // Peak decay rate per frame
    // Buffers for visualization data
    this.frequencyData = null;
    this.timeDomainData = null;
    this.config = {
      fftSize: config.fftSize ?? 256,
      smoothingTimeConstant: config.smoothingTimeConstant ?? 0.8,
      updateInterval: config.updateInterval ?? 50
    };
  }
  /**
   * Set the speaking detection threshold (0-1)
   */
  setSpeakingThreshold(threshold) {
    this.speakingThreshold = Math.max(1e-3, Math.min(0.5, threshold));
  }
  /**
   * Get current speaking threshold
   */
  getSpeakingThreshold() {
    return this.speakingThreshold;
  }
  /**
   * Set the silence timeout in milliseconds
   */
  setSilenceTimeout(ms) {
    this.silenceTimeout = Math.max(100, Math.min(2e3, ms));
  }
  /**
   * Connect to an AnalyserNode for monitoring
   */
  connect(analyzerNode) {
    this.analyzerNode = analyzerNode;
    this.analyzerNode.fftSize = this.config.fftSize;
    this.analyzerNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
    const binCount = this.analyzerNode.frequencyBinCount;
    this.frequencyData = new Uint8Array(binCount);
    this.timeDomainData = new Uint8Array(binCount);
  }
  /**
   * Disconnect from the current analyzer node
   */
  disconnect() {
    this.stop();
    this.analyzerNode = null;
    this.frequencyData = null;
    this.timeDomainData = null;
  }
  /**
   * Start analyzing and emitting activity events
   */
  start() {
    if (this.isRunning || !this.analyzerNode) {
      return;
    }
    this.isRunning = true;
    this.peakLevel = 0;
    if (typeof window !== "undefined" && this.config.updateInterval <= 20) {
      this.startWithAnimationFrame();
    } else {
      this.startWithInterval();
    }
  }
  /**
   * Stop analyzing
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.emit("speaking-stop");
    }
  }
  /**
   * Check if currently running
   */
  isActive() {
    return this.isRunning;
  }
  /**
   * Get current activity data synchronously
   */
  getActivityData() {
    if (!this.analyzerNode || !this.frequencyData || !this.timeDomainData) {
      return null;
    }
    return this.analyze();
  }
  /**
   * Get the frequency data for custom visualization
   */
  getFrequencyData() {
    if (!this.analyzerNode || !this.frequencyData) {
      return null;
    }
    this.analyzerNode.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }
  /**
   * Get the time domain data for waveform visualization
   */
  getTimeDomainData() {
    if (!this.analyzerNode || !this.timeDomainData) {
      return null;
    }
    this.analyzerNode.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }
  /**
   * Get normalized frequency bands for bar visualization
   * @param numBands - Number of frequency bands to return
   */
  getFrequencyBands(numBands = 8) {
    const freqData = this.getFrequencyData();
    if (!freqData) {
      return new Array(numBands).fill(0);
    }
    const bands = [];
    const bandSize = Math.floor(freqData.length / numBands);
    for (let i = 0; i < numBands; i++) {
      let sum = 0;
      const start = i * bandSize;
      const end = start + bandSize;
      for (let j = start; j < end && j < freqData.length; j++) {
        sum += freqData[j];
      }
      bands.push(sum / bandSize / 255);
    }
    return bands;
  }
  startWithAnimationFrame() {
    let lastUpdate = 0;
    const minInterval = this.config.updateInterval;
    const update = (timestamp) => {
      if (!this.isRunning) return;
      if (timestamp - lastUpdate >= minInterval) {
        this.updateAndEmit();
        lastUpdate = timestamp;
      }
      this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }
  startWithInterval() {
    this.intervalId = window.setInterval(() => {
      if (this.isRunning) {
        this.updateAndEmit();
      }
    }, this.config.updateInterval);
  }
  updateAndEmit() {
    const data = this.analyze();
    if (data) {
      this.emit("activity", data);
    }
  }
  analyze() {
    if (!this.analyzerNode || !this.frequencyData || !this.timeDomainData) {
      return null;
    }
    this.analyzerNode.getByteFrequencyData(this.frequencyData);
    this.analyzerNode.getByteTimeDomainData(this.timeDomainData);
    let sum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const sample = (this.timeDomainData[i] - 128) / 128;
      sum += sample * sample;
    }
    const volume = Math.sqrt(sum / this.timeDomainData.length);
    if (volume > this.peakLevel) {
      this.peakLevel = volume;
    } else {
      this.peakLevel *= this.peakDecay;
    }
    const now = Date.now();
    const wasSpeaking = this.isSpeaking;
    if (volume > this.speakingThreshold) {
      this.lastSoundTime = now;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.emit("speaking-start");
      }
    } else if (this.isSpeaking && now - this.lastSoundTime > this.silenceTimeout) {
      this.isSpeaking = false;
      this.emit("speaking-stop");
    }
    return {
      volume,
      peak: this.peakLevel,
      frequencyData: this.frequencyData,
      timeDomainData: this.timeDomainData,
      isSpeaking: this.isSpeaking
    };
  }
};
var VisualizationUtils = class {
  /**
   * Smooth array values over time (for animations)
   */
  static smoothArray(current, target, smoothing = 0.3) {
    return current.map((val, i) => val + (target[i] - val) * smoothing);
  }
  /**
   * Convert frequency data to logarithmic scale (better for music/speech)
   */
  static toLogScale(data, outputSize) {
    const result = [];
    const logMax = Math.log(data.length);
    for (let i = 0; i < outputSize; i++) {
      const logIndex = Math.exp(i / outputSize * logMax);
      const index = Math.min(Math.floor(logIndex), data.length - 1);
      result.push(data[index] / 255);
    }
    return result;
  }
  /**
   * Get a CSS color based on volume level
   */
  static volumeToColor(volume, colors) {
    if (volume < 0.3) return colors.low;
    if (volume < 0.7) return colors.mid;
    return colors.high;
  }
  /**
   * Convert volume to decibels
   */
  static volumeToDb(volume) {
    if (volume === 0) return -Infinity;
    return 20 * Math.log10(volume);
  }
  /**
   * Create a simple waveform path for SVG
   */
  static createWaveformPath(timeDomainData, width, height) {
    const sliceWidth = width / timeDomainData.length;
    let path = "M 0 " + height / 2;
    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 255;
      const y = v * height;
      const x = i * sliceWidth;
      path += ` L ${x} ${y}`;
    }
    return path;
  }
  /**
   * Create bar heights for frequency visualization
   */
  static createBarHeights(frequencyData, numBars, maxHeight) {
    const heights = [];
    const step = Math.floor(frequencyData.length / numBars);
    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;
      heights.push(average / 255 * maxHeight);
    }
    return heights;
  }
};

// src/Chatdio.ts
var Chatdio = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.websocket = null;
    this.isInitialized = false;
    this.isMicActive = false;
    // Turn management
    this.currentTurnId = null;
    this.turnCounter = 0;
    /**
     * Set microphone mute state (still captures but doesn't send)
     */
    this.micMuted = false;
    this.config = config;
    this.deviceManager = new AudioDeviceManager(config.deviceManager);
    this.microphone = new MicrophoneCapture(config.microphone);
    this.playback = new AudioPlayback(config.playback);
    this.micAnalyzer = new ActivityAnalyzer(config.activityAnalyzer);
    this.playbackAnalyzer = new ActivityAnalyzer(config.activityAnalyzer);
    if (config.websocket) {
      this.websocket = new WebSocketBridge(config.websocket);
    }
    this.setupEventForwarding();
  }
  /**
   * Initialize the audio system
   * Must be called from a user gesture (click/touch) for browser compatibility
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    try {
      await this.deviceManager.initialize();
      await this.playback.initialize();
      this.isInitialized = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("mic:error", err);
      throw err;
    }
  }
  /**
   * Clean up all resources
   */
  dispose() {
    this.stopMicrophone();
    this.stopPlayback();
    this.disconnectWebSocket();
    this.micAnalyzer.disconnect();
    this.playbackAnalyzer.disconnect();
    this.deviceManager.dispose();
    this.playback.dispose();
    this.removeAllListeners();
    this.isInitialized = false;
  }
  // ==================== Microphone Methods ====================
  /**
   * Start capturing microphone audio
   */
  async startMicrophone() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const inputDevice = this.deviceManager.getInputDeviceId();
    if (inputDevice) {
      await this.microphone.updateConfig({ deviceId: inputDevice });
    }
    await this.microphone.start();
    this.isMicActive = true;
    const analyzerNode = this.microphone.getAnalyzerNode();
    if (analyzerNode) {
      this.micAnalyzer.connect(analyzerNode);
      this.micAnalyzer.start();
    }
  }
  /**
   * Stop capturing microphone audio
   */
  stopMicrophone() {
    this.micAnalyzer.stop();
    this.microphone.stop();
    this.isMicActive = false;
  }
  /**
   * Check if microphone is active
   */
  isMicrophoneActive() {
    return this.microphone.isActive();
  }
  setMicrophoneMuted(muted) {
    this.micMuted = muted;
  }
  /**
   * Check if microphone is muted
   */
  isMicrophoneMuted() {
    return this.micMuted;
  }
  // ==================== Playback Methods ====================
  /**
   * Unlock audio playback on iOS.
   *
   * iOS Safari requires audio to be "unlocked" by playing audio directly
   * in response to a user gesture (click/touch). Call this method from
   * your click/touch handler before attempting to play audio.
   *
   * This plays a tiny silent buffer which unlocks the audio system,
   * allowing subsequent programmatic audio playback.
   *
   * @example
   * ```typescript
   * // Call from user interaction handler
   * startButton.addEventListener('click', async () => {
   *   await audio.unlockAudio();
   *   await audio.startConversation();
   * });
   * ```
   */
  async unlockAudio() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    await this.playback.unlockAudio();
  }
  /**
   * Queue audio data for playback
   * @param data - PCM audio data
   * @param turnId - Optional turn ID (uses current turn if not provided)
   */
  async playAudio(data, turnId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const effectiveTurnId = turnId ?? this.currentTurnId ?? void 0;
    await this.playback.queueAudio(data, effectiveTurnId);
    const analyzerNode = this.playback.getAnalyzerNode();
    if (analyzerNode && !this.playbackAnalyzer.isActive()) {
      this.playbackAnalyzer.connect(analyzerNode);
      this.playbackAnalyzer.start();
    }
  }
  /**
   * Stop playback and clear queue
   */
  stopPlayback() {
    this.playbackAnalyzer.stop();
    this.playback.stop();
  }
  /**
   * Pause playback
   */
  pausePlayback() {
    this.playback.pause();
  }
  /**
   * Resume playback
   */
  async resumePlayback() {
    await this.playback.resume();
  }
  /**
   * Check if playback is active
   */
  isPlaybackActive() {
    return this.playback.isActive();
  }
  /**
   * Set playback volume (0-1)
   */
  setVolume(volume) {
    this.playback.setVolume(volume);
  }
  /**
   * Get current volume
   */
  getVolume() {
    return this.playback.getVolume();
  }
  // ==================== WebSocket Methods ====================
  /**
   * Connect to WebSocket server
   */
  async connectWebSocket(url) {
    if (url && !this.websocket) {
      this.websocket = new WebSocketBridge({
        url,
        ...this.config.websocket
      });
      this.setupWebSocketEvents();
    }
    if (!this.websocket) {
      throw new Error("WebSocket not configured");
    }
    if (url) {
      await this.websocket.setUrl(url);
    }
    await this.websocket.connect();
  }
  /**
   * Disconnect from WebSocket server
   */
  disconnectWebSocket() {
    if (this.websocket) {
      this.websocket.disconnect();
    }
  }
  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected() {
    return this.websocket?.isConnected() ?? false;
  }
  /**
   * Get WebSocket connection state
   */
  getWebSocketState() {
    return this.websocket?.getState() ?? "disconnected";
  }
  /**
   * Send a message through WebSocket
   */
  sendMessage(message) {
    if (!this.websocket) {
      throw new Error("WebSocket not configured");
    }
    this.websocket.sendMessage(message);
  }
  // ==================== Device Methods ====================
  /**
   * Get all audio devices
   */
  getDevices() {
    return this.deviceManager.getDevices();
  }
  /**
   * Get input (microphone) devices
   */
  getInputDevices() {
    return this.deviceManager.getInputDevices();
  }
  /**
   * Get output (speaker) devices
   */
  getOutputDevices() {
    return this.deviceManager.getOutputDevices();
  }
  /**
   * Get currently selected input device
   */
  getCurrentInputDevice() {
    return this.deviceManager.getCurrentInput();
  }
  /**
   * Get currently selected output device
   */
  getCurrentOutputDevice() {
    return this.deviceManager.getCurrentOutput();
  }
  /**
   * Set input device
   */
  async setInputDevice(deviceId) {
    await this.deviceManager.setInputDevice(deviceId);
    if (this.isMicActive) {
      await this.microphone.setDevice(deviceId);
    }
  }
  /**
   * Set output device
   */
  async setOutputDevice(deviceId) {
    await this.deviceManager.setOutputDevice(deviceId);
    await this.playback.setOutputDevice(deviceId);
  }
  /**
   * Check if output device selection is supported
   */
  isOutputSelectionSupported() {
    return this.deviceManager.isOutputSelectionSupported();
  }
  // ==================== Activity/Visualization Methods ====================
  /**
   * Get microphone activity analyzer
   */
  getMicrophoneAnalyzer() {
    return this.micAnalyzer;
  }
  /**
   * Get playback activity analyzer
   */
  getPlaybackAnalyzer() {
    return this.playbackAnalyzer;
  }
  /**
   * Get current microphone activity data
   */
  getMicrophoneActivity() {
    return this.micAnalyzer.getActivityData();
  }
  /**
   * Get current playback activity data
   */
  getPlaybackActivity() {
    return this.playbackAnalyzer.getActivityData();
  }
  // ==================== Full-Duplex Conversation Mode ====================
  /**
   * Start a full-duplex conversation session
   * Captures mic, connects WebSocket, streams audio both ways
   */
  async startConversation(websocketUrl) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (websocketUrl || this.websocket) {
      await this.connectWebSocket(websocketUrl);
    }
    await this.startMicrophone();
  }
  /**
   * Stop the conversation session
   */
  stopConversation() {
    this.stopMicrophone();
    this.stopPlayback();
  }
  /**
   * Interrupt current playback (useful for barge-in)
   * @deprecated Use interruptTurn() for turn-aware interruption
   */
  interrupt() {
    this.stopPlayback();
  }
  // ==================== Turn Management ====================
  /**
   * Generate a unique turn ID
   */
  generateTurnId() {
    this.turnCounter++;
    return `turn_${Date.now()}_${this.turnCounter}`;
  }
  /**
   * Start a new turn. This will:
   * - Interrupt any currently playing audio
   * - Clear the playback buffer
   * - Set the new turn as current
   * - Future audio from previous turns will be ignored
   *
   * @param turnId - Optional custom turn ID (auto-generated if not provided)
   * @returns The new turn ID
   */
  startTurn(turnId) {
    const newTurnId = turnId ?? this.generateTurnId();
    const previousTurnId = this.currentTurnId;
    this.playback.interruptTurn(newTurnId);
    this.currentTurnId = newTurnId;
    this.emit("turn:started", newTurnId, previousTurnId);
    return newTurnId;
  }
  /**
   * Get the current turn ID
   */
  getCurrentTurnId() {
    return this.currentTurnId;
  }
  /**
   * Set the current turn ID (for server-controlled turn management)
   *
   * Use this when the server tells the client which turn to accept.
   * Audio with matching turn IDs will be played, others will be filtered.
   *
   * @param turnId - The turn ID to accept, or null to accept all
   * @param options - Configuration options
   * @param options.clearBuffer - Whether to clear buffered audio from other turns (default: true)
   * @param options.emitEvent - Whether to emit turn:started event (default: false for server-controlled)
   */
  setCurrentTurn(turnId, options = {}) {
    const { clearBuffer = true, emitEvent = false } = options;
    const previousTurnId = this.currentTurnId;
    this.currentTurnId = turnId;
    this.playback.setCurrentTurn(turnId);
    if (clearBuffer && turnId !== previousTurnId) {
      this.playback.clearTurnBuffer();
    }
    if (emitEvent && turnId && turnId !== previousTurnId) {
      this.emit("turn:started", turnId, previousTurnId);
    }
  }
  /**
   * Interrupt the current turn and optionally start a new one
   *
   * For client-controlled turns (like our demo), this sends an interrupt message to the server.
   * For server-controlled turns, set notifyServer: false and handle server notification yourself.
   *
   * @param options - Configuration options
   * @param options.startNewTurn - Whether to start a new turn after interruption (default: true)
   * @param options.notifyServer - Whether to send interrupt message to server (default: true)
   * @returns Object with interrupted turn ID and optionally new turn ID
   */
  interruptTurn(options = true) {
    const opts = typeof options === "boolean" ? { startNewTurn: options, notifyServer: true } : { startNewTurn: true, notifyServer: true, ...options };
    const { startNewTurn, notifyServer } = opts;
    const interruptedTurnId = this.currentTurnId;
    this.playback.interruptTurn();
    if (interruptedTurnId) {
      this.emit("turn:interrupted", interruptedTurnId);
      if (notifyServer && this.websocket?.isConnected()) {
        this.websocket.sendMessage({
          type: "interrupt",
          turnId: interruptedTurnId
        });
      }
    }
    let newTurnId = null;
    if (startNewTurn) {
      newTurnId = this.startTurn();
    } else {
      this.currentTurnId = null;
    }
    return { interruptedTurnId, newTurnId };
  }
  /**
   * End the current turn without starting a new one
   * Allows audio to continue playing but won't accept new audio without a turn
   */
  endTurn() {
    const endedTurnId = this.currentTurnId;
    this.currentTurnId = null;
    this.playback.setCurrentTurn(null);
    if (endedTurnId) {
      this.emit("turn:ended", endedTurnId);
    }
    return endedTurnId;
  }
  /**
   * Clear buffered audio for a specific turn or all turns
   * Does not stop currently playing audio
   * @param turnId - Specific turn to clear, or undefined for all
   */
  clearTurnBuffer(turnId) {
    this.playback.clearTurnBuffer(turnId);
  }
  /**
   * Check if audio for a given turn ID should be accepted
   * @param turnId - The turn ID to check
   */
  shouldAcceptAudioForTurn(turnId) {
    return this.currentTurnId === null || this.currentTurnId === turnId;
  }
  /**
   * Queue audio only if it matches the current turn
   * @param data - PCM audio data
   * @param turnId - Turn ID that this audio belongs to
   * @returns true if audio was queued, false if ignored due to turn mismatch
   */
  async playAudioForTurn(data, turnId) {
    if (!this.shouldAcceptAudioForTurn(turnId)) {
      return false;
    }
    await this.playAudio(data, turnId);
    return true;
  }
  // ==================== Private Methods ====================
  setupEventForwarding() {
    this.microphone.on("start", () => this.emit("mic:start"));
    this.microphone.on("stop", () => this.emit("mic:stop"));
    this.microphone.on("error", (error) => this.emit("mic:error", error));
    this.microphone.on("device-lost", () => {
      this.emit("mic:device-lost");
    });
    this.microphone.on("device-changed", (deviceId) => {
      this.emit("mic:device-changed", deviceId);
      const analyzerNode = this.microphone.getAnalyzerNode();
      if (analyzerNode) {
        this.micAnalyzer.disconnect();
        this.micAnalyzer.connect(analyzerNode);
        this.micAnalyzer.start();
      }
    });
    this.microphone.on("restarting", () => {
      this.emit("mic:restarting");
    });
    this.microphone.on("data", (data) => {
      this.emit("mic:data", data);
      if (this.websocket && !this.micMuted) {
        this.websocket.sendAudio(data);
      }
    });
    this.micAnalyzer.on("activity", (data) => this.emit("mic:activity", data));
    this.playback.on("start", () => this.emit("playback:start"));
    this.playback.on("stop", () => this.emit("playback:stop"));
    this.playback.on("ended", () => this.emit("playback:ended"));
    this.playback.on("error", (error) => this.emit("playback:error", error));
    this.playbackAnalyzer.on(
      "activity",
      (data) => this.emit("playback:activity", data)
    );
    this.deviceManager.on(
      "devices-changed",
      (devices) => this.emit("device:changed", devices)
    );
    this.deviceManager.on("input-changed", (device) => {
      this.emit("device:input-changed", device);
      if (this.isMicActive && device) {
        this.microphone.setDevice(device.deviceId).catch((err) => {
          this.emit("mic:error", err);
        });
      }
    });
    this.deviceManager.on("output-changed", (device) => {
      this.emit("device:output-changed", device);
      if (device) {
        this.playback.setOutputDevice(device.deviceId).catch((err) => {
          this.emit("playback:error", err);
        });
      }
    });
    this.deviceManager.on("device-disconnected", (device) => {
      this.emit("device:disconnected", device);
    });
    if (this.websocket) {
      this.setupWebSocketEvents();
    }
  }
  setupWebSocketEvents() {
    if (!this.websocket) return;
    this.websocket.on("connected", () => this.emit("ws:connected"));
    this.websocket.on(
      "disconnected",
      (code, reason) => this.emit("ws:disconnected", code, reason)
    );
    this.websocket.on(
      "reconnecting",
      (attempt) => this.emit("ws:reconnecting", attempt)
    );
    this.websocket.on("error", (error) => this.emit("ws:error", error));
    this.websocket.on("message", (data) => this.emit("ws:message", data));
    this.websocket.on("audio", async (data, turnId) => {
      this.emit("ws:audio", data, turnId);
      if (turnId && !this.shouldAcceptAudioForTurn(turnId)) {
        console.log(
          `[Chatdio] Ignoring audio for old turn: ${turnId} (current: ${this.currentTurnId})`
        );
        return;
      }
      try {
        await this.playAudio(data, turnId);
      } catch (error) {
        this.emit("playback:error", error);
      }
    });
  }
  /**
   * Play audio received from WebSocket with turn validation
   * @param data - Audio data from WebSocket
   * @param turnId - Optional turn ID from the message
   */
  async handleWebSocketAudio(data, turnId) {
    if (turnId && !this.shouldAcceptAudioForTurn(turnId)) {
      return false;
    }
    try {
      await this.playAudio(data, turnId);
      return true;
    } catch (error) {
      this.emit("playback:error", error);
      return false;
    }
  }
};

// src/AudioRouter.ts
var AudioRouter = class extends TypedEventEmitter {
  constructor(config = {}) {
    super();
    this.audioContext = null;
    this.masterGain = null;
    this.streamDestination = null;
    this.destinations = /* @__PURE__ */ new Map();
    this.audioQueue = [];
    this.currentSources = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.config = {
      sampleRate: config.sampleRate ?? 24e3,
      channels: config.channels ?? 1,
      bufferAhead: config.bufferAhead ?? 0.1
    };
  }
  /**
   * Initialize the audio router
   */
  async initialize() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API not supported");
    }
    this.audioContext = new AudioContextClass({
      sampleRate: this.config.sampleRate
    });
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {
      });
    }
    this.audioContext.addEventListener("statechange", () => {
      if (this.audioContext?.state === "running" && this.audioQueue.length > 0 && !this.isPlaying && !this.isPaused) {
        this.playNext();
      }
    });
  }
  /**
   * Get the AudioContext for creating custom nodes
   */
  getContext() {
    if (!this.audioContext) {
      throw new Error("AudioRouter not initialized");
    }
    return this.audioContext;
  }
  /**
   * Get a MediaStream of the routed audio
   * Automatically creates and registers the "stream" destination if needed
   */
  getMediaStream() {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }
    if (!this.streamDestination) {
      this.streamDestination = this.audioContext.createMediaStreamDestination();
    }
    if (!this.destinations.has("stream")) {
      this.addDestination("stream", this.streamDestination);
    }
    return this.streamDestination.stream;
  }
  /**
   * Add a destination to route audio to
   * @param name - Unique identifier for this destination
   * @param node - AudioNode to route audio to (e.g., context.destination, MediaStreamDestination)
   * @param volume - Optional volume for this destination (0-1), defaults to 1
   */
  addDestination(name, node, volume = 1) {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }
    if (this.destinations.has(name)) {
      throw new Error(`Destination '${name}' already exists`);
    }
    const gain = this.audioContext.createGain();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    gain.gain.value = clampedVolume;
    this.masterGain.connect(gain);
    gain.connect(node);
    this.destinations.set(name, {
      name,
      node,
      gain,
      volume: clampedVolume,
      enabled: true
    });
    this.emit("destination-added", name);
  }
  /**
   * Remove a destination
   * @param name - Name of the destination to remove
   */
  removeDestination(name) {
    const dest = this.destinations.get(name);
    if (!dest) return false;
    dest.gain.disconnect();
    this.destinations.delete(name);
    this.emit("destination-removed", name);
    return true;
  }
  /**
   * Get all destination names
   */
  getDestinations() {
    return Array.from(this.destinations.keys());
  }
  /**
   * Set volume for a specific destination
   * @param name - Destination name
   * @param volume - Volume level (0-1)
   */
  setDestinationVolume(name, volume) {
    const dest = this.destinations.get(name);
    if (dest) {
      dest.volume = Math.max(0, Math.min(1, volume));
      if (dest.enabled) {
        dest.gain.gain.value = dest.volume;
      }
    }
  }
  /**
   * Enable or disable a specific destination
   * When disabled, audio is muted but the destination remains configured
   * @param name - Destination name
   * @param enabled - Whether the destination should be enabled
   */
  setDestinationEnabled(name, enabled) {
    const dest = this.destinations.get(name);
    if (dest) {
      dest.enabled = enabled;
      dest.gain.gain.value = enabled ? dest.volume : 0;
    }
  }
  /**
   * Check if a destination is enabled
   * @param name - Destination name
   */
  isDestinationEnabled(name) {
    return this.destinations.get(name)?.enabled ?? false;
  }
  /**
   * Set master volume (affects all destinations)
   * @param volume - Volume level (0-1)
   */
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  /**
   * Queue PCM16 audio data for playback to all destinations
   * @param data - PCM16 audio data (16-bit signed integer, little-endian)
   */
  async queuePcm16(data) {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }
    if (this.destinations.size === 0) {
      console.warn("[AudioRouter] No destinations configured");
      return;
    }
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {
      }
    }
    const floatData = Float32Array.from(new Int16Array(data), (x) => x / 32768);
    const numSamples = floatData.length / this.config.channels;
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channels,
      numSamples,
      this.config.sampleRate
    );
    if (this.config.channels === 1) {
      audioBuffer.getChannelData(0).set(floatData);
    } else {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < numSamples; i++) {
        left[i] = floatData[i * 2];
        right[i] = floatData[i * 2 + 1];
      }
    }
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );
    this.audioQueue.push({ buffer: audioBuffer, startTime });
    this.nextPlayTime = startTime + audioBuffer.duration;
    if (!this.isPlaying && !this.isPaused && this.audioContext.state === "running") {
      this.playNext();
    }
  }
  /**
   * Queue a pre-created AudioBuffer
   * @param audioBuffer - AudioBuffer to queue
   */
  async queueAudioBuffer(audioBuffer) {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );
    this.audioQueue.push({ buffer: audioBuffer, startTime });
    this.nextPlayTime = startTime + audioBuffer.duration;
    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }
  /**
   * Stop playback and clear queue
   */
  stop() {
    for (const source of this.currentSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
      }
    }
    this.currentSources = [];
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.emit("stop");
  }
  /**
   * Pause playback
   */
  pause() {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.suspend();
      this.isPaused = true;
    }
  }
  /**
   * Resume playback
   */
  async resume() {
    if (this.audioContext && this.isPaused) {
      await this.audioContext.resume();
      this.isPaused = false;
    }
  }
  /**
   * Check if currently playing
   */
  isActive() {
    return this.isPlaying && !this.isPaused;
  }
  /**
   * Get buffered audio duration in seconds
   */
  getBufferedDuration() {
    return this.audioQueue.reduce((sum, item) => sum + item.buffer.duration, 0);
  }
  /**
   * Unlock audio playback (call from user gesture for iOS)
   */
  async unlockAudio() {
    if (!this.audioContext) {
      throw new Error("AudioRouter not initialized");
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    const buffer = this.audioContext.createBuffer(
      1,
      1,
      this.audioContext.sampleRate
    );
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }
  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    for (const dest of this.destinations.values()) {
      dest.gain.disconnect();
    }
    this.destinations.clear();
    if (this.streamDestination) {
      this.streamDestination.disconnect();
      this.streamDestination = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {
      });
    }
    this.audioContext = null;
    this.removeAllListeners();
  }
  playNext() {
    if (!this.audioContext || !this.masterGain || this.audioQueue.length === 0) {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.emit("ended");
      }
      return;
    }
    const { buffer, startTime } = this.audioQueue.shift();
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    this.currentSources.push(source);
    source.onended = () => {
      const idx = this.currentSources.indexOf(source);
      if (idx !== -1) {
        this.currentSources.splice(idx, 1);
      }
      this.playNext();
    };
    const currentTime = this.audioContext.currentTime;
    const playAt = Math.max(startTime, currentTime);
    try {
      source.start(playAt);
    } catch (err) {
      console.error("[AudioRouter] Failed to start source:", err);
      this.emit("error", err);
    }
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.emit("start");
    }
  }
};

// src/utils.ts
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
function uint8ArrayToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function pcm16ToFloat32(pcm16) {
  return Float32Array.from(new Int16Array(pcm16), (x) => x / 32768);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ActivityAnalyzer,
  AudioDeviceManager,
  AudioFormatConverter,
  AudioPlayback,
  AudioRouter,
  Chatdio,
  MicrophoneCapture,
  TypedEventEmitter,
  VisualizationUtils,
  WebSocketBridge,
  arrayBufferToBase64,
  audioWorkletProcessorCode,
  base64ToArrayBuffer,
  base64ToUint8Array,
  createWorkletBlobUrl,
  pcm16ToFloat32,
  uint8ArrayToBase64
});
