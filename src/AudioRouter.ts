import { TypedEventEmitter } from "./EventEmitter";

interface AudioRouterConfig {
  sampleRate?: number;
  channels?: number;
  bufferAhead?: number;
}

interface Destination {
  name: string;
  node: AudioNode;
  gain: GainNode;
  volume: number;
  enabled: boolean;
}

interface QueuedAudio {
  buffer: AudioBuffer;
  startTime: number;
}

interface AudioRouterEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  start: () => void;
  stop: () => void;
  ended: () => void;
  error: (error: Error) => void;
  "destination-added": (name: string) => void;
  "destination-removed": (name: string) => void;
}

/**
 * Routes audio to multiple destinations simultaneously
 * Useful for playing to speakers while also streaming to other services
 *
 * @example
 * ```typescript
 * const router = new AudioRouter({ sampleRate: 24000 });
 * await router.initialize();
 *
 * // Add speaker output
 * router.addDestination('speakers', router.getContext().destination);
 *
 * // Add media stream for external service
 * const streamDest = router.getContext().createMediaStreamDestination();
 * router.addDestination('stream', streamDest);
 *
 * // Queue audio - plays to all destinations
 * router.queuePcm16(audioData);
 * ```
 */
export class AudioRouter extends TypedEventEmitter<AudioRouterEvents> {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private destinations: Map<string, Destination> = new Map();
  private audioQueue: QueuedAudio[] = [];
  private currentSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private isPaused = false;
  private nextPlayTime = 0;
  private config: Required<AudioRouterConfig>;

  constructor(config: AudioRouterConfig = {}) {
    super();
    this.config = {
      sampleRate: config.sampleRate ?? 24000,
      channels: config.channels ?? 1,
      bufferAhead: config.bufferAhead ?? 0.1,
    };
  }

  /**
   * Initialize the audio router
   */
  async initialize(): Promise<void> {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Web Audio API not supported");
    }

    this.audioContext = new AudioContextClass({
      sampleRate: this.config.sampleRate,
    });

    // Master gain for overall volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1.0;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {
        // Will resume on user interaction
      });
    }

    // Auto-play when context resumes
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
  }

  /**
   * Get the AudioContext for creating custom nodes
   */
  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error("AudioRouter not initialized");
    }
    return this.audioContext;
  }

  /**
   * Get a MediaStream of the routed audio
   * Automatically creates and registers the "stream" destination if needed
   */
  getMediaStream(): MediaStream {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }

    if (!this.streamDestination) {
      this.streamDestination = this.audioContext.createMediaStreamDestination();
    }

    // Auto-register as "stream" destination if not already added
    if (!this.destinations.has("stream")) {
      this.addDestination("stream", this.streamDestination);
    }

    return this.streamDestination.stream;
  }

  /**
   * Add a destination to route audio to
   * @param name - Unique identifier for this destination
   * @param node - AudioNode to route audio to (e.g., context.destination, MediaStreamDestination)
   * @param volume - Optional volume for this destination (0-1), defaults to 1
   */
  addDestination(name: string, node: AudioNode, volume = 1): void {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }

    if (this.destinations.has(name)) {
      throw new Error(`Destination '${name}' already exists`);
    }

    // Create individual gain node for this destination
    const gain = this.audioContext.createGain();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    gain.gain.value = clampedVolume;

    // Connect: master -> destination gain -> destination node
    this.masterGain.connect(gain);
    gain.connect(node);

    this.destinations.set(name, {
      name,
      node,
      gain,
      volume: clampedVolume,
      enabled: true,
    });
    this.emit("destination-added", name);
  }

  /**
   * Remove a destination
   * @param name - Name of the destination to remove
   */
  removeDestination(name: string): boolean {
    const dest = this.destinations.get(name);
    if (!dest) return false;

    dest.gain.disconnect();
    this.destinations.delete(name);
    this.emit("destination-removed", name);
    return true;
  }

  /**
   * Get all destination names
   */
  getDestinations(): string[] {
    return Array.from(this.destinations.keys());
  }

  /**
   * Set volume for a specific destination
   * @param name - Destination name
   * @param volume - Volume level (0-1)
   */
  setDestinationVolume(name: string, volume: number): void {
    const dest = this.destinations.get(name);
    if (dest) {
      dest.volume = Math.max(0, Math.min(1, volume));
      // Only apply if enabled
      if (dest.enabled) {
        dest.gain.gain.value = dest.volume;
      }
    }
  }

  /**
   * Enable or disable a specific destination
   * When disabled, audio is muted but the destination remains configured
   * @param name - Destination name
   * @param enabled - Whether the destination should be enabled
   */
  setDestinationEnabled(name: string, enabled: boolean): void {
    const dest = this.destinations.get(name);
    if (dest) {
      dest.enabled = enabled;
      dest.gain.gain.value = enabled ? dest.volume : 0;
    }
  }

  /**
   * Check if a destination is enabled
   * @param name - Destination name
   */
  isDestinationEnabled(name: string): boolean {
    return this.destinations.get(name)?.enabled ?? false;
  }

  /**
   * Set master volume (affects all destinations)
   * @param volume - Volume level (0-1)
   */
  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Queue PCM16 audio data for playback to all destinations
   * @param data - PCM16 audio data (16-bit signed integer, little-endian)
   */
  async queuePcm16(data: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }

    if (this.destinations.size === 0) {
      console.warn("[AudioRouter] No destinations configured");
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

    this.audioQueue.push({ buffer: audioBuffer, startTime });
    this.nextPlayTime = startTime + audioBuffer.duration;

    // Start playback if not already playing
    if (
      !this.isPlaying &&
      !this.isPaused &&
      this.audioContext.state === "running"
    ) {
      this.playNext();
    }
  }

  /**
   * Queue a pre-created AudioBuffer
   * @param audioBuffer - AudioBuffer to queue
   */
  async queueAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      throw new Error("AudioRouter not initialized");
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );

    this.audioQueue.push({ buffer: audioBuffer, startTime });
    this.nextPlayTime = startTime + audioBuffer.duration;

    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    for (const source of this.currentSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore if already stopped
      }
    }

    this.currentSources = [];
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.nextPlayTime = 0;
    this.emit("stop");
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
   * Unlock audio playback (call from user gesture for iOS)
   */
  async unlockAudio(): Promise<void> {
    if (!this.audioContext) {
      throw new Error("AudioRouter not initialized");
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Play silent buffer to unlock iOS
    const buffer = this.audioContext.createBuffer(
      1,
      1,
      this.audioContext.sampleRate
    );
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();

    for (const dest of this.destinations.values()) {
      dest.gain.disconnect();
    }
    this.destinations.clear();

    if (this.streamDestination) {
      this.streamDestination.disconnect();
      this.streamDestination = null;
    }

    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;

    this.removeAllListeners();
  }

  private playNext(): void {
    if (
      !this.audioContext ||
      !this.masterGain ||
      this.audioQueue.length === 0
    ) {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.emit("ended");
      }
      return;
    }

    const { buffer, startTime } = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);

    this.currentSources.push(source);

    source.onended = () => {
      const idx = this.currentSources.indexOf(source);
      if (idx !== -1) {
        this.currentSources.splice(idx, 1);
      }
      this.playNext();
    };

    const currentTime = this.audioContext.currentTime;
    const playAt = Math.max(startTime, currentTime);

    try {
      source.start(playAt);
    } catch (err) {
      console.error("[AudioRouter] Failed to start source:", err);
      this.emit("error", err as Error);
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.emit("start");
    }
  }
}
