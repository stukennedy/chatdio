import { TypedEventEmitter } from "./EventEmitter";
import { AudioFormatConverter } from "./MicrophoneCapture";
import type { PlaybackConfig, SampleRate, BitDepth } from "./types";

interface AudioPlaybackEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface QueuedAudio {
  buffer: AudioBuffer;
  startTime: number;
  turnId?: string;
}

/**
 * Plays audio received from a server with buffering and device management
 * Cross-browser compatible (Chrome, Firefox, Safari)
 */
export class AudioPlayback extends TypedEventEmitter<AudioPlaybackEvents> {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyzerNode: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;

  private audioQueue: QueuedAudio[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private isPaused = false;
  private nextPlayTime = 0;
  private config: Required<PlaybackConfig>;

  // For buffer management
  private bufferCheckInterval: number | null = null;
  private lowBufferThreshold = 0.5; // seconds

  // Turn management
  private currentTurnId: string | null = null;
  private currentSourceTurnId: string | null = null;

  constructor(config: PlaybackConfig = {}) {
    super();
    this.config = {
      sampleRate: config.sampleRate ?? 16000,
      bitDepth: config.bitDepth ?? 16,
      channels: config.channels ?? 1,
      deviceId: config.deviceId ?? "",
      bufferAhead: config.bufferAhead ?? 0.1,
    };
  }

  /**
   * Initialize the audio playback system
   *
   * Note: Unlike microphone access, AudioContext playback does NOT require
   * a user gesture at the exact moment of initialization. It only requires
   * that SOME user interaction has occurred on the page at some point.
   *
   * In typical conversational AI apps, the user will have clicked a button
   * to connect/start, which satisfies the browser's autoplay policy.
   *
   * If you're creating playback before any user interaction, the AudioContext
   * will start in 'suspended' state and will auto-resume when audio is queued
   * (assuming a user interaction has occurred by then).
   */
  async initialize(): Promise<void> {
    // Create AudioContext (handle Safari prefix)
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API not supported");
    }

    this.audioContext = new AudioContextClass();
    // console.log("[AudioPlayback] AudioContext created, state:", this.audioContext.state, "sampleRate:", this.audioContext.sampleRate);

    // Try to resume if suspended - this will succeed if any user interaction
    // has occurred on the page. If not, it will remain suspended and we'll
    // try again when audio is queued.
    if (this.audioContext.state === "suspended") {
      // console.log("[AudioPlayback] AudioContext suspended, attempting initial resume...");
      this.audioContext
        .resume()
        .then(() => {
          // console.log("[AudioPlayback] Initial resume succeeded, state:", this.audioContext?.state);
        })
        .catch((err) => {
          // console.log("[AudioPlayback] Initial resume failed (expected if no user gesture):", err);
        });
    }

    // Listen for state changes to auto-play queued audio when context resumes
    this.audioContext.addEventListener("statechange", () => {
      if (
        this.audioContext?.state === "running" &&
        this.audioQueue.length > 0 &&
        !this.isPlaying &&
        !this.isPaused
      ) {
        this.playNext();
      }
    });

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;

    // Create analyzer for level monitoring
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = 256;
    this.analyzerNode.smoothingTimeConstant = 0.3;

    // For output device selection (not supported in Safari)
    // We use an Audio element with MediaStream as a workaround
    if (this.supportsOutputSelection() && this.config.deviceId) {
      this.setupAudioElementOutput();
    } else {
      // Direct connection to destination
      this.gainNode.connect(this.analyzerNode);
      this.analyzerNode.connect(this.audioContext.destination);
    }

    // Start buffer monitoring
    this.startBufferMonitoring();
  }

  /**
   * Check if the AudioContext is ready to play audio
   */
  isReady(): boolean {
    return this.audioContext !== null && this.audioContext.state === "running";
  }

  /**
   * Get the current AudioContext state
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * Manually ensure the AudioContext is running.
   * Call this from a user gesture if you need to pre-warm the context.
   *
   * IMPORTANT for iOS: This method should be called directly from a user
   * gesture (click/touch) to unlock audio playback. iOS Safari requires
   * audio to be initiated from user interaction.
   */
  async ensureRunning(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Also ensure the audio element is playing (required for iOS)
    if (this.audioElement && this.audioElement.paused) {
      try {
        await this.audioElement.play();
      } catch {
        // May fail if still no user gesture context
      }
    }
  }

  /**
   * Unlock audio playback on iOS.
   *
   * iOS Safari requires audio to be "unlocked" by playing audio directly
   * in response to a user gesture (click/touch). Call this method from
   * your click/touch handler before attempting to play audio.
   *
   * This plays a tiny silent buffer which unlocks the audio system,
   * allowing subsequent programmatic audio playback.
   *
   * @example
   * ```typescript
   * button.addEventListener('click', async () => {
   *   await playback.unlockAudio();
   *   // Now audio will work even from non-user-gesture contexts
   * });
   * ```
   */
  async unlockAudio(): Promise<void> {
    if (!this.audioContext) {
      throw new Error("AudioPlayback not initialized");
    }

    // console.log("[AudioPlayback] unlockAudio called, state:", this.audioContext.state);

    // Resume context first - MUST happen synchronously in user gesture
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
        // console.log("[AudioPlayback] AudioContext resumed, new state:", this.audioContext.state);
      } catch (err) {
        console.error("[AudioPlayback] Failed to resume AudioContext:", err);
        throw err;
      }
    }

    // Play a tiny silent buffer to unlock iOS audio
    // This is the key trick that unlocks the audio system
    const buffer = this.audioContext.createBuffer(
      1,
      1,
      this.audioContext.sampleRate
    );
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
    // console.log("[AudioPlayback] Silent buffer played for iOS unlock");

    // Also try to play the audio element if it exists
    if (this.audioElement && this.audioElement.paused) {
      try {
        await this.audioElement.play();
        // console.log("[AudioPlayback] Audio element started");
      } catch (err) {
        console.warn(
          "[AudioPlayback] Audio element play failed (may be expected):",
          err
        );
      }
    }

    // console.log("[AudioPlayback] unlockAudio complete, final state:", this.audioContext.state);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.stopBufferMonitoring();

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    if (this.mediaStreamDestination) {
      this.mediaStreamDestination.disconnect();
      this.mediaStreamDestination = null;
    }

    if (this.analyzerNode) {
      this.analyzerNode.disconnect();
      this.analyzerNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;

    this.audioQueue = [];
    this.removeAllListeners();
  }

  /**
   * Queue audio data for playback
   * @param data - PCM audio data (raw bytes)
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queueAudio(data: ArrayBuffer, turnId?: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }

    // If turnId provided and doesn't match current turn, ignore
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      // console.log("[AudioPlayback] Ignoring audio for old turn:", turnId);
      return;
    }

    // console.log("[AudioPlayback] queueAudio called, bytes:", data.byteLength, "state:", this.audioContext.state);

    // Try to resume if suspended - will succeed if user has interacted with page
    if (this.audioContext.state === "suspended") {
      console.warn(
        "[AudioPlayback] AudioContext is suspended, attempting resume..."
      );
      try {
        await this.audioContext.resume();
        // console.log("[AudioPlayback] AudioContext resumed successfully, state:", this.audioContext.state);
      } catch (err) {
        // Context couldn't resume (no user interaction yet)
        // Queue the audio anyway - it will play when context resumes
        console.warn(
          "[AudioPlayback] AudioContext suspended - audio queued but won't play until user interaction. Error:",
          err
        );
      }
    }

    // Convert PCM to AudioBuffer
    const audioBuffer = this.createAudioBuffer(data);

    // Queue the buffer
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );

    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;

    // Start playback if not already playing and context is running
    if (
      !this.isPlaying &&
      !this.isPaused &&
      this.audioContext.state === "running"
    ) {
      this.playNext();
    }
  }

  /**
   * Queue PCM16 audio data for playback
   * Convenience method that handles conversion from 16-bit PCM internally.
   * @param data - PCM16 audio data (16-bit signed integer, little-endian)
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queuePcm16(data: ArrayBuffer, turnId?: string): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }

    // If turnId provided and doesn't match current turn, ignore
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      // console.log("[AudioPlayback] Ignoring PCM16 audio for old turn:", turnId);
      return;
    }

    // Try to resume if suspended
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {
        // Will play when context resumes
      }
    }

    // Convert PCM16 to Float32 and create AudioBuffer
    const floatData = Float32Array.from(new Int16Array(data), (x) => x / 32768);
    const numSamples = floatData.length / this.config.channels;
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channels,
      numSamples,
      this.config.sampleRate
    );

    // Copy data to buffer channels
    if (this.config.channels === 1) {
      audioBuffer.getChannelData(0).set(floatData);
    } else {
      // Deinterleave stereo
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < numSamples; i++) {
        left[i] = floatData[i * 2];
        right[i] = floatData[i * 2 + 1];
      }
    }

    // Queue the buffer
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );

    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;

    // Start playback if not already playing and context is running
    if (
      !this.isPlaying &&
      !this.isPaused &&
      this.audioContext.state === "running"
    ) {
      this.playNext();
    }
  }

  /**
   * Queue pre-decoded AudioBuffer for playback
   * @param audioBuffer - Pre-decoded AudioBuffer
   * @param turnId - Optional turn ID to associate with this audio
   */
  async queueAudioBuffer(
    audioBuffer: AudioBuffer,
    turnId?: string
  ): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }

    // If turnId provided and doesn't match current turn, ignore
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      return;
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );

    this.audioQueue.push({ buffer: audioBuffer, startTime, turnId });
    this.nextPlayTime = startTime + audioBuffer.duration;

    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.currentSourceTurnId = null;
    this.emit("stop");
  }

  // ==================== Turn Management ====================

  /**
   * Set the current turn ID. Audio from other turns will be ignored.
   * @param turnId - The turn ID to set as current, or null to clear
   */
  setCurrentTurn(turnId: string | null): void {
    this.currentTurnId = turnId;
  }

  /**
   * Get the current turn ID
   */
  getCurrentTurn(): string | null {
    return this.currentTurnId;
  }

  /**
   * Interrupt the current turn: stop playback, clear buffer, and optionally set a new turn
   * @param newTurnId - Optional new turn ID to set after interruption
   * @returns The interrupted turn ID (if any)
   */
  interruptTurn(newTurnId?: string): string | null {
    const interruptedTurnId = this.currentTurnId;

    // Stop current playback
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignore if already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    // Clear the queue
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.currentSourceTurnId = null;

    // Set new turn if provided
    if (newTurnId !== undefined) {
      this.currentTurnId = newTurnId;
    }

    // Emit events
    if (interruptedTurnId) {
      this.emit("turn-interrupted", interruptedTurnId);
    }
    this.emit("stop");

    return interruptedTurnId;
  }

  /**
   * Clear audio buffer for a specific turn (or all if no turnId provided)
   * Does not stop currently playing audio unless it's from the specified turn
   * @param turnId - The turn ID to clear, or undefined to clear all
   */
  clearTurnBuffer(turnId?: string): void {
    if (turnId === undefined) {
      // Clear all queued audio
      this.audioQueue = [];
      this.nextPlayTime = this.audioContext?.currentTime ?? 0;
    } else {
      // Clear only audio from specific turn
      this.audioQueue = this.audioQueue.filter(
        (item) => item.turnId !== turnId
      );

      // Recalculate next play time
      if (this.audioQueue.length > 0) {
        const lastItem = this.audioQueue[this.audioQueue.length - 1];
        this.nextPlayTime = lastItem.startTime + lastItem.buffer.duration;
      } else {
        this.nextPlayTime = this.audioContext?.currentTime ?? 0;
      }

      // Stop current source if it's from the cleared turn
      if (this.currentSourceTurnId === turnId && this.currentSource) {
        try {
          this.currentSource.stop();
        } catch {
          // Ignore
        }
        this.currentSource.disconnect();
        this.currentSource = null;
        this.playNext();
      }
    }
  }

  /**
   * Check if audio for a specific turn should be accepted
   * @param turnId - The turn ID to check
   */
  shouldAcceptTurn(turnId: string): boolean {
    return this.currentTurnId === null || this.currentTurnId === turnId;
  }

  /**
   * Get the number of queued items for a specific turn
   */
  getQueuedCountForTurn(turnId: string): number {
    return this.audioQueue.filter((item) => item.turnId === turnId).length;
  }

  /**
   * Get buffered duration for a specific turn
   */
  getBufferedDurationForTurn(turnId: string): number {
    return this.audioQueue
      .filter((item) => item.turnId === turnId)
      .reduce((sum, item) => sum + item.buffer.duration, 0);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.suspend();
      this.isPaused = true;
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.isPaused) {
      await this.audioContext.resume();
      this.isPaused = false;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.gainNode?.gain.value ?? 1;
  }

  /**
   * Check if currently playing
   */
  isActive(): boolean {
    return this.isPlaying && !this.isPaused;
  }

  /**
   * Get buffered audio duration in seconds
   */
  getBufferedDuration(): number {
    return this.audioQueue.reduce((sum, item) => sum + item.buffer.duration, 0);
  }

  /**
   * Set output device (not supported in Safari)
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    this.config.deviceId = deviceId;

    if (!this.supportsOutputSelection()) {
      console.warn(
        "Output device selection not supported in this browser (Safari)"
      );
      return;
    }

    if (this.audioElement) {
      try {
        await (
          this.audioElement as HTMLAudioElement & {
            setSinkId: (id: string) => Promise<void>;
          }
        ).setSinkId(deviceId);
      } catch (error) {
        this.emit(
          "error",
          new Error(`Failed to set output device: ${(error as Error).message}`)
        );
      }
    }
  }

  /**
   * Check if output device selection is supported
   */
  supportsOutputSelection(): boolean {
    const audio = document.createElement("audio");
    return "setSinkId" in audio;
  }

  /**
   * Get the analyzer node for external visualization
   */
  getAnalyzerNode(): AnalyserNode | null {
    return this.analyzerNode;
  }

  /**
   * Update audio format configuration
   */
  updateFormat(
    config: Partial<
      Pick<PlaybackConfig, "sampleRate" | "bitDepth" | "channels">
    >
  ): void {
    if (config.sampleRate !== undefined)
      this.config.sampleRate = config.sampleRate;
    if (config.bitDepth !== undefined) this.config.bitDepth = config.bitDepth;
    if (config.channels !== undefined) this.config.channels = config.channels;
  }

  private setupAudioElementOutput(): void {
    if (!this.audioContext || !this.gainNode || !this.analyzerNode) return;

    // Create a MediaStream destination
    this.mediaStreamDestination =
      this.audioContext.createMediaStreamDestination();

    // Connect audio graph through the MediaStream
    this.gainNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.mediaStreamDestination);

    // Create audio element to play the stream (allows setSinkId)
    this.audioElement = document.createElement("audio");
    this.audioElement.srcObject = this.mediaStreamDestination.stream;
    this.audioElement.autoplay = true;
    // Critical for iOS - allows inline playback without fullscreen
    // Use setAttribute for cross-browser compatibility and TypeScript
    this.audioElement.setAttribute("playsinline", "true");
    this.audioElement.setAttribute("webkit-playsinline", "true");

    // Explicitly call play() - will fail without user gesture but that's expected
    // The audio will start when ensureRunning() is called from user interaction
    this.audioElement.play().catch(() => {
      // Expected to fail without user gesture - will retry on ensureRunning()
    });

    // Set output device if specified
    if (this.config.deviceId && "setSinkId" in this.audioElement) {
      (
        this.audioElement as HTMLAudioElement & {
          setSinkId: (id: string) => Promise<void>;
        }
      )
        .setSinkId(this.config.deviceId)
        .catch((err) => {
          console.warn("Failed to set output device:", err);
        });
    }
  }

  private createAudioBuffer(data: ArrayBuffer): AudioBuffer {
    if (!this.audioContext) {
      throw new Error("AudioContext not initialized");
    }

    // Convert PCM to Float32
    const floatData = AudioFormatConverter.pcmToFloat(
      data,
      this.config.bitDepth
    );

    // Create AudioBuffer
    const numSamples = floatData.length / this.config.channels;
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channels,
      numSamples,
      this.config.sampleRate
    );

    // Copy data to buffer channels
    if (this.config.channels === 1) {
      audioBuffer.getChannelData(0).set(floatData);
    } else {
      // Deinterleave stereo
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      for (let i = 0; i < numSamples; i++) {
        left[i] = floatData[i * 2];
        right[i] = floatData[i * 2 + 1];
      }
    }

    return audioBuffer;
  }

  private playNext(): void {
    if (!this.audioContext || !this.gainNode || this.audioQueue.length === 0) {
      if (this.isPlaying) {
        // console.log("[AudioPlayback] playNext: queue empty, playback ended");
        this.isPlaying = false;
        this.currentSourceTurnId = null;
        this.emit("ended");
        this.emit("buffer-empty");
      }
      return;
    }

    const { buffer, startTime, turnId } = this.audioQueue.shift()!;

    // Skip if this audio is from an old turn
    if (turnId && this.currentTurnId && turnId !== this.currentTurnId) {
      // console.log("[AudioPlayback] playNext: skipping old turn audio");
      this.playNext();
      return;
    }

    // console.log("[AudioPlayback] playNext: playing buffer, duration:", buffer.duration.toFixed(3), "s, sampleRate:", buffer.sampleRate, "contextState:", this.audioContext.state);

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.gainNode);
    this.currentSourceTurnId = turnId ?? null;

    this.currentSource.onended = () => {
      // console.log("[AudioPlayback] playNext: buffer ended, playing next");
      this.playNext();
    };

    // Schedule playback
    const currentTime = this.audioContext.currentTime;
    const playAt = Math.max(startTime, currentTime);

    try {
      this.currentSource.start(playAt);
      // console.log("[AudioPlayback] playNext: started at", playAt.toFixed(3), "currentTime:", currentTime.toFixed(3));
    } catch (err) {
      console.error("[AudioPlayback] playNext: failed to start source:", err);
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.emit("start");
    }

    // Emit level updates
    this.emitLevel();
  }

  private emitLevel(): void {
    if (!this.analyzerNode || !this.isPlaying) return;

    const dataArray = new Float32Array(this.analyzerNode.frequencyBinCount);
    this.analyzerNode.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const level = Math.sqrt(sum / dataArray.length);
    this.emit("level", level);
  }

  private startBufferMonitoring(): void {
    this.bufferCheckInterval = window.setInterval(() => {
      const buffered = this.getBufferedDuration();
      if (
        this.isPlaying &&
        buffered < this.lowBufferThreshold &&
        buffered > 0
      ) {
        this.emit("buffer-low");
      }
    }, 100);
  }

  private stopBufferMonitoring(): void {
    if (this.bufferCheckInterval !== null) {
      clearInterval(this.bufferCheckInterval);
      this.bufferCheckInterval = null;
    }
  }
}
