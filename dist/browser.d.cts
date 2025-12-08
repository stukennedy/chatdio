import { Chatdio, AudioDeviceManager, MicrophoneCapture, AudioFormatConverter, AudioPlayback, AudioRouter, WebSocketBridge, ActivityAnalyzer, VisualizationUtils, createWorkletBlobUrl, arrayBufferToBase64, base64ToArrayBuffer, uint8ArrayToBase64, base64ToUint8Array, pcm16ToFloat32, TypedEventEmitter } from './index.cjs';
export { audioWorkletProcessorCode } from './index.cjs';

/**
 * Browser entry point for conversational-audio
 *
 * This file exposes all exports as window.ConversationalAudio for non-module usage.
 * Used by the HTMX WebSocket Audio extension and other browser-based integrations.
 */

declare const ConversationalAudio: {
    Chatdio: typeof Chatdio;
    AudioDeviceManager: typeof AudioDeviceManager;
    MicrophoneCapture: typeof MicrophoneCapture;
    AudioFormatConverter: typeof AudioFormatConverter;
    AudioPlayback: typeof AudioPlayback;
    AudioRouter: typeof AudioRouter;
    WebSocketBridge: typeof WebSocketBridge;
    ActivityAnalyzer: typeof ActivityAnalyzer;
    VisualizationUtils: typeof VisualizationUtils;
    createWorkletBlobUrl: typeof createWorkletBlobUrl;
    audioWorkletProcessorCode: string;
    arrayBufferToBase64: typeof arrayBufferToBase64;
    base64ToArrayBuffer: typeof base64ToArrayBuffer;
    uint8ArrayToBase64: typeof uint8ArrayToBase64;
    base64ToUint8Array: typeof base64ToUint8Array;
    pcm16ToFloat32: typeof pcm16ToFloat32;
    TypedEventEmitter: typeof TypedEventEmitter;
};

export { ActivityAnalyzer, AudioDeviceManager, AudioFormatConverter, AudioPlayback, AudioRouter, Chatdio, MicrophoneCapture, TypedEventEmitter, VisualizationUtils, WebSocketBridge, arrayBufferToBase64, base64ToArrayBuffer, base64ToUint8Array, createWorkletBlobUrl, ConversationalAudio as default, pcm16ToFloat32, uint8ArrayToBase64 };
