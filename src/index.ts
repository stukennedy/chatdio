// Main orchestrator
export { Chatdio } from "./Chatdio";

// Core components
export { AudioDeviceManager } from "./AudioDeviceManager";
export { MicrophoneCapture, AudioFormatConverter } from "./MicrophoneCapture";
export { AudioPlayback } from "./AudioPlayback";
export { AudioRouter } from "./AudioRouter";
export { WebSocketBridge } from "./WebSocketBridge";
export { ActivityAnalyzer, VisualizationUtils } from "./ActivityAnalyzer";
export {
  createWorkletBlobUrl,
  audioWorkletProcessorCode,
} from "./audio-worklet-processor";

// Utilities
export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  pcm16ToFloat32,
} from "./utils";

// Event emitter
export { TypedEventEmitter } from "./EventEmitter";

// Types
export type {
  SampleRate,
  BitDepth,
  AudioFormat,
  AudioDevice,
  DeviceManagerConfig,
  MicrophoneConfig,
  PlaybackConfig,
  WebSocketConfig,
  ActivityAnalyzerConfig,
  AudioActivityData,
  ConnectionState,
  ChatdioConfig,
  ChatdioEvents,
  ParsedAudioResult,
} from "./types";
