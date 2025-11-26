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

  // Turn management
  private currentTurnId: string | null = null;
  private turnCounter = 0;

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
   * @param data - PCM audio data
   * @param turnId - Optional turn ID (uses current turn if not provided)
   */
  async playAudio(data: ArrayBuffer, turnId?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Use provided turnId or current turn
    const effectiveTurnId = turnId ?? this.currentTurnId ?? undefined;

    await this.playback.queueAudio(data, effectiveTurnId);

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
   * @deprecated Use interruptTurn() for turn-aware interruption
   */
  interrupt(): void {
    this.stopPlayback();
  }

  // ==================== Turn Management ====================

  /**
   * Generate a unique turn ID
   */
  private generateTurnId(): string {
    this.turnCounter++;
    return `turn_${Date.now()}_${this.turnCounter}`;
  }

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
  startTurn(turnId?: string): string {
    const newTurnId = turnId ?? this.generateTurnId();
    const previousTurnId = this.currentTurnId;

    // Interrupt current playback and set new turn in playback
    this.playback.interruptTurn(newTurnId);

    // Update our turn tracking
    this.currentTurnId = newTurnId;

    // Emit turn change event
    this.emit("turn:started", newTurnId, previousTurnId);

    return newTurnId;
  }

  /**
   * Get the current turn ID
   */
  getCurrentTurnId(): string | null {
    return this.currentTurnId;
  }

  /**
   * Interrupt the current turn and optionally start a new one
   * @param startNewTurn - Whether to start a new turn after interruption (default: true)
   * @returns Object with interrupted turn ID and optionally new turn ID
   */
  interruptTurn(startNewTurn: boolean = true): {
    interruptedTurnId: string | null;
    newTurnId: string | null;
  } {
    const interruptedTurnId = this.currentTurnId;

    // Interrupt playback
    this.playback.interruptTurn();

    // Emit interrupted event
    if (interruptedTurnId) {
      this.emit("turn:interrupted", interruptedTurnId);

      // Notify server about the interruption
      if (this.websocket?.isConnected()) {
        this.websocket.sendMessage({
          type: "interrupt",
          turnId: interruptedTurnId,
        });
      }
    }

    // Start new turn if requested
    let newTurnId: string | null = null;
    if (startNewTurn) {
      newTurnId = this.startTurn();
    } else {
      this.currentTurnId = null;
    }

    return { interruptedTurnId, newTurnId };
  }

  /**
   * End the current turn without starting a new one
   * Allows audio to continue playing but won't accept new audio without a turn
   */
  endTurn(): string | null {
    const endedTurnId = this.currentTurnId;
    this.currentTurnId = null;
    this.playback.setCurrentTurn(null);

    if (endedTurnId) {
      this.emit("turn:ended", endedTurnId);
    }

    return endedTurnId;
  }

  /**
   * Clear buffered audio for a specific turn or all turns
   * Does not stop currently playing audio
   * @param turnId - Specific turn to clear, or undefined for all
   */
  clearTurnBuffer(turnId?: string): void {
    this.playback.clearTurnBuffer(turnId);
  }

  /**
   * Check if audio for a given turn ID should be accepted
   * @param turnId - The turn ID to check
   */
  shouldAcceptAudioForTurn(turnId: string): boolean {
    return this.currentTurnId === null || this.currentTurnId === turnId;
  }

  /**
   * Queue audio only if it matches the current turn
   * @param data - PCM audio data
   * @param turnId - Turn ID that this audio belongs to
   * @returns true if audio was queued, false if ignored due to turn mismatch
   */
  async playAudioForTurn(data: ArrayBuffer, turnId: string): Promise<boolean> {
    if (!this.shouldAcceptAudioForTurn(turnId)) {
      return false;
    }
    await this.playAudio(data, turnId);
    return true;
  }

  // ==================== Private Methods ====================

  private setupEventForwarding(): void {
    // Microphone events
    this.microphone.on("start", () => this.emit("mic:start"));
    this.microphone.on("stop", () => this.emit("mic:stop"));
    this.microphone.on("error", (error) => this.emit("mic:error", error));

    // Microphone device events
    this.microphone.on("device-lost", () => {
      this.emit("mic:device-lost");
    });

    this.microphone.on("device-changed", (deviceId) => {
      this.emit("mic:device-changed", deviceId);
      // Re-connect analyzer after device change
      const analyzerNode = this.microphone.getAnalyzerNode();
      if (analyzerNode) {
        this.micAnalyzer.disconnect();
        this.micAnalyzer.connect(analyzerNode);
        this.micAnalyzer.start();
      }
    });

    this.microphone.on("restarting", () => {
      this.emit("mic:restarting");
    });

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

    // Device events from device manager
    this.deviceManager.on("devices-changed", (devices) =>
      this.emit("device:changed", devices)
    );
    this.deviceManager.on("input-changed", (device) => {
      this.emit("device:input-changed", device);
      // Auto-switch microphone if active and a specific device was selected
      if (this.isMicActive && device) {
        this.microphone.setDevice(device.deviceId).catch((err) => {
          this.emit("mic:error", err);
        });
      }
    });
    this.deviceManager.on("output-changed", (device) => {
      this.emit("device:output-changed", device);
      // Auto-switch playback output device
      if (device) {
        this.playback.setOutputDevice(device.deviceId).catch((err) => {
          this.emit("playback:error", err);
        });
      }
    });
    this.deviceManager.on("device-disconnected", (device) => {
      this.emit("device:disconnected", device);
    });

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

    // Auto-play received audio (with turn management)
    this.websocket.on("audio", async (data, turnId?: string) => {
      this.emit("ws:audio", data, turnId);

      // If turnId provided, check if it should be accepted
      if (turnId && !this.shouldAcceptAudioForTurn(turnId)) {
        console.log(
          `[ConversationalAudio] Ignoring audio for old turn: ${turnId} (current: ${this.currentTurnId})`
        );
        return;
      }

      try {
        await this.playAudio(data, turnId);
      } catch (error) {
        this.emit("playback:error", error as Error);
      }
    });
  }

  /**
   * Play audio received from WebSocket with turn validation
   * @param data - Audio data from WebSocket
   * @param turnId - Optional turn ID from the message
   */
  async handleWebSocketAudio(
    data: ArrayBuffer,
    turnId?: string
  ): Promise<boolean> {
    // If turnId provided, validate against current turn
    if (turnId && !this.shouldAcceptAudioForTurn(turnId)) {
      return false;
    }

    try {
      await this.playAudio(data, turnId);
      return true;
    } catch (error) {
      this.emit("playback:error", error as Error);
      return false;
    }
  }
}
