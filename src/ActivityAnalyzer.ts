import { TypedEventEmitter } from "./EventEmitter";
import type { ActivityAnalyzerConfig, AudioActivityData } from "./types";

interface ActivityAnalyzerEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
  activity: (data: AudioActivityData) => void;
  "speaking-start": () => void;
  "speaking-stop": () => void;
}

/**
 * Analyzes audio nodes to provide real-time activity data for visualization
 * Works with both microphone input and playback output
 */
export class ActivityAnalyzer extends TypedEventEmitter<ActivityAnalyzerEvents> {
  private analyzerNode: AnalyserNode | null = null;
  private config: Required<ActivityAnalyzerConfig>;
  private animationFrameId: number | null = null;
  private intervalId: number | null = null;
  private isRunning = false;

  // For speaking detection
  private isSpeaking = false;
  private speakingThreshold = 0.02; // RMS threshold
  private silenceTimeout = 300; // ms of silence before speaking ends
  private lastSoundTime = 0;
  private peakLevel = 0;
  private peakDecay = 0.95; // Peak decay rate per frame

  // Buffers for visualization data
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private timeDomainData: Uint8Array<ArrayBuffer> | null = null;

  constructor(config: ActivityAnalyzerConfig = {}) {
    super();
    this.config = {
      fftSize: config.fftSize ?? 256,
      smoothingTimeConstant: config.smoothingTimeConstant ?? 0.8,
      updateInterval: config.updateInterval ?? 50,
    };
  }

  /**
   * Set the speaking detection threshold (0-1)
   */
  setSpeakingThreshold(threshold: number): void {
    this.speakingThreshold = Math.max(0.001, Math.min(0.5, threshold));
  }

  /**
   * Get current speaking threshold
   */
  getSpeakingThreshold(): number {
    return this.speakingThreshold;
  }

  /**
   * Set the silence timeout in milliseconds
   */
  setSilenceTimeout(ms: number): void {
    this.silenceTimeout = Math.max(100, Math.min(2000, ms));
  }

  /**
   * Connect to an AnalyserNode for monitoring
   */
  connect(analyzerNode: AnalyserNode): void {
    this.analyzerNode = analyzerNode;
    this.analyzerNode.fftSize = this.config.fftSize;
    this.analyzerNode.smoothingTimeConstant = this.config.smoothingTimeConstant;

    // Initialize data buffers
    const binCount = this.analyzerNode.frequencyBinCount;
    this.frequencyData = new Uint8Array(binCount);
    this.timeDomainData = new Uint8Array(binCount);
  }

  /**
   * Disconnect from the current analyzer node
   */
  disconnect(): void {
    this.stop();
    this.analyzerNode = null;
    this.frequencyData = null;
    this.timeDomainData = null;
  }

  /**
   * Start analyzing and emitting activity events
   */
  start(): void {
    if (this.isRunning || !this.analyzerNode) {
      return;
    }

    this.isRunning = true;
    this.peakLevel = 0;

    // Use requestAnimationFrame for smooth visualization
    // or setInterval for background processing
    if (typeof window !== "undefined" && this.config.updateInterval <= 20) {
      this.startWithAnimationFrame();
    } else {
      this.startWithInterval();
    }
  }

  /**
   * Stop analyzing
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Reset speaking state
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.emit("speaking-stop");
    }
  }

  /**
   * Check if currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current activity data synchronously
   */
  getActivityData(): AudioActivityData | null {
    if (!this.analyzerNode || !this.frequencyData || !this.timeDomainData) {
      return null;
    }

    return this.analyze();
  }

  /**
   * Get the frequency data for custom visualization
   */
  getFrequencyData(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyzerNode || !this.frequencyData) {
      return null;
    }
    this.analyzerNode.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  /**
   * Get the time domain data for waveform visualization
   */
  getTimeDomainData(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyzerNode || !this.timeDomainData) {
      return null;
    }
    this.analyzerNode.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }

  /**
   * Get normalized frequency bands for bar visualization
   * @param numBands - Number of frequency bands to return
   */
  getFrequencyBands(numBands: number = 8): number[] {
    const freqData = this.getFrequencyData();
    if (!freqData) {
      return new Array(numBands).fill(0);
    }

    const bands: number[] = [];
    const bandSize = Math.floor(freqData.length / numBands);

    for (let i = 0; i < numBands; i++) {
      let sum = 0;
      const start = i * bandSize;
      const end = start + bandSize;

      for (let j = start; j < end && j < freqData.length; j++) {
        sum += freqData[j];
      }

      // Normalize to 0-1
      bands.push(sum / bandSize / 255);
    }

    return bands;
  }

  private startWithAnimationFrame(): void {
    let lastUpdate = 0;
    const minInterval = this.config.updateInterval;

    const update = (timestamp: number) => {
      if (!this.isRunning) return;

      if (timestamp - lastUpdate >= minInterval) {
        this.updateAndEmit();
        lastUpdate = timestamp;
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  private startWithInterval(): void {
    this.intervalId = window.setInterval(() => {
      if (this.isRunning) {
        this.updateAndEmit();
      }
    }, this.config.updateInterval);
  }

  private updateAndEmit(): void {
    const data = this.analyze();
    if (data) {
      this.emit("activity", data);
    }
  }

  private analyze(): AudioActivityData | null {
    if (!this.analyzerNode || !this.frequencyData || !this.timeDomainData) {
      return null;
    }

    // Get current data
    this.analyzerNode.getByteFrequencyData(this.frequencyData);
    this.analyzerNode.getByteTimeDomainData(this.timeDomainData);

    // Calculate RMS volume from time domain data
    let sum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      // Convert from 0-255 to -1 to 1
      const sample = (this.timeDomainData[i] - 128) / 128;
      sum += sample * sample;
    }
    const volume = Math.sqrt(sum / this.timeDomainData.length);

    // Update peak with decay
    if (volume > this.peakLevel) {
      this.peakLevel = volume;
    } else {
      this.peakLevel *= this.peakDecay;
    }

    // Detect speaking state changes
    const now = Date.now();
    const wasSpeaking = this.isSpeaking;

    if (volume > this.speakingThreshold) {
      this.lastSoundTime = now;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.emit("speaking-start");
      }
    } else if (
      this.isSpeaking &&
      now - this.lastSoundTime > this.silenceTimeout
    ) {
      this.isSpeaking = false;
      this.emit("speaking-stop");
    }

    return {
      volume,
      peak: this.peakLevel,
      frequencyData: this.frequencyData,
      timeDomainData: this.timeDomainData,
      isSpeaking: this.isSpeaking,
    };
  }
}

/**
 * Creates visualization data utilities
 */
export class VisualizationUtils {
  /**
   * Smooth array values over time (for animations)
   */
  static smoothArray(
    current: number[],
    target: number[],
    smoothing: number = 0.3
  ): number[] {
    return current.map((val, i) => val + (target[i] - val) * smoothing);
  }

  /**
   * Convert frequency data to logarithmic scale (better for music/speech)
   */
  static toLogScale(data: Uint8Array, outputSize: number): number[] {
    const result: number[] = [];
    const logMax = Math.log(data.length);

    for (let i = 0; i < outputSize; i++) {
      const logIndex = Math.exp((i / outputSize) * logMax);
      const index = Math.min(Math.floor(logIndex), data.length - 1);
      result.push(data[index] / 255);
    }

    return result;
  }

  /**
   * Get a CSS color based on volume level
   */
  static volumeToColor(
    volume: number,
    colors: { low: string; mid: string; high: string }
  ): string {
    if (volume < 0.3) return colors.low;
    if (volume < 0.7) return colors.mid;
    return colors.high;
  }

  /**
   * Convert volume to decibels
   */
  static volumeToDb(volume: number): number {
    if (volume === 0) return -Infinity;
    return 20 * Math.log10(volume);
  }

  /**
   * Create a simple waveform path for SVG
   */
  static createWaveformPath(
    timeDomainData: Uint8Array,
    width: number,
    height: number
  ): string {
    const sliceWidth = width / timeDomainData.length;
    let path = "M 0 " + height / 2;

    for (let i = 0; i < timeDomainData.length; i++) {
      const v = timeDomainData[i] / 255;
      const y = v * height;
      const x = i * sliceWidth;
      path += ` L ${x} ${y}`;
    }

    return path;
  }

  /**
   * Create bar heights for frequency visualization
   */
  static createBarHeights(
    frequencyData: Uint8Array,
    numBars: number,
    maxHeight: number
  ): number[] {
    const heights: number[] = [];
    const step = Math.floor(frequencyData.length / numBars);

    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += frequencyData[i * step + j];
      }
      const average = sum / step;
      heights.push((average / 255) * maxHeight);
    }

    return heights;
  }
}
