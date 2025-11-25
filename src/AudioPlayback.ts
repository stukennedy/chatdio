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
}

interface QueuedAudio {
  buffer: AudioBuffer;
  startTime: number;
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
   * Should be called from a user gesture for Safari/Firefox
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

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

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
   */
  async queueAudio(data: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
    }

    // Ensure context is running
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Convert PCM to AudioBuffer
    const audioBuffer = this.createAudioBuffer(data);

    // Queue the buffer
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(
      this.nextPlayTime,
      currentTime + this.config.bufferAhead
    );

    this.audioQueue.push({ buffer: audioBuffer, startTime });
    this.nextPlayTime = startTime + audioBuffer.duration;

    // Start playback if not already playing
    if (!this.isPlaying && !this.isPaused) {
      this.playNext();
    }
  }

  /**
   * Queue pre-decoded AudioBuffer for playback
   */
  async queueAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error("AudioPlayback not initialized");
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
        this.isPlaying = false;
        this.emit("ended");
        this.emit("buffer-empty");
      }
      return;
    }

    const { buffer, startTime } = this.audioQueue.shift()!;

    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(this.gainNode);

    this.currentSource.onended = () => {
      this.playNext();
    };

    // Schedule playback
    const currentTime = this.audioContext.currentTime;
    const playAt = Math.max(startTime, currentTime);
    this.currentSource.start(playAt);

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
