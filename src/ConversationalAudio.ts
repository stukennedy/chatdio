import { TypedEventEmitter } from "./EventEmitter";
import { AudioDeviceManager } from "./AudioDeviceManager";
import { MicrophoneCapture } from "./MicrophoneCapture";
import { AudioPlayback } from "./AudioPlayback";
import { WebSocketBridge } from "./WebSocketBridge";
import { ActivityAnalyzer } from "./ActivityAnalyzer";
import type {
  ConversationalAudioConfig,
  ConversationalAudioEvents,
  AudioDevice,
  AudioActivityData,
  ConnectionState,
} from "./types";

/**
 * Main orchestrator for conversational AI audio
 * Manages microphone capture, audio playback, WebSocket streaming,
 * and real-time activity visualization
 */
export class ConversationalAudio extends TypedEventEmitter<ConversationalAudioEvents> {
  private deviceManager: AudioDeviceManager;
  private microphone: MicrophoneCapture;
  private playback: AudioPlayback;
  private websocket: WebSocketBridge | null = null;
  private micAnalyzer: ActivityAnalyzer;
  private playbackAnalyzer: ActivityAnalyzer;

  private isInitialized = false;
  private isMicActive = false;
  private config: ConversationalAudioConfig;

  constructor(config: ConversationalAudioConfig = {}) {
    super();
    this.config = config;

    // Initialize components
    this.deviceManager = new AudioDeviceManager(config.deviceManager);
    this.microphone = new MicrophoneCapture(config.microphone);
    this.playback = new AudioPlayback(config.playback);
    this.micAnalyzer = new ActivityAnalyzer(config.activityAnalyzer);
    this.playbackAnalyzer = new ActivityAnalyzer(config.activityAnalyzer);

    // Create WebSocket bridge if config provided
    if (config.websocket) {
      this.websocket = new WebSocketBridge(config.websocket);
    }

    this.setupEventForwarding();
  }

  /**
   * Initialize the audio system
   * Must be called from a user gesture (click/touch) for browser compatibility
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize device manager first (requests permissions)
      await this.deviceManager.initialize();

      // Initialize playback system
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
  dispose(): void {
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
  async startMicrophone(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Use selected device from device manager
    const inputDevice = this.deviceManager.getInputDeviceId();
    if (inputDevice) {
      await this.microphone.updateConfig({ deviceId: inputDevice });
    }

    await this.microphone.start();
    this.isMicActive = true;

    // Connect analyzer
    const analyzerNode = this.microphone.getAnalyzerNode();
    if (analyzerNode) {
      this.micAnalyzer.connect(analyzerNode);
      this.micAnalyzer.start();
    }
  }

  /**
   * Stop capturing microphone audio
   */
  stopMicrophone(): void {
    this.micAnalyzer.stop();
    this.microphone.stop();
    this.isMicActive = false;
  }

  /**
   * Check if microphone is active
   */
  isMicrophoneActive(): boolean {
    return this.microphone.isActive();
  }

  /**
   * Set microphone mute state (still captures but doesn't send)
   */
  private micMuted = false;

  setMicrophoneMuted(muted: boolean): void {
    this.micMuted = muted;
  }

  /**
   * Check if microphone is muted
   */
  isMicrophoneMuted(): boolean {
    return this.micMuted;
  }

  // ==================== Playback Methods ====================

  /**
   * Queue audio data for playback
   */
  async playAudio(data: ArrayBuffer): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.playback.queueAudio(data);

    // Connect analyzer if not connected
    const analyzerNode = this.playback.getAnalyzerNode();
    if (analyzerNode && !this.playbackAnalyzer.isActive()) {
      this.playbackAnalyzer.connect(analyzerNode);
      this.playbackAnalyzer.start();
    }
  }

  /**
   * Stop playback and clear queue
   */
  stopPlayback(): void {
    this.playbackAnalyzer.stop();
    this.playback.stop();
  }

  /**
   * Pause playback
   */
  pausePlayback(): void {
    this.playback.pause();
  }

  /**
   * Resume playback
   */
  async resumePlayback(): Promise<void> {
    await this.playback.resume();
  }

  /**
   * Check if playback is active
   */
  isPlaybackActive(): boolean {
    return this.playback.isActive();
  }

  /**
   * Set playback volume (0-1)
   */
  setVolume(volume: number): void {
    this.playback.setVolume(volume);
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.playback.getVolume();
  }

  // ==================== WebSocket Methods ====================

  /**
   * Connect to WebSocket server
   */
  async connectWebSocket(url?: string): Promise<void> {
    if (url && !this.websocket) {
      this.websocket = new WebSocketBridge({
        url,
        ...this.config.websocket,
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
  disconnectWebSocket(): void {
    if (this.websocket) {
      this.websocket.disconnect();
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.websocket?.isConnected() ?? false;
  }

  /**
   * Get WebSocket connection state
   */
  getWebSocketState(): ConnectionState {
    return this.websocket?.getState() ?? "disconnected";
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(message: unknown): void {
    if (!this.websocket) {
      throw new Error("WebSocket not configured");
    }
    this.websocket.sendMessage(message);
  }

  // ==================== Device Methods ====================

  /**
   * Get all audio devices
   */
  getDevices(): AudioDevice[] {
    return this.deviceManager.getDevices();
  }

  /**
   * Get input (microphone) devices
   */
  getInputDevices(): AudioDevice[] {
    return this.deviceManager.getInputDevices();
  }

  /**
   * Get output (speaker) devices
   */
  getOutputDevices(): AudioDevice[] {
    return this.deviceManager.getOutputDevices();
  }

  /**
   * Get currently selected input device
   */
  getCurrentInputDevice(): AudioDevice | null {
    return this.deviceManager.getCurrentInput();
  }

  /**
   * Get currently selected output device
   */
  getCurrentOutputDevice(): AudioDevice | null {
    return this.deviceManager.getCurrentOutput();
  }

  /**
   * Set input device
   */
  async setInputDevice(deviceId: string): Promise<void> {
    await this.deviceManager.setInputDevice(deviceId);

    // Update microphone if active
    if (this.isMicActive) {
      await this.microphone.setDevice(deviceId);
    }
  }

  /**
   * Set output device
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    await this.deviceManager.setOutputDevice(deviceId);
    await this.playback.setOutputDevice(deviceId);
  }

  /**
   * Check if output device selection is supported
   */
  isOutputSelectionSupported(): boolean {
    return this.deviceManager.isOutputSelectionSupported();
  }

  // ==================== Activity/Visualization Methods ====================

  /**
   * Get microphone activity analyzer
   */
  getMicrophoneAnalyzer(): ActivityAnalyzer {
    return this.micAnalyzer;
  }

  /**
   * Get playback activity analyzer
   */
  getPlaybackAnalyzer(): ActivityAnalyzer {
    return this.playbackAnalyzer;
  }

  /**
   * Get current microphone activity data
   */
  getMicrophoneActivity(): AudioActivityData | null {
    return this.micAnalyzer.getActivityData();
  }

  /**
   * Get current playback activity data
   */
  getPlaybackActivity(): AudioActivityData | null {
    return this.playbackAnalyzer.getActivityData();
  }

  // ==================== Full-Duplex Conversation Mode ====================

  /**
   * Start a full-duplex conversation session
   * Captures mic, connects WebSocket, streams audio both ways
   */
  async startConversation(websocketUrl?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Connect WebSocket if URL provided or configured
    if (websocketUrl || this.websocket) {
      await this.connectWebSocket(websocketUrl);
    }

    // Start microphone
    await this.startMicrophone();
  }

  /**
   * Stop the conversation session
   */
  stopConversation(): void {
    this.stopMicrophone();
    this.stopPlayback();
    // Note: WebSocket stays connected - use disconnectWebSocket() to fully disconnect
  }

  /**
   * Interrupt current playback (useful for barge-in)
   */
  interrupt(): void {
    this.stopPlayback();
  }

  // ==================== Private Methods ====================

  private setupEventForwarding(): void {
    // Microphone events
    this.microphone.on("start", () => this.emit("mic:start"));
    this.microphone.on("stop", () => this.emit("mic:stop"));
    this.microphone.on("error", (error) => this.emit("mic:error", error));

    // Forward audio data to WebSocket
    this.microphone.on("data", (data) => {
      this.emit("mic:data", data);

      if (this.websocket && !this.micMuted) {
        this.websocket.sendAudio(data);
      }
    });

    // Microphone activity
    this.micAnalyzer.on("activity", (data) => this.emit("mic:activity", data));

    // Playback events
    this.playback.on("start", () => this.emit("playback:start"));
    this.playback.on("stop", () => this.emit("playback:stop"));
    this.playback.on("ended", () => this.emit("playback:ended"));
    this.playback.on("error", (error) => this.emit("playback:error", error));

    // Playback activity
    this.playbackAnalyzer.on("activity", (data) =>
      this.emit("playback:activity", data)
    );

    // Device events
    this.deviceManager.on("devices-changed", (devices) =>
      this.emit("device:changed", devices)
    );
    this.deviceManager.on("input-changed", (device) =>
      this.emit("device:input-changed", device)
    );
    this.deviceManager.on("output-changed", (device) =>
      this.emit("device:output-changed", device)
    );
    this.deviceManager.on("device-disconnected", (device) =>
      this.emit("device:disconnected", device)
    );

    // WebSocket events (if configured initially)
    if (this.websocket) {
      this.setupWebSocketEvents();
    }
  }

  private setupWebSocketEvents(): void {
    if (!this.websocket) return;

    this.websocket.on("connected", () => this.emit("ws:connected"));
    this.websocket.on("disconnected", (code, reason) =>
      this.emit("ws:disconnected", code, reason)
    );
    this.websocket.on("reconnecting", (attempt) =>
      this.emit("ws:reconnecting", attempt)
    );
    this.websocket.on("error", (error) => this.emit("ws:error", error));
    this.websocket.on("message", (data) => this.emit("ws:message", data));

    // Auto-play received audio
    this.websocket.on("audio", async (data) => {
      this.emit("ws:audio", data);

      try {
        await this.playAudio(data);
      } catch (error) {
        this.emit("playback:error", error as Error);
      }
    });
  }
}
