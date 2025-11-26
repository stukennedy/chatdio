# Conversational Audio Example

A complete demo showing all features of the `chatdio` library.

## Quick Start

### 1. Install Dependencies & Build

From the project root:

```bash
npm install
npm run build
```

### 2. Run the Demo Server

```bash
npm run example
```

This starts a single server that handles both:
- **Static files** at http://localhost:3000
- **WebSocket** at ws://localhost:3000/audio

Open http://localhost:3000 in your browser and click "Initialize Audio" to begin.

## Features Demonstrated

### 🎤 Microphone Capture
- Click "Initialize Audio" to request microphone permissions
- Click "Start Conversation" to begin capturing
- Real-time waveform visualization
- Level meter with voice activity detection

### 🔊 Audio Playback
- Click "Play Test Tone" to hear a 440Hz sine wave
- Real-time playback visualization
- Volume control slider

### 📱 Device Management
- Select input (microphone) device
- Select output (speaker) device (not supported in Safari)
- Automatic device change detection

### 🔄 Turn Management
- "Start New Turn" - Begin a new conversation turn
- "Interrupt (Barge-in)" - Stop current playback and start new turn
- Turn badges show history and status

### 🌐 WebSocket Integration
- Connect to any WebSocket server
- Audio streaming in both directions
- Automatic reconnection on disconnect

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  ┌───────────────────────────────────────────┐  │
│  │              index.html                    │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │             main.js                  │  │  │
│  │  │  ┌───────────────────────────────┐  │  │  │
│  │  │  │    Chatdio        │  │  │  │
│  │  │  │  ┌─────────┐ ┌─────────────┐  │  │  │  │
│  │  │  │  │   Mic   │ │  Playback   │  │  │  │  │
│  │  │  │  └────┬────┘ └──────┬──────┘  │  │  │  │
│  │  │  │       │             │         │  │  │  │
│  │  │  │       └──────┬──────┘         │  │  │  │
│  │  │  │              │                │  │  │  │
│  │  │  │       WebSocketBridge         │  │  │  │
│  │  │  └──────────────┼────────────────┘  │  │  │
│  │  └─────────────────┼───────────────────┘  │  │
│  └────────────────────┼──────────────────────┘  │
└───────────────────────┼─────────────────────────┘
                        │
                        │ WebSocket
                        │
┌───────────────────────┼─────────────────────────┐
│                server.js (Echo Server)           │
└─────────────────────────────────────────────────┘
```

## Code Examples

### Basic Usage

```javascript
import { Chatdio } from 'chatdio';

const audio = new Chatdio({
  microphone: { sampleRate: 16000, echoCancellation: true },
  playback: { sampleRate: 24000 },
});

// Initialize (must be from user gesture)
await audio.initialize();

// Start capturing
await audio.startMicrophone();

// Handle mic data
audio.on('mic:data', (data) => {
  // Send to your AI server
  websocket.send(data);
});

// Play received audio
audio.on('ws:audio', async (data) => {
  await audio.playAudio(data);
});
```

### Turn Management (Barge-in)

```javascript
// Start a new turn when AI begins responding
const turnId = audio.startTurn();

// Detect user interruption
audio.on('mic:activity', (data) => {
  if (data.isSpeaking && audio.isPlaybackActive()) {
    // User is speaking while AI is talking - barge-in!
    audio.interruptTurn();
    
    // Notify server to stop generating
    audio.sendMessage({ type: 'interrupt' });
  }
});

// Only play audio for current turn
audio.on('ws:audio', async (data, incomingTurnId) => {
  const played = await audio.playAudioForTurn(data, incomingTurnId);
  if (!played) {
    console.log('Ignored audio from old turn');
  }
});
```

### Custom Visualization

```javascript
const analyzer = audio.getMicrophoneAnalyzer();

analyzer.on('activity', (data) => {
  // Use VisualizationUtils for common patterns
  const bands = analyzer.getFrequencyBands(8);
  const waveformPath = VisualizationUtils.createWaveformPath(
    data.timeDomainData, 
    canvas.width, 
    canvas.height
  );
  
  // Or access raw data
  // data.volume - 0 to 1
  // data.peak - 0 to 1 with decay
  // data.frequencyData - Uint8Array
  // data.timeDomainData - Uint8Array
  // data.isSpeaking - boolean
});
```

## Troubleshooting

### "Permission denied" error
- Must initialize from a user gesture (click/touch)
- Check browser permissions for microphone

### No output device selection (Safari)
- Safari doesn't support `setSinkId`
- Audio plays through default device

### WebSocket connection fails
- Check if server is running
- Verify URL is correct (ws:// or wss://)
- Check browser console for CORS issues

### Audio is choppy
- Try increasing `bufferSize` (2048, 4096)
- Check CPU usage
- Reduce visualization update rate

