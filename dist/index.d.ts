/**
 * Simple typed event emitter for cross-browser compatibility
 */
declare class TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
    private listeners;
    on<K extends keyof T>(event: K, listener: T[K]): this;
    off<K extends keyof T>(event: K, listener: T[K]): this;
    once<K extends keyof T>(event: K, listener: T[K]): this;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
    removeAllListeners(event?: keyof T): this;
    listenerCount(event: keyof T): number;
}

/**
 * Supported audio sample rates
 */
type SampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;
/**
 * Supported bit depths for audio encoding
 */
type BitDepth = 8 | 16 | 24 | 32;
/**
 * Audio format configuration
 */
interface AudioFormat {
    sampleRate: SampleRate;
    bitDepth: BitDepth;
    channels: 1 | 2;
}
/**
 * Audio device information
 */
interface AudioDevice {
    deviceId: string;
    label: string;
    kind: "audioinput" | "audiooutput";
    isDefault: boolean;
}
/**
 * Device manager configuration
 */
interface DeviceManagerConfig {
    /** Auto-switch to default device when current device disconnects */
    autoFallback?: boolean;
    /** Poll interval for device changes (ms) */
    pollInterval?: number;
}
/**
 * Microphone capture configuration
 */
interface MicrophoneConfig {
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
interface PlaybackConfig {
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
 * WebSocket bridge configuration
 */
interface WebSocketConfig {
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
    /** Custom message parser for incoming audio */
    parseIncomingAudio?: (data: MessageEvent) => ArrayBuffer | null;
}
/**
 * Activity analyzer configuration
 */
interface ActivityAnalyzerConfig {
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
interface AudioActivityData {
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
type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
/**
 * Main library configuration
 */
interface ConversationalAudioConfig {
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
interface ConversationalAudioEvents {
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
    /** WebSocket received audio */
    "ws:audio": (data: ArrayBuffer) => void;
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
}

interface ActivityAnalyzerEvents {
    [key: string]: (...args: any[]) => void;
    activity: (data: AudioActivityData) => void;
    "speaking-start": () => void;
    "speaking-stop": () => void;
}
/**
 * Analyzes audio nodes to provide real-time activity data for visualization
 * Works with both microphone input and playback output
 */
declare class ActivityAnalyzer extends TypedEventEmitter<ActivityAnalyzerEvents> {
    private analyzerNode;
    private config;
    private animationFrameId;
    private intervalId;
    private isRunning;
    private isSpeaking;
    private speakingThreshold;
    private silenceTimeout;
    private lastSoundTime;
    private peakLevel;
    private peakDecay;
    private frequencyData;
    private timeDomainData;
    constructor(config?: ActivityAnalyzerConfig);
    /**
     * Set the speaking detection threshold (0-1)
     */
    setSpeakingThreshold(threshold: number): void;
    /**
     * Get current speaking threshold
     */
    getSpeakingThreshold(): number;
    /**
     * Set the silence timeout in milliseconds
     */
    setSilenceTimeout(ms: number): void;
    /**
     * Connect to an AnalyserNode for monitoring
     */
    connect(analyzerNode: AnalyserNode): void;
    /**
     * Disconnect from the current analyzer node
     */
    disconnect(): void;
    /**
     * Start analyzing and emitting activity events
     */
    start(): void;
    /**
     * Stop analyzing
     */
    stop(): void;
    /**
     * Check if currently running
     */
    isActive(): boolean;
    /**
     * Get current activity data synchronously
     */
    getActivityData(): AudioActivityData | null;
    /**
     * Get the frequency data for custom visualization
     */
    getFrequencyData(): Uint8Array<ArrayBuffer> | null;
    /**
     * Get the time domain data for waveform visualization
     */
    getTimeDomainData(): Uint8Array<ArrayBuffer> | null;
    /**
     * Get normalized frequency bands for bar visualization
     * @param numBands - Number of frequency bands to return
     */
    getFrequencyBands(numBands?: number): number[];
    private startWithAnimationFrame;
    private startWithInterval;
    private updateAndEmit;
    private analyze;
}
/**
 * Creates visualization data utilities
 */
declare class VisualizationUtils {
    /**
     * Smooth array values over time (for animations)
     */
    static smoothArray(current: number[], target: number[], smoothing?: number): number[];
    /**
     * Convert frequency data to logarithmic scale (better for music/speech)
     */
    static toLogScale(data: Uint8Array, outputSize: number): number[];
    /**
     * Get a CSS color based on volume level
     */
    static volumeToColor(volume: number, colors: {
        low: string;
        mid: string;
        high: string;
    }): string;
    /**
     * Convert volume to decibels
     */
    static volumeToDb(volume: number): number;
    /**
     * Create a simple waveform path for SVG
     */
    static createWaveformPath(timeDomainData: Uint8Array, width: number, height: number): string;
    /**
     * Create bar heights for frequency visualization
     */
    static createBarHeights(frequencyData: Uint8Array, numBars: number, maxHeight: number): number[];
}

/**
 * Main orchestrator for conversational AI audio
 * Manages microphone capture, audio playback, WebSocket streaming,
 * and real-time activity visualization
 */
declare class ConversationalAudio extends TypedEventEmitter<ConversationalAudioEvents> {
    private deviceManager;
    private microphone;
    private playback;
    private websocket;
    private micAnalyzer;
    private playbackAnalyzer;
    private isInitialized;
    private isMicActive;
    private config;
    constructor(config?: ConversationalAudioConfig);
    /**
     * Initialize the audio system
     * Must be called from a user gesture (click/touch) for browser compatibility
     */
    initialize(): Promise<void>;
    /**
     * Clean up all resources
     */
    dispose(): void;
    /**
     * Start capturing microphone audio
     */
    startMicrophone(): Promise<void>;
    /**
     * Stop capturing microphone audio
     */
    stopMicrophone(): void;
    /**
     * Check if microphone is active
     */
    isMicrophoneActive(): boolean;
    /**
     * Set microphone mute state (still captures but doesn't send)
     */
    private micMuted;
    setMicrophoneMuted(muted: boolean): void;
    /**
     * Check if microphone is muted
     */
    isMicrophoneMuted(): boolean;
    /**
     * Queue audio data for playback
     */
    playAudio(data: ArrayBuffer): Promise<void>;
    /**
     * Stop playback and clear queue
     */
    stopPlayback(): void;
    /**
     * Pause playback
     */
    pausePlayback(): void;
    /**
     * Resume playback
     */
    resumePlayback(): Promise<void>;
    /**
     * Check if playback is active
     */
    isPlaybackActive(): boolean;
    /**
     * Set playback volume (0-1)
     */
    setVolume(volume: number): void;
    /**
     * Get current volume
     */
    getVolume(): number;
    /**
     * Connect to WebSocket server
     */
    connectWebSocket(url?: string): Promise<void>;
    /**
     * Disconnect from WebSocket server
     */
    disconnectWebSocket(): void;
    /**
     * Check if WebSocket is connected
     */
    isWebSocketConnected(): boolean;
    /**
     * Get WebSocket connection state
     */
    getWebSocketState(): ConnectionState;
    /**
     * Send a message through WebSocket
     */
    sendMessage(message: unknown): void;
    /**
     * Get all audio devices
     */
    getDevices(): AudioDevice[];
    /**
     * Get input (microphone) devices
     */
    getInputDevices(): AudioDevice[];
    /**
     * Get output (speaker) devices
     */
    getOutputDevices(): AudioDevice[];
    /**
     * Get currently selected input device
     */
    getCurrentInputDevice(): AudioDevice | null;
    /**
     * Get currently selected output device
     */
    getCurrentOutputDevice(): AudioDevice | null;
    /**
     * Set input device
     */
    setInputDevice(deviceId: string): Promise<void>;
    /**
     * Set output device
     */
    setOutputDevice(deviceId: string): Promise<void>;
    /**
     * Check if output device selection is supported
     */
    isOutputSelectionSupported(): boolean;
    /**
     * Get microphone activity analyzer
     */
    getMicrophoneAnalyzer(): ActivityAnalyzer;
    /**
     * Get playback activity analyzer
     */
    getPlaybackAnalyzer(): ActivityAnalyzer;
    /**
     * Get current microphone activity data
     */
    getMicrophoneActivity(): AudioActivityData | null;
    /**
     * Get current playback activity data
     */
    getPlaybackActivity(): AudioActivityData | null;
    /**
     * Start a full-duplex conversation session
     * Captures mic, connects WebSocket, streams audio both ways
     */
    startConversation(websocketUrl?: string): Promise<void>;
    /**
     * Stop the conversation session
     */
    stopConversation(): void;
    /**
     * Interrupt current playback (useful for barge-in)
     */
    interrupt(): void;
    private setupEventForwarding;
    private setupWebSocketEvents;
}

interface DeviceManagerEvents {
    [key: string]: (...args: any[]) => void;
    "devices-changed": (devices: AudioDevice[]) => void;
    "input-changed": (device: AudioDevice | null) => void;
    "output-changed": (device: AudioDevice | null) => void;
    "device-disconnected": (device: AudioDevice) => void;
    error: (error: Error) => void;
}
/**
 * Manages audio input/output device enumeration and selection
 * with cross-browser support (Chrome, Firefox, Safari)
 */
declare class AudioDeviceManager extends TypedEventEmitter<DeviceManagerEvents> {
    private devices;
    private currentInputId;
    private currentOutputId;
    private pollInterval;
    private config;
    private permissionGranted;
    constructor(config?: DeviceManagerConfig);
    /**
     * Initialize device manager and request permissions
     * Must be called from a user gesture (click/touch) for Safari/Firefox
     */
    initialize(): Promise<void>;
    /**
     * Clean up resources
     */
    dispose(): void;
    /**
     * Get all available audio devices
     */
    getDevices(): AudioDevice[];
    /**
     * Get input (microphone) devices
     */
    getInputDevices(): AudioDevice[];
    /**
     * Get output (speaker) devices
     */
    getOutputDevices(): AudioDevice[];
    /**
     * Get currently selected input device
     */
    getCurrentInput(): AudioDevice | null;
    /**
     * Get currently selected output device
     */
    getCurrentOutput(): AudioDevice | null;
    /**
     * Set the input device
     */
    setInputDevice(deviceId: string): Promise<void>;
    /**
     * Set the output device
     * Note: Not supported in Safari - will fall back to default
     */
    setOutputDevice(deviceId: string): Promise<void>;
    /**
     * Check if output device selection is supported
     * (Not available in Safari)
     */
    isOutputSelectionSupported(): boolean;
    /**
     * Get the device ID to use for input
     */
    getInputDeviceId(): string | undefined;
    /**
     * Get the device ID to use for output
     */
    getOutputDeviceId(): string | undefined;
    /**
     * Refresh the device list
     */
    refreshDevices(): Promise<void>;
    private mapDevice;
    private handleDeviceChange;
    private startPolling;
    private stopPolling;
}

interface MicrophoneCaptureEvents {
    [key: string]: (...args: any[]) => void;
    data: (data: ArrayBuffer) => void;
    start: () => void;
    stop: () => void;
    error: (error: Error) => void;
    level: (level: number) => void;
}
/**
 * Captures microphone audio with echo cancellation and resampling
 * Cross-browser compatible (Chrome, Firefox, Safari)
 */
declare class MicrophoneCapture extends TypedEventEmitter<MicrophoneCaptureEvents> {
    private audioContext;
    private mediaStream;
    private sourceNode;
    private processorNode;
    private analyzerNode;
    private isCapturing;
    private config;
    private inputSampleRate;
    private resampleBuffer;
    constructor(config?: MicrophoneConfig);
    /**
     * Start capturing microphone audio
     * Must be called from a user gesture on Safari/Firefox
     */
    start(): Promise<void>;
    /**
     * Stop capturing microphone audio
     */
    stop(): void;
    /**
     * Check if currently capturing
     */
    isActive(): boolean;
    /**
     * Change the input device
     */
    setDevice(deviceId: string): Promise<void>;
    /**
     * Get the current configuration
     */
    getConfig(): Required<MicrophoneConfig>;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<MicrophoneConfig>): Promise<void>;
    /**
     * Get the analyzer node for external visualization
     */
    getAnalyzerNode(): AnalyserNode | null;
    /**
     * Get current audio context sample rate
     */
    getInputSampleRate(): number;
    /**
     * Get target output sample rate
     */
    getOutputSampleRate(): SampleRate;
    private handleAudioProcess;
    private calculateLevel;
    private resample;
    private floatTo16BitPCM;
    private cleanup;
}
/**
 * Utility to convert between audio formats
 */
declare class AudioFormatConverter {
    /**
     * Convert Float32Array to specified bit depth
     */
    static floatToPCM(input: Float32Array, bitDepth: BitDepth): ArrayBuffer;
    /**
     * Convert PCM data to Float32Array
     */
    static pcmToFloat(input: ArrayBuffer, bitDepth: BitDepth): Float32Array;
    private static floatTo8Bit;
    private static floatTo16Bit;
    private static floatTo24Bit;
    private static floatTo32Bit;
    private static int8ToFloat;
    private static int16ToFloat;
    private static int24ToFloat;
    private static int32ToFloat;
}

interface AudioPlaybackEvents {
    [key: string]: (...args: any[]) => void;
    start: () => void;
    stop: () => void;
    ended: () => void;
    error: (error: Error) => void;
    level: (level: number) => void;
    "buffer-low": () => void;
    "buffer-empty": () => void;
}
/**
 * Plays audio received from a server with buffering and device management
 * Cross-browser compatible (Chrome, Firefox, Safari)
 */
declare class AudioPlayback extends TypedEventEmitter<AudioPlaybackEvents> {
    private audioContext;
    private gainNode;
    private analyzerNode;
    private audioElement;
    private mediaStreamDestination;
    private audioQueue;
    private currentSource;
    private isPlaying;
    private isPaused;
    private nextPlayTime;
    private config;
    private bufferCheckInterval;
    private lowBufferThreshold;
    constructor(config?: PlaybackConfig);
    /**
     * Initialize the audio playback system
     * Should be called from a user gesture for Safari/Firefox
     */
    initialize(): Promise<void>;
    /**
     * Clean up resources
     */
    dispose(): void;
    /**
     * Queue audio data for playback
     * @param data - PCM audio data (raw bytes)
     */
    queueAudio(data: ArrayBuffer): Promise<void>;
    /**
     * Queue pre-decoded AudioBuffer for playback
     */
    queueAudioBuffer(audioBuffer: AudioBuffer): Promise<void>;
    /**
     * Stop playback and clear queue
     */
    stop(): void;
    /**
     * Pause playback
     */
    pause(): void;
    /**
     * Resume playback
     */
    resume(): Promise<void>;
    /**
     * Set volume (0-1)
     */
    setVolume(volume: number): void;
    /**
     * Get current volume
     */
    getVolume(): number;
    /**
     * Check if currently playing
     */
    isActive(): boolean;
    /**
     * Get buffered audio duration in seconds
     */
    getBufferedDuration(): number;
    /**
     * Set output device (not supported in Safari)
     */
    setOutputDevice(deviceId: string): Promise<void>;
    /**
     * Check if output device selection is supported
     */
    supportsOutputSelection(): boolean;
    /**
     * Get the analyzer node for external visualization
     */
    getAnalyzerNode(): AnalyserNode | null;
    /**
     * Update audio format configuration
     */
    updateFormat(config: Partial<Pick<PlaybackConfig, "sampleRate" | "bitDepth" | "channels">>): void;
    private setupAudioElementOutput;
    private createAudioBuffer;
    private playNext;
    private emitLevel;
    private startBufferMonitoring;
    private stopBufferMonitoring;
}

interface WebSocketBridgeEvents {
    [key: string]: (...args: any[]) => void;
    connected: () => void;
    disconnected: (code: number, reason: string) => void;
    reconnecting: (attempt: number) => void;
    error: (error: Error) => void;
    audio: (data: ArrayBuffer) => void;
    message: (data: unknown) => void;
    "state-change": (state: ConnectionState) => void;
}
/**
 * WebSocket bridge for streaming audio to/from a server
 * Handles reconnection, binary/text modes, and custom message formats
 */
declare class WebSocketBridge extends TypedEventEmitter<WebSocketBridgeEvents> {
    private ws;
    private config;
    private state;
    private reconnectAttempts;
    private reconnectTimeout;
    private pingInterval;
    private lastPongTime;
    private intentionalClose;
    private sendBuffer;
    private maxSendBufferSize;
    constructor(config: WebSocketConfig);
    /**
     * Get current connection state
     */
    getState(): ConnectionState;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Connect to the WebSocket server
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the server
     */
    disconnect(): void;
    /**
     * Send audio data to the server
     */
    sendAudio(data: ArrayBuffer): void;
    /**
     * Send a non-audio message to the server
     */
    sendMessage(message: unknown): void;
    /**
     * Update the WebSocket URL (will reconnect if connected)
     */
    setUrl(url: string): Promise<void>;
    /**
     * Get send format configuration
     */
    getSendFormat(): AudioFormat;
    /**
     * Get receive format configuration
     */
    getReceiveFormat(): AudioFormat;
    /**
     * Update audio format configurations
     */
    updateFormats(config: {
        sendFormat?: AudioFormat;
        receiveFormat?: AudioFormat;
    }): void;
    private handleOpen;
    private handleClose;
    private handleError;
    private handleMessage;
    private emitNonAudioMessage;
    private scheduleReconnect;
    private stopReconnecting;
    private startPing;
    private stopPing;
    private setState;
    private arrayBufferToBase64;
    private base64ToArrayBuffer;
}

export { ActivityAnalyzer, type ActivityAnalyzerConfig, type AudioActivityData, type AudioDevice, AudioDeviceManager, type AudioFormat, AudioFormatConverter, AudioPlayback, type BitDepth, type ConnectionState, ConversationalAudio, type ConversationalAudioConfig, type ConversationalAudioEvents, type DeviceManagerConfig, MicrophoneCapture, type MicrophoneConfig, type PlaybackConfig, type SampleRate, TypedEventEmitter, VisualizationUtils, WebSocketBridge, type WebSocketConfig };
