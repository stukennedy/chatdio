/**
 * Conversational Audio Demo Server
 *
 * A single server that:
 * - Serves static files (HTML, JS, CSS)
 * - Handles WebSocket audio streaming
 *
 * Usage:
 *   node example/server.js
 *
 * Then open: http://localhost:3000
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";

const PORT = 3000;

// Create Hono app
const app = new Hono();

// Create WebSocket handler
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Track turns
let turnCounter = 0;

// WebSocket endpoint
app.get(
  "/audio",
  upgradeWebSocket((c) => {
    let currentTurnId = null;
    let pendingTimeouts = []; // Track pending audio sends

    // Clear all pending audio when interrupted
    function clearPendingAudio() {
      console.log(`🗑️ Clearing ${pendingTimeouts.length} pending audio chunks`);
      pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
      pendingTimeouts = [];
    }

    return {
      onOpen(evt, ws) {
        console.log("🔌 Client connected");

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: "welcome",
            message: "Connected to Audio Server",
            features: ["binary_audio", "json_audio", "turn_management"],
          })
        );
      },

      onMessage(evt, ws) {
        try {
          const data = evt.data;

          // Handle binary audio data
          if (data instanceof ArrayBuffer || data instanceof Buffer) {
            console.log("🎤 Received binary audio:", data.byteLength, "bytes");

            // Capture turn ID for this audio chunk (before it might change)
            // Use client's turn ID if set, otherwise generate one
            if (!currentTurnId) {
              turnCounter++;
              currentTurnId = `server_turn_${Date.now()}_${turnCounter}`;
            }
            const audioTurnId = currentTurnId;

            // Echo back after 2 second delay with turn ID
            // Client uses turn ID to filter interrupted audio
            const base64Audio = Buffer.from(data).toString("base64");
            const timeoutId = setTimeout(() => {
              try {
                ws.send(
                  JSON.stringify({
                    type: "audio",
                    data: base64Audio,
                    turnId: audioTurnId,
                  })
                );
                pendingTimeouts = pendingTimeouts.filter(
                  (t) => t !== timeoutId
                );
              } catch {
                // Connection may have closed
              }
            }, 2000);
            pendingTimeouts.push(timeoutId);
            return;
          }

          // Handle text messages (JSON)
          const message = JSON.parse(data.toString());
          console.log("📨 Received:", message.type);

          // Handle ping
          if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            return;
          }

          // Handle turn:start - client tells us their turn ID
          if (message.type === "turn:start") {
            console.log("🔄 Client started turn:", message.turnId);
            currentTurnId = message.turnId;
            return;
          }

          // Handle interrupt - clear all pending audio!
          if (message.type === "interrupt") {
            console.log("⚡ Turn interrupted:", message.turnId);
            clearPendingAudio();
            currentTurnId = null;
            return;
          }

          // Handle audio in JSON format (base64)
          if (message.type === "audio" && message.data) {
            // Create a turn if needed
            if (!currentTurnId) {
              turnCounter++;
              currentTurnId = `server_turn_${Date.now()}_${turnCounter}`;
            }

            // Echo back with turn ID after 2 second delay
            // Track the timeout so we can cancel it on interrupt
            const timeoutId = setTimeout(() => {
              try {
                ws.send(
                  JSON.stringify({
                    type: "audio",
                    data: message.data,
                    turnId: currentTurnId,
                  })
                );
                pendingTimeouts = pendingTimeouts.filter(
                  (t) => t !== timeoutId
                );
              } catch {
                // Connection may have closed
              }
            }, 2000);
            pendingTimeouts.push(timeoutId);
            return;
          }

          // Echo other messages
          ws.send(
            JSON.stringify({
              type: "echo",
              original: message,
              timestamp: Date.now(),
            })
          );
        } catch (error) {
          console.error("❌ Error processing message:", error.message);
        }
      },

      onClose(evt, ws) {
        console.log("🔌 Client disconnected");
        clearPendingAudio();
        currentTurnId = null;
      },

      onError(evt, ws) {
        console.error("❌ WebSocket error:", evt);
      },
    };
  })
);

// Serve index.html from example folder for root path
app.get("/", async (c) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const html = await fs.readFile(
    path.join(process.cwd(), "example", "index.html"),
    "utf-8"
  );
  return c.html(html);
});

// Serve static files from project root
// This allows access to /dist, /example, etc.
app.use(
  "/*",
  serveStatic({
    root: "./",
  })
);

// Start server
const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`
╔════════════════════════════════════════════════════╗
║       Conversational Audio Demo Server             ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  🌐 Open in browser:  http://localhost:${PORT}         ║
║  🔌 WebSocket URL:    ws://localhost:${PORT}/audio     ║
║                                                    ║
╠════════════════════════════════════════════════════╣
║  Features:                                         ║
║  • Static file serving                             ║
║  • Binary audio echo                               ║
║  • JSON-wrapped audio                              ║
║  • Turn management                                 ║
║  • Ping/pong keep-alive                            ║
╚════════════════════════════════════════════════════╝
    `);
  }
);

// Inject WebSocket handling
injectWebSocket(server);
