import { TypedEventEmitter } from "./EventEmitter";
import type { AudioDevice, DeviceManagerConfig } from "./types";

interface DeviceManagerEvents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export class AudioDeviceManager extends TypedEventEmitter<DeviceManagerEvents> {
  private devices: AudioDevice[] = [];
  private currentInputId: string | null = null;
  private currentOutputId: string | null = null;
  private pollInterval: number | null = null;
  private config: Required<DeviceManagerConfig>;
  private permissionGranted = false;

  constructor(config: DeviceManagerConfig = {}) {
    super();
    this.config = {
      autoFallback: config.autoFallback ?? true,
      pollInterval: config.pollInterval ?? 1000,
    };
  }

  /**
   * Initialize device manager and request permissions
   * Must be called from a user gesture (click/touch) for Safari/Firefox
   */
  async initialize(): Promise<void> {
    // Check for mediaDevices support
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error("MediaDevices API not supported in this browser");
    }

    // Request permission by getting a temporary stream
    // This is required to get device labels in all browsers
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.permissionGranted = true;
    } catch (error) {
      throw new Error(
        `Microphone permission denied: ${(error as Error).message}`
      );
    }

    await this.refreshDevices();
    this.startPolling();

    // Listen for device changes (not supported in all browsers)
    if (navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        this.handleDeviceChange
      );
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopPolling();
    if (navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        this.handleDeviceChange
      );
    }
    this.removeAllListeners();
  }

  /**
   * Get all available audio devices
   */
  getDevices(): AudioDevice[] {
    return [...this.devices];
  }

  /**
   * Get input (microphone) devices
   */
  getInputDevices(): AudioDevice[] {
    return this.devices.filter((d) => d.kind === "audioinput");
  }

  /**
   * Get output (speaker) devices
   */
  getOutputDevices(): AudioDevice[] {
    return this.devices.filter((d) => d.kind === "audiooutput");
  }

  /**
   * Get currently selected input device
   */
  getCurrentInput(): AudioDevice | null {
    return this.devices.find((d) => d.deviceId === this.currentInputId) ?? null;
  }

  /**
   * Get currently selected output device
   */
  getCurrentOutput(): AudioDevice | null {
    return (
      this.devices.find((d) => d.deviceId === this.currentOutputId) ?? null
    );
  }

  /**
   * Set the input device
   */
  async setInputDevice(deviceId: string): Promise<void> {
    const device = this.devices.find(
      (d) => d.deviceId === deviceId && d.kind === "audioinput"
    );
    if (!device) {
      throw new Error(`Input device not found: ${deviceId}`);
    }
    this.currentInputId = deviceId;
    this.emit("input-changed", device);
  }

  /**
   * Set the output device
   * Note: Not supported in Safari - will fall back to default
   */
  async setOutputDevice(deviceId: string): Promise<void> {
    const device = this.devices.find(
      (d) => d.deviceId === deviceId && d.kind === "audiooutput"
    );
    if (!device) {
      throw new Error(`Output device not found: ${deviceId}`);
    }
    this.currentOutputId = deviceId;
    this.emit("output-changed", device);
  }

  /**
   * Check if output device selection is supported
   * (Not available in Safari)
   */
  isOutputSelectionSupported(): boolean {
    const audio = document.createElement("audio");
    return "setSinkId" in audio;
  }

  /**
   * Get the device ID to use for input
   */
  getInputDeviceId(): string | undefined {
    return this.currentInputId ?? undefined;
  }

  /**
   * Get the device ID to use for output
   */
  getOutputDeviceId(): string | undefined {
    return this.currentOutputId ?? undefined;
  }

  /**
   * Refresh the device list
   */
  async refreshDevices(): Promise<void> {
    try {
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = rawDevices
        .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
        .map((d, index) => this.mapDevice(d, index));

      // Check for disconnected devices
      const oldDeviceIds = new Set(this.devices.map((d) => d.deviceId));
      const newDeviceIds = new Set(audioDevices.map((d) => d.deviceId));

      // Emit events for disconnected devices
      for (const device of this.devices) {
        if (!newDeviceIds.has(device.deviceId)) {
          this.emit("device-disconnected", device);

          // Handle auto-fallback
          if (this.config.autoFallback) {
            if (device.deviceId === this.currentInputId) {
              const defaultInput = audioDevices.find(
                (d) => d.kind === "audioinput" && d.isDefault
              );
              this.currentInputId = defaultInput?.deviceId ?? null;
              this.emit("input-changed", defaultInput ?? null);
            }
            if (device.deviceId === this.currentOutputId) {
              const defaultOutput = audioDevices.find(
                (d) => d.kind === "audiooutput" && d.isDefault
              );
              this.currentOutputId = defaultOutput?.deviceId ?? null;
              this.emit("output-changed", defaultOutput ?? null);
            }
          }
        }
      }

      // Check if device list changed
      const hasChanged =
        this.devices.length !== audioDevices.length ||
        audioDevices.some((d) => !oldDeviceIds.has(d.deviceId));

      this.devices = audioDevices;

      if (hasChanged) {
        this.emit("devices-changed", this.devices);
      }
    } catch (error) {
      this.emit("error", error as Error);
    }
  }

  private mapDevice(device: MediaDeviceInfo, index: number): AudioDevice {
    // Handle case where labels aren't available (no permission)
    const label =
      device.label ||
      `${device.kind === "audioinput" ? "Microphone" : "Speaker"} ${index + 1}`;

    return {
      deviceId: device.deviceId,
      label,
      kind: device.kind as "audioinput" | "audiooutput",
      isDefault:
        device.deviceId === "default" ||
        label.toLowerCase().includes("default"),
    };
  }

  private handleDeviceChange = async (): Promise<void> => {
    await this.refreshDevices();
  };

  private startPolling(): void {
    // Polling as fallback for browsers that don't support devicechange event
    // Also helps catch devices that appear after initial enumeration
    this.pollInterval = window.setInterval(() => {
      this.refreshDevices();
    }, this.config.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
