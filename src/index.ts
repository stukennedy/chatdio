// Main orchestrator
export { ConversationalAudio } from "./ConversationalAudio";

// Core components
export { AudioDeviceManager } from "./AudioDeviceManager";
export { MicrophoneCapture, AudioFormatConverter } from "./MicrophoneCapture";
export { AudioPlayback } from "./AudioPlayback";
export { WebSocketBridge } from "./WebSocketBridge";
export { ActivityAnalyzer, VisualizationUtils } from "./ActivityAnalyzer";

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
  ConversationalAudioConfig,
  ConversationalAudioEvents,
} from "./types";
