import {
  ActivityAnalyzer,
  AudioDeviceManager,
  AudioFormatConverter,
  AudioPlayback,
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
  uint8ArrayToBase64
} from "./chunk-ITILR253.js";

// src/browser.ts
var ConversationalAudio = {
  // Main orchestrator
  Chatdio,
  // Core components
  AudioDeviceManager,
  MicrophoneCapture,
  AudioFormatConverter,
  AudioPlayback,
  WebSocketBridge,
  ActivityAnalyzer,
  VisualizationUtils,
  // Audio worklet
  createWorkletBlobUrl,
  audioWorkletProcessorCode,
  // Utilities
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  // Event emitter
  TypedEventEmitter
};
if (typeof window !== "undefined") {
  window.ConversationalAudio = ConversationalAudio;
}
var browser_default = ConversationalAudio;
export {
  ActivityAnalyzer,
  AudioDeviceManager,
  AudioFormatConverter,
  AudioPlayback,
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
  browser_default as default,
  uint8ArrayToBase64
};
