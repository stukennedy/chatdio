/**
 * Browser entry point for conversational-audio
 *
 * This file exposes all exports as window.ConversationalAudio for non-module usage.
 * Used by the HTMX WebSocket Audio extension and other browser-based integrations.
 */

import { Chatdio } from "./Chatdio";
import { AudioDeviceManager } from "./AudioDeviceManager";
import { MicrophoneCapture, AudioFormatConverter } from "./MicrophoneCapture";
import { AudioPlayback } from "./AudioPlayback";
import { AudioRouter } from "./AudioRouter";
import { WebSocketBridge } from "./WebSocketBridge";
import { ActivityAnalyzer, VisualizationUtils } from "./ActivityAnalyzer";
import {
  createWorkletBlobUrl,
  audioWorkletProcessorCode,
} from "./audio-worklet-processor";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  pcm16ToFloat32,
} from "./utils";
import { TypedEventEmitter } from "./EventEmitter";

// Create the global namespace
const ConversationalAudio = {
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
  TypedEventEmitter,
};

// Expose on window for browser usage
if (typeof window !== "undefined") {
  (
    window as typeof window & {
      ConversationalAudio: typeof ConversationalAudio;
    }
  ).ConversationalAudio = ConversationalAudio;
}

// Also export for module usage
export default ConversationalAudio;
export {
  Chatdio,
  AudioDeviceManager,
  MicrophoneCapture,
  AudioFormatConverter,
  AudioPlayback,
  AudioRouter,
  WebSocketBridge,
  ActivityAnalyzer,
  VisualizationUtils,
  createWorkletBlobUrl,
  audioWorkletProcessorCode,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  pcm16ToFloat32,
  TypedEventEmitter,
};
