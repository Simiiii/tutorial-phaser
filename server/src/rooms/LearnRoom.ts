import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import type { InputData } from "./Part4Room";

export class LearnPlayer extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") tick: number;
  @type("number") currentMission: number = 1;
  @type("number") lettersCollected: number = 0;
  inputQueue: InputData[] = [];
}

export class LearnRoomState extends Schema {
  @type("number") mapWidth: number;
  @type("number") mapHeight: number;
  @type({ map: LearnPlayer }) players = new MapSchema<LearnPlayer>();
}

export class LearnRoom extends Room {
  state = new LearnRoomState();
  fixedTimeStep = 1000 / 60;

  // Message handlers
  messages = {
    // Player movement input (same protocol as Part4Room)
    0: (client: Client, input: InputData) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.inputQueue.push(input);
    },
    // Client signals mission complete — advance to next mission
    1: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.currentMission < 3) {
        player.currentMission++;
      }
    },
    // Client collected a letter/symbol
    2: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.lettersCollected < 26) {
        player.lettersCollected++;
      }
    },
  }

  onCreate(options: any) {
    this.state.mapWidth = 800;
    this.state.mapHeight = 600;

    let elapsedTime = 0;
    this.setSimulationInterval((deltaTime) => {
      elapsedTime += deltaTime;
      while (elapsedTime >= this.fixedTimeStep) {
        elapsedTime -= this.fixedTimeStep;
        this.fixedTick(this.fixedTimeStep);
      }
    });
  }

  fixedTick(timeStep: number) {
    const velocity = 2;
    const W = this.state.mapWidth;
    const H = this.state.mapHeight;

    this.state.players.forEach(player => {
      let input: InputData;
      while (input = player.inputQueue.shift()) {
        if (input.left) player.x -= velocity;
        else if (input.right) player.x += velocity;
        if (input.up) player.y -= velocity;
        else if (input.down) player.y += velocity;

        player.x = Math.max(16, Math.min(W - 16, player.x));
        player.y = Math.max(16, Math.min(H - 16, player.y));
        player.tick = input.tick;
      }
    });
  }

  onJoin(client: Client, options: any) {
    console.log("Joined learn room!", { roomId: this.roomId, sessionId: client.sessionId });
    const player = new LearnPlayer();
    player.x = 350 + Math.random() * 100;
    player.y = 280 + Math.random() * 60;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client, code: number) {
    console.log("Left learn room!", { roomId: this.roomId, sessionId: client.sessionId });
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("Disposing learn room", this.roomId, "...");
  }
}
