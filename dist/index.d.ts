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
 * Result from parsing incoming audio, optionally with turn ID
 */
interface ParsedAudioResult {
    data: ArrayBuffer;
    turnId?: string;
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
    /** Custom message parser for incoming audio. Return ArrayBuffer or ParsedAudioResult with turnId */
    parseIncomingAudio?: (data: MessageEvent) => ArrayBuffer | ParsedAudioResult | null;
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
interface ChatdioConfig {
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
interface ChatdioEvents {
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
declare class Chatdio extends TypedEventEmitter<ChatdioEvents> {
    private deviceManager;
    private microphone;
    private playback;
    private websocket;
    private micAnalyzer;
    private playbackAnalyzer;
    private isInitialized;
    private isMicActive;
    private config;
    private currentTurnId;
    private turnCounter;
    constructor(config?: ChatdioConfig);
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
     * @param data - PCM audio data
     * @param turnId - Optional turn ID (uses current turn if not provided)
     */
    playAudio(data: ArrayBuffer, turnId?: string): Promise<void>;
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
     * @deprecated Use interruptTurn() for turn-aware interruption
     */
    interrupt(): void;
    /**
     * Generate a unique turn ID
     */
    private generateTurnId;
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
    startTurn(turnId?: string): string;
    /**
     * Get the current turn ID
     */
    getCurrentTurnId(): string | null;
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
    setCurrentTurn(turnId: string | null, options?: {
        clearBuffer?: boolean;
        emitEvent?: boolean;
    }): void;
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
    interruptTurn(options?: {
        startNewTurn?: boolean;
        notifyServer?: boolean;
    } | boolean): {
        interruptedTurnId: string | null;
        newTurnId: string | null;
    };
    /**
     * End the current turn without starting a new one
     * Allows audio to continue playing but won't accept new audio without a turn
     */
    endTurn(): string | null;
    /**
     * Clear buffered audio for a specific turn or all turns
     * Does not stop currently playing audio
     * @param turnId - Specific turn to clear, or undefined for all
     */
    clearTurnBuffer(turnId?: string): void;
    /**
     * Check if audio for a given turn ID should be accepted
     * @param turnId - The turn ID to check
     */
    shouldAcceptAudioForTurn(turnId: string): boolean;
    /**
     * Queue audio only if it matches the current turn
     * @param data - PCM audio data
     * @param turnId - Turn ID that this audio belongs to
     * @returns true if audio was queued, false if ignored due to turn mismatch
     */
    playAudioForTurn(data: ArrayBuffer, turnId: string): Promise<boolean>;
    private setupEventForwarding;
    private setupWebSocketEvents;
    /**
     * Play audio received from WebSocket with turn validation
     * @param data - Audio data from WebSocket
     * @param turnId - Optional turn ID from the message
     */
    handleWebSocketAudio(data: ArrayBuffer, turnId?: string): Promise<boolean>;
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
    "device-lost": () => void;
    "device-changed": (deviceId: string) => void;
    restarting: () => void;
}
/**
 * Captures microphone audio with echo cancellation and resampling
 * Cross-browser compatible (Chrome, Firefox, Safari)
 * Uses AudioWorkletNode when available, falls back to ScriptProcessorNode
 */
declare class MicrophoneCapture extends TypedEventEmitter<MicrophoneCaptureEvents> {
    private audioContext;
    private mediaStream;
    private sourceNode;
    private workletNode;
    private processorNode;
    private analyzerNode;
    private isCapturing;
    private config;
    private useWorklet;
    private workletBlobUrl;
    private inputSampleRate;
    private autoRestart;
    private restartAttempts;
    private maxRestartAttempts;
    private restartDelay;
    constructor(config?: MicrophoneConfig);
    /**
     * Enable or disable auto-restart on device issues
     */
    setAutoRestart(enabled: boolean): void;
    /**
     * Check if AudioWorklet is supported
     */
    private isWorkletSupported;
    /**
     * Start capturing microphone audio
     * Must be called from a user gesture on Safari/Firefox
     */
    start(): Promise<void>;
    private startInternal;
    private setupWorkletNode;
    private setupScriptProcessorNode;
    private handleTrackEnded;
    private handleTrackMuted;
    private handleAutoRestart;
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
     * Will seamlessly restart capture with new device
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
    /**
     * Check if using AudioWorklet (vs deprecated ScriptProcessorNode)
     */
    isUsingWorklet(): boolean;
    private handleAudioProcess;
    private calculateLevel;
    private resample;
    private floatTo16BitPCM;
    private cleanupInternal;
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
    "turn-interrupted": (turnId: string) => void;
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
    private currentTurnId;
    private currentSourceTurnId;
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
     * @param turnId - Optional turn ID to associate with this audio
     */
    queueAudio(data: ArrayBuffer, turnId?: string): Promise<void>;
    /**
     * Queue pre-decoded AudioBuffer for playback
     * @param audioBuffer - Pre-decoded AudioBuffer
     * @param turnId - Optional turn ID to associate with this audio
     */
    queueAudioBuffer(audioBuffer: AudioBuffer, turnId?: string): Promise<void>;
    /**
     * Stop playback and clear queue
     */
    stop(): void;
    /**
     * Set the current turn ID. Audio from other turns will be ignored.
     * @param turnId - The turn ID to set as current, or null to clear
     */
    setCurrentTurn(turnId: string | null): void;
    /**
     * Get the current turn ID
     */
    getCurrentTurn(): string | null;
    /**
     * Interrupt the current turn: stop playback, clear buffer, and optionally set a new turn
     * @param newTurnId - Optional new turn ID to set after interruption
     * @returns The interrupted turn ID (if any)
     */
    interruptTurn(newTurnId?: string): string | null;
    /**
     * Clear audio buffer for a specific turn (or all if no turnId provided)
     * Does not stop currently playing audio unless it's from the specified turn
     * @param turnId - The turn ID to clear, or undefined to clear all
     */
    clearTurnBuffer(turnId?: string): void;
    /**
     * Check if audio for a specific turn should be accepted
     * @param turnId - The turn ID to check
     */
    shouldAcceptTurn(turnId: string): boolean;
    /**
     * Get the number of queued items for a specific turn
     */
    getQueuedCountForTurn(turnId: string): number;
    /**
     * Get buffered duration for a specific turn
     */
    getBufferedDurationForTurn(turnId: string): number;
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
    audio: (data: ArrayBuffer, turnId?: string) => void;
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

/**
 * AudioWorklet Processor for microphone capture
 * This runs in a separate audio thread for better performance
 *
 * Note: This file needs to be bundled separately or inlined as a Blob URL
 */
declare const audioWorkletProcessorCode: string;
/**
 * Creates a Blob URL for the AudioWorklet processor
 */
declare function createWorkletBlobUrl(): string;

/**
 * Utility functions for conversational-audio library
 */
/**
 * Convert an ArrayBuffer to a base64 string
 * @param buffer - The ArrayBuffer to convert
 * @returns Base64 encoded string
 */
declare function arrayBufferToBase64(buffer: ArrayBuffer): string;
/**
 * Convert a base64 string to an ArrayBuffer
 * @param base64 - The base64 string to convert
 * @returns ArrayBuffer containing the decoded data
 */
declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
/**
 * Convert a Uint8Array to a base64 string
 * @param bytes - The Uint8Array to convert
 * @returns Base64 encoded string
 */
declare function uint8ArrayToBase64(bytes: Uint8Array): string;
/**
 * Convert a base64 string to a Uint8Array
 * @param base64 - The base64 string to convert
 * @returns Uint8Array containing the decoded data
 */
declare function base64ToUint8Array(base64: string): Uint8Array;

export { ActivityAnalyzer, type ActivityAnalyzerConfig, type AudioActivityData, type AudioDevice, AudioDeviceManager, type AudioFormat, AudioFormatConverter, AudioPlayback, type BitDepth, Chatdio, type ChatdioConfig, type ChatdioEvents, type ConnectionState, type DeviceManagerConfig, MicrophoneCapture, type MicrophoneConfig, type ParsedAudioResult, type PlaybackConfig, type SampleRate, TypedEventEmitter, VisualizationUtils, WebSocketBridge, type WebSocketConfig, arrayBufferToBase64, audioWorkletProcessorCode, base64ToArrayBuffer, base64ToUint8Array, createWorkletBlobUrl, uint8ArrayToBase64 };
