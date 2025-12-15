import {
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
} from "./chunk-ICDG5XWT.js";

// src/browser.ts
var ConversationalAudio = {
  // Main orchestrator
  Chatdio,
  // Core components
  AudioDeviceManager,
  MicrophoneCapture,
  AudioFormatConverter,
  AudioPlayback,
  AudioRouter,
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
  pcm16ToFloat32,
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
  browser_default as default,
  pcm16ToFloat32,
  uint8ArrayToBase64
};
