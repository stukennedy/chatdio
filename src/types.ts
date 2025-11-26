/**
 * Supported audio sample rates
 */
export type SampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

/**
 * Supported bit depths for audio encoding
 */
export type BitDepth = 8 | 16 | 24 | 32;

/**
 * Audio format configuration
 */
export interface AudioFormat {
  sampleRate: SampleRate;
  bitDepth: BitDepth;
  channels: 1 | 2;
}

/**
 * Audio device information
 */
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
  isDefault: boolean;
}

/**
 * Device manager configuration
 */
export interface DeviceManagerConfig {
  /** Auto-switch to default device when current device disconnects */
  autoFallback?: boolean;
  /** Poll interval for device changes (ms) */
  pollInterval?: number;
}

/**
 * Microphone capture configuration
 */
export interface MicrophoneConfig {
  /** Target sample rate for captured audio */
  sampleRate?: SampleRate;
  /** Enable echo cancellation */
  echoCancellation?: boolean;
  /** Enable noise suppression */
  noiseSuppression?: boolean;
  /** Enable automatic gain control */
  autoGainControl?: boolean;
  /** Specific device ID to use */
  deviceId?: string;
  /** Buffer size for audio processing (power of 2) */
  bufferSize?: 256 | 512 | 1024 | 2048 | 4096;
}

/**
 * Audio playback configuration
 */
export interface PlaybackConfig {
  /** Sample rate of incoming audio */
  sampleRate?: SampleRate;
  /** Bit depth of incoming audio */
  bitDepth?: BitDepth;
  /** Number of channels */
  channels?: 1 | 2;
  /** Output device ID */
  deviceId?: string;
  /** Buffer ahead time in seconds */
  bufferAhead?: number;
}

/**
 * Result from parsing incoming audio, optionally with turn ID
 */
export interface ParsedAudioResult {
  data: ArrayBuffer;
  turnId?: string;
}

/**
 * WebSocket bridge configuration
 */
export interface WebSocketConfig {
  /** WebSocket URL */
  url: string;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms */
  reconnectDelay?: number;
  /** Audio format for sending */
  sendFormat?: AudioFormat;
  /** Audio format for receiving */
  receiveFormat?: AudioFormat;
  /** Send audio as binary or base64 */
  binaryMode?: boolean;
  /** Custom message wrapper for outgoing audio */
  wrapOutgoingAudio?: (data: ArrayBuffer) => string | ArrayBuffer;
  /** Custom message parser for incoming audio. Return ArrayBuffer or ParsedAudioResult with turnId */
  parseIncomingAudio?: (
    data: MessageEvent
  ) => ArrayBuffer | ParsedAudioResult | null;
}

/**
 * Activity analyzer configuration
 */
export interface ActivityAnalyzerConfig {
  /** FFT size for frequency analysis */
  fftSize?: 32 | 64 | 128 | 256 | 512 | 1024 | 2048;
  /** Smoothing time constant (0-1) */
  smoothingTimeConstant?: number;
  /** Update interval in ms */
  updateInterval?: number;
}

/**
 * Audio activity data for visualization
 */
export interface AudioActivityData {
  /** Current volume level (0-1) */
  volume: number;
  /** Peak volume level (0-1) */
  peak: number;
  /** Frequency data for visualization */
  frequencyData: Uint8Array<ArrayBuffer>;
  /** Time domain data for waveform */
  timeDomainData: Uint8Array<ArrayBuffer>;
  /** Whether audio is currently detected */
  isSpeaking: boolean;
}

/**
 * Connection state for WebSocket
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Main library configuration
 */
export interface ConversationalAudioConfig {
  /** Microphone configuration */
  microphone?: MicrophoneConfig;
  /** Playback configuration */
  playback?: PlaybackConfig;
  /** WebSocket configuration */
  websocket?: WebSocketConfig;
  /** Device manager configuration */
  deviceManager?: DeviceManagerConfig;
  /** Activity analyzer configuration */
  activityAnalyzer?: ActivityAnalyzerConfig;
}

/**
 * Event types emitted by the library
 */
export interface ConversationalAudioEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  /** Microphone audio data ready to send */
  "mic:data": (data: ArrayBuffer) => void;
  /** Microphone started */
  "mic:start": () => void;
  /** Microphone stopped */
  "mic:stop": () => void;
  /** Microphone error */
  "mic:error": (error: Error) => void;
  /** Microphone activity update */
  "mic:activity": (data: AudioActivityData) => void;
  /** Microphone device was lost/disconnected */
  "mic:device-lost": () => void;
  /** Microphone switched to a different device */
  "mic:device-changed": (deviceId: string) => void;
  /** Microphone is restarting (after device change or recovery) */
  "mic:restarting": () => void;

  /** Playback started */
  "playback:start": () => void;
  /** Playback stopped */
  "playback:stop": () => void;
  /** Playback ended (buffer exhausted) */
  "playback:ended": () => void;
  /** Playback error */
  "playback:error": (error: Error) => void;
  /** Playback activity update */
  "playback:activity": (data: AudioActivityData) => void;

  /** WebSocket connected */
  "ws:connected": () => void;
  /** WebSocket disconnected */
  "ws:disconnected": (code: number, reason: string) => void;
  /** WebSocket reconnecting */
  "ws:reconnecting": (attempt: number) => void;
  /** WebSocket error */
  "ws:error": (error: Error) => void;
  /** WebSocket received audio (turnId may be undefined if server doesn't send it) */
  "ws:audio": (data: ArrayBuffer, turnId?: string) => void;
  /** WebSocket received non-audio message */
  "ws:message": (data: unknown) => void;

  /** Device list changed */
  "device:changed": (devices: AudioDevice[]) => void;
  /** Input device changed */
  "device:input-changed": (device: AudioDevice | null) => void;
  /** Output device changed */
  "device:output-changed": (device: AudioDevice | null) => void;
  /** Device disconnected */
  "device:disconnected": (device: AudioDevice) => void;

  /** New turn started */
  "turn:started": (turnId: string, previousTurnId: string | null) => void;
  /** Turn was interrupted (barge-in) */
  "turn:interrupted": (turnId: string) => void;
  /** Turn ended normally */
  "turn:ended": (turnId: string) => void;
}

/**
 * Event emitter interface
 */
export interface EventEmitter<
  T extends Record<string, (...args: unknown[]) => void>
> {
  on<K extends keyof T>(event: K, listener: T[K]): void;
  off<K extends keyof T>(event: K, listener: T[K]): void;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void;
}
