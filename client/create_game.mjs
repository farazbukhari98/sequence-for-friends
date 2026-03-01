import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // Create a room
  socket.emit("create-room", {
    roomName: "Screenshot Room",
    playerName: "Player 1",
    maxPlayers: 4,
    teamCount: 2,
    turnTimeLimit: 0,
    sequencesToWin: 1,
    sequenceLength: 5,
    seriesLength: 0,
  }, (response) => {
    console.log("Room created:", JSON.stringify(response));

    if (response.success) {
      const roomCode = response.roomCode;

      // Create bot player that joins and readies up
      const bot2 = io("http://localhost:3001");
      bot2.on("connect", () => {
        bot2.emit("join-room", { roomCode, playerName: "Player 2" }, (r) => {
          console.log("Bot2 joined:", r.success);
          bot2.emit("toggle-ready", (r2) => {
            console.log("Bot2 ready:", r2.success);

            // Now ready up player 1 and start
            socket.emit("toggle-ready", (r3) => {
              console.log("P1 ready:", r3.success);

              socket.emit("start-game", (r4) => {
                console.log("Game started:", r4.success);
                console.log("ROOM_CODE=" + roomCode);

                // Keep connection alive for 120 seconds
                setTimeout(() => {
                  socket.disconnect();
                  bot2.disconnect();
                  process.exit(0);
                }, 120000);
              });
            });
          });
        });
      });
    }
  });
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});
