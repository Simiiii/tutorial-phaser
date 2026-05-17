/**
 * LearnScene — Cybersecurity education game for kids.
 * Three missions:
 *   1. Fisher Quiz   — answer 3 password-security questions
 *   2. Collect Items — pick up all 26 alphabet letters in the field
 *   3. Smith Gate    — talk to the smith to unlock the password manager
 */

import Phaser from "phaser";
import { Room, Client, Callbacks } from "@colyseus/sdk";
import { BACKEND_URL } from "../backend";
import type server from "../../../server/src/app.config";
import type { InputData } from "../../../server/src/rooms/Part4Room";
import type { LearnPlayer, LearnRoom } from "../../../server/src/rooms/LearnRoom";

// ─── Quiz data (from moddio_template dialogues) ───────────────────────────────

const QUIZ = [
  {
    title: "Passwortstärke",
    question: "Welche Mindestlänge sollte ein sicheres Passwort haben?",
    options: [
      { text: "A) 6 Zeichen",  correct: false, feedback: "Viel zu kurz! 6 Zeichen können in Sekunden geknackt werden." },
      { text: "B) 12 Zeichen", correct: false, feedback: "Besser, aber noch zu kurz. Ohne Sonderzeichen unsicher." },
      { text: "C) 20 Zeichen", correct: true,  feedback: "Richtig! Lange Passwörter sind viel schwerer zu knacken." },
      { text: "D) 8 Zeichen",  correct: false, feedback: "Zu kurz. Heute werden mindestens 20 Zeichen empfohlen." },
    ],
  },
  {
    title: "Verschiedene Passwörter",
    question: "Warum solltest du für jedes Konto ein anderes Passwort nutzen?",
    options: [
      { text: "A) Weil es Spaß macht",                                           correct: false, feedback: "Kein guter Grund. Ein Passwort-Manager erledigt das für dich!" },
      { text: "B) Solange es lang ist, ist es egal",                             correct: false, feedback: "Nein! Ein Datenleck reicht, um alle Konten zu gefährden." },
      { text: "C) Ich verwende gar keine Passwörter",                            correct: false, feedback: "Unrealistisch – Konten müssen gesichert werden." },
      { text: "D) Ein gehacktes Passwort gefährdet sonst ALLE Konten",           correct: true,  feedback: "Genau! Deshalb braucht jedes Konto ein eigenes Passwort." },
    ],
  },
  {
    title: "Passwörter merken",
    question: "Wie merkst du dir am besten viele sichere Passwörter?",
    options: [
      { text: "A) Auf einen Zettel schreiben",    correct: false, feedback: "Unsicher! Zettel können verloren gehen oder gefunden werden." },
      { text: "B) Passwort-Manager benutzen",     correct: true,  feedback: "Super! Ein Passwort-Manager erstellt und merkt sich alles sicher." },
      { text: "C) Im Kopf behalten",              correct: false, feedback: "Schwierig bei vielen komplexen Passwörtern – führt zu Wiederholungen." },
      { text: "D) Meiner Mutter sagen",           correct: false, feedback: "Passwörter niemals teilen – auch nicht mit Vertrauenspersonen!" },
    ],
  },
];

// All 26 alphabet letters — row 0 (frames 0–25) = small, row 1 (frames 26–51) = capitals
// Frame index maps directly: 'a'=0 … 'z'=25, 'A'=26 … 'Z'=51
const LETTER_FRAME_SMALL   = (i: number) => i;       // 0–25
const LETTER_FRAME_CAPITAL = (i: number) => 26 + i;  // 26–51
const TOTAL_FRAMES = 52;

// Initial spread of 26 positions across the field (avoiding lake bottom-left)
const COLLECTIBLE_POSITIONS: {x: number; y: number}[] = [
  {x: 55, y: 55},  {x:130, y: 55},  {x:215, y: 55},  {x:305, y: 55},
  {x:395, y: 55},  {x:490, y: 55},  {x:680, y: 55},
  {x: 80, y:125},  {x:170, y:125},  {x:265, y:125},  {x:365, y:125},
  {x:460, y:125},  {x:555, y:125},  {x:645, y:125},  {x:745, y:125},
  {x: 55, y:200},  {x:150, y:200},  {x:255, y:200},  {x:365, y:200},
  {x:475, y:200},  {x:590, y:200},  {x:720, y:200},
  {x:365, y:295},  {x:455, y:295},  {x:545, y:295},  {x:640, y:295},
];

// ─── Constants ────────────────────────────────────────────────────────────────
const MAP_W = 800;
const MAP_H = 600;
const VELOCITY = 2;
const INTERACTION_RADIUS = 70;

// NPC positions
const FISHER_POS  = { x: 160, y: 420 };
const SMITH_POS   = { x: 620, y: 220 };
const VAULT_POS   = { x: 730, y: 220 };

// Dialog panel geometry
const DLG_X = 20;
const DLG_Y = 390;
const DLG_W = 760;
const DLG_H = 195;

// ─── Types ────────────────────────────────────────────────────────────────────
type DialogOption = { text: string; onSelect: () => void };
type QuizState = { questionIndex: number; quizDone: boolean; wrongFeedback: string | null };

export class LearnScene extends Phaser.Scene {
  // Colyseus
  client = new Client<typeof server>(BACKEND_URL);
  room: Room<LearnRoom>;

  // Phaser entities
  currentPlayer: Phaser.GameObjects.Rectangle;
  playerLabel: Phaser.GameObjects.Text;
  playerEntities: { [id: string]: { rect: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text } } = {};

  // NPCs
  fisherSprite: Phaser.GameObjects.Rectangle;
  smithSprite:  Phaser.GameObjects.Rectangle;
  vaultSprite:  Phaser.GameObjects.Rectangle;
  hintText: Phaser.GameObjects.Text;

  // Collectibles — image sprites from the letter spritesheet
  collectibles: { obj: Phaser.GameObjects.Image; frame: number; collected: boolean }[] = [];

  // Dialog
  dialogContainer: Phaser.GameObjects.Container;
  dlgBg: Phaser.GameObjects.Rectangle;
  dlgTitle: Phaser.GameObjects.Text;
  dlgMessage: Phaser.GameObjects.Text;
  dlgOptionObjects: Phaser.GameObjects.Container[] = [];
  dialogActive = false;

  // UI
  missionText: Phaser.GameObjects.Text;
  letterCountText: Phaser.GameObjects.Text;
  debugFPS: Phaser.GameObjects.Text;

  // Input
  cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
  spaceKey: Phaser.Input.Keyboard.Key;

  inputPayload: InputData = { left: false, right: false, up: false, down: false, tick: undefined };
  elapsedTime = 0;
  fixedTimeStep = 1000 / 60;
  currentTick = 0;

  // Mission / quiz state (client-side)
  currentMission = 1;
  lettersCollected = 0;
  quizState: QuizState = { questionIndex: 0, quizDone: false, wrongFeedback: null };
  mission1Done = false;
  mission3Done = false;
  nearFisher = false;
  nearSmith = false;

  constructor() {
    super({ key: "learn" });
  }

  preload() {
    // 26 cols × 2 rows (row 0 = a–z, row 1 = A–Z), each frame 170×165 px
    this.load.spritesheet("letters", "/assets/collectibles/powerup_cellsheet.png", {
      frameWidth: 170,
      frameHeight: 165,
    });
  }

  async create() {
    this.cameras.main.setBackgroundColor(0x5a9e2f);
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.spaceKey   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.drawMap();
    this.createNPCs();
    this.createCollectibles();
    this.createDialog();
    this.createHUD();

    await this.connect();

    // Show mission intro
    this.showMissionIntro(1);
  }

  // ─── Map ───────────────────────────────────────────────────────────────────

  private drawMap() {
    const g = this.add.graphics();

    // Lake (bottom-left)
    g.fillStyle(0x4a90d9, 1);
    g.fillEllipse(180, 490, 300, 160);

    // Lake shimmer
    g.fillStyle(0x6ab4f5, 0.4);
    g.fillEllipse(160, 480, 200, 80);

    // Sandy shore around lake
    g.fillStyle(0xd4b483, 0.6);
    g.fillEllipse(180, 510, 340, 110);

    // Path from player-start toward smith (light strip)
    g.fillStyle(0x8cc550, 0.4);
    g.fillRect(350, 150, 40, 200);

    // Grass patches (decorative)
    g.fillStyle(0x4a8c22, 0.5);
    for (const pos of [{x:50,y:340},{x:320,y:60},{x:580,y:350},{x:710,y:130}]) {
      g.fillCircle(pos.x, pos.y, 18);
    }

    // Map border
    g.lineStyle(3, 0x2d5a0e, 1);
    g.strokeRect(1, 1, MAP_W - 2, MAP_H - 2);
  }

  // ─── NPCs ──────────────────────────────────────────────────────────────────

  private createNPCs() {
    // Fisher
    this.fisherSprite = this.add.rectangle(FISHER_POS.x, FISHER_POS.y, 36, 36, 0x2255cc)
      .setStrokeStyle(2, 0xffffff);
    this.add.text(FISHER_POS.x, FISHER_POS.y - 28, "🎣 Fischerin",
      { fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5);

    // Smith
    this.smithSprite = this.add.rectangle(SMITH_POS.x, SMITH_POS.y, 36, 36, 0x888888)
      .setStrokeStyle(2, 0xffffff);
    this.add.text(SMITH_POS.x, SMITH_POS.y - 28, "⚒️ Schmied",
      { fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5);

    // Vault (password manager) — locked until mission 3 done
    this.vaultSprite = this.add.rectangle(VAULT_POS.x, VAULT_POS.y, 40, 40, 0x6a0dad)
      .setStrokeStyle(3, 0xffd700)
      .setAlpha(0.4);
    this.add.text(VAULT_POS.x, VAULT_POS.y - 30, "🔐 Tresor",
      { fontSize: "11px", color: "#ffd700", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5);

    // Interaction hint
    this.hintText = this.add.text(MAP_W / 2, DLG_Y - 24, "LEERTASTE drücken um zu interagieren",
      { fontSize: "13px", color: "#ffffaa", stroke: "#333300", strokeThickness: 3, backgroundColor: "#00000066", padding: { x: 6, y: 3 } })
      .setOrigin(0.5)
      .setVisible(false);
  }

  // ─── Collectibles ──────────────────────────────────────────────────────────

  private createCollectibles() {
    COLLECTIBLE_POSITIONS.forEach((pos, i) => {
      // Alternate between small (0–25) and capital (26–51) letters for variety
      const frame = i < 26 ? LETTER_FRAME_SMALL(i) : LETTER_FRAME_CAPITAL(i - 26);
      this.spawnLetter(pos.x, pos.y, frame);
    });
  }

  private spawnLetter(x: number, y: number, frame: number) {
    const img = this.add.image(x, y, "letters", frame)
      .setDisplaySize(32, 32)
      .setDepth(2);

    this.tweens.add({
      targets: img,
      y: y - 6,
      duration: 750 + Phaser.Math.Between(0, 300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.collectibles.push({ obj: img, frame, collected: false });
  }

  private spawnRandomLetter() {
    // Pick a random field position (avoid lake area: x<330, y>410)
    let x: number, y: number;
    do {
      x = Phaser.Math.Between(40, MAP_W - 40);
      y = Phaser.Math.Between(40, 360);
    } while (x < 330 && y > 330);

    const frame = Phaser.Math.Between(0, TOTAL_FRAMES - 1);
    this.spawnLetter(x, y, frame);
  }

  // ─── Dialog system ─────────────────────────────────────────────────────────

  private createDialog() {
    this.dialogContainer = this.add.container(0, 0).setDepth(10).setVisible(false);

    // Semi-transparent background
    this.dlgBg = this.add.rectangle(DLG_X + DLG_W / 2, DLG_Y + DLG_H / 2, DLG_W, DLG_H, 0x0a1a3a, 0.93)
      .setStrokeStyle(2, 0x4488ff);

    this.dlgTitle = this.add.text(DLG_X + 12, DLG_Y + 10, "",
      { fontSize: "14px", color: "#88ccff", fontStyle: "bold" });

    this.dlgMessage = this.add.text(DLG_X + 12, DLG_Y + 32, "",
      { fontSize: "13px", color: "#e0e0e0", wordWrap: { width: DLG_W - 24 } });

    this.dialogContainer.add([this.dlgBg, this.dlgTitle, this.dlgMessage]);
  }

  showDialog(title: string, message: string, options: DialogOption[]) {
    this.dialogActive = true;

    // Clear old option buttons
    this.dlgOptionObjects.forEach(c => c.destroy());
    this.dlgOptionObjects = [];

    this.dlgTitle.setText(title);
    this.dlgMessage.setText(message);

    // Create option buttons below message
    const btnY = DLG_Y + 100;
    const btnW = Math.min(170, (DLG_W - 24) / options.length - 8);
    const totalW = options.length * (btnW + 8) - 8;
    const startX = DLG_X + DLG_W / 2 - totalW / 2;

    options.forEach((opt, i) => {
      const bx = startX + i * (btnW + 8) + btnW / 2;
      const btnContainer = this.add.container(bx, btnY);

      const btnBg = this.add.rectangle(0, 0, btnW, 36, 0x1a3a6a)
        .setStrokeStyle(1, 0x4488ff)
        .setInteractive({ useHandCursor: true })
        .on("pointerover",  () => btnBg.setFillStyle(0x2a5aaa))
        .on("pointerout",   () => btnBg.setFillStyle(0x1a3a6a))
        .on("pointerdown",  () => {
          btnBg.setFillStyle(0x0a2a4a);
          opt.onSelect();
        });

      const btnText = this.add.text(0, 0, opt.text,
        { fontSize: "12px", color: "#ffffff", wordWrap: { width: btnW - 8 }, align: "center" })
        .setOrigin(0.5);

      btnContainer.add([btnBg, btnText]);
      btnContainer.setDepth(11);
      this.dlgOptionObjects.push(btnContainer);
    });

    this.dialogContainer.setVisible(true);
  }

  hideDialog() {
    this.dialogActive = false;
    this.dialogContainer.setVisible(false);
    this.dlgOptionObjects.forEach(c => c.destroy());
    this.dlgOptionObjects = [];
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private createHUD() {
    this.missionText = this.add.text(MAP_W - 10, 10, "Mission 1 / 3",
      { fontSize: "14px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(1, 0)
      .setDepth(5);

    this.letterCountText = this.add.text(10, 10, "Buchstaben: 0 / 26",
      { fontSize: "14px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setDepth(5)
      .setVisible(false);

    this.debugFPS = this.add.text(4, MAP_H - 18, "",
      { fontSize: "11px", color: "#ff0000" }).setDepth(5);
  }

  private updateHUD() {
    this.missionText.setText(`Mission ${this.currentMission} / 3`);
    this.letterCountText.setText(`Buchstaben: ${this.lettersCollected} / 26`);
    this.letterCountText.setVisible(this.currentMission === 2);
  }

  // ─── Mission intro dialogs ──────────────────────────────────────────────────

  private showMissionIntro(mission: number) {
    if (mission === 1) {
      this.showDialog(
        "Mission 1: Das Passwort-Quiz 🎣",
        "Am Seeufer sitzt eine Fischerin mit erstaunlich viel Ahnung über Passwortsicherheit.\nGeh zu ihr und beantworte ihre Fragen!",
        [{ text: "Los geht's!", onSelect: () => this.hideDialog() }]
      );
    } else if (mission === 2) {
      this.showDialog(
        "Mission 2: Die Schmiede der Zeichen ⚒️",
        "Überall auf dem Spielfeld leuchten Buchstaben des Alphabets.\nSammle alle 26, um dein Masterpasswort zu bauen! Neue Buchstaben erscheinen, wenn du welche sammelst.",
        [{ text: "Sammeln!", onSelect: () => this.hideDialog() }]
      );
    } else if (mission === 3) {
      this.showDialog(
        "Mission 3: Der Schmied 🔐",
        "Du hast genug Zeichen gesammelt! Geh zum Schmied und zeig ihm dein Passwort.",
        [{ text: "Zum Schmied!", onSelect: () => this.hideDialog() }]
      );
    }
  }

  // ─── Interactions ──────────────────────────────────────────────────────────

  private interactWithFisher() {
    if (this.currentMission !== 1 || this.mission1Done) return;
    this.showQuizQuestion(0);
  }

  private showQuizQuestion(index: number) {
    if (index >= QUIZ.length) {
      this.completeMission1();
      return;
    }
    const q = QUIZ[index];
    this.showDialog(
      q.title,
      q.question,
      q.options.map(opt => ({
        text: opt.text,
        onSelect: () => this.handleQuizAnswer(index, opt.correct, opt.feedback),
      }))
    );
  }

  private handleQuizAnswer(index: number, correct: boolean, feedback: string) {
    if (correct) {
      this.showDialog(
        "✅ Richtig!",
        feedback,
        [{ text: index < QUIZ.length - 1 ? "Weiter →" : "Quiz beenden", onSelect: () => {
          this.hideDialog();
          this.showQuizQuestion(index + 1);
        }}]
      );
    } else {
      this.showDialog(
        "❌ Nicht ganz...",
        feedback + "\n\nVersuche es nochmal!",
        [{ text: "Zurück", onSelect: () => this.showQuizQuestion(index) }]
      );
    }
  }

  private completeMission1() {
    this.mission1Done = true;
    this.currentMission = 2;
    this.room?.send(1); // tell server
    this.updateHUD();
    this.showDialog(
      "🎉 Mission 1 abgeschlossen!",
      "Super gemacht! Du kennst jetzt die Grundlagen sicherer Passwörter.\nJetzt: sammle alle 26 Buchstaben im Spielfeld!",
      [{ text: "Weiter!", onSelect: () => { this.hideDialog(); this.showMissionIntro(2); } }]
    );
  }

  private tryCollect() {
    if (this.currentMission !== 2 || !this.currentPlayer) return;
    const px = this.currentPlayer.x;
    const py = this.currentPlayer.y;

    this.collectibles.forEach(item => {
      if (item.collected) return;
      const dx = item.obj.x - px;
      const dy = item.obj.y - py;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        item.collected = true;
        this.tweens.killTweensOf(item.obj);
        item.obj.destroy();
        this.lettersCollected++;
        this.room?.send(2);
        this.updateHUD();

        if (this.lettersCollected >= 26) {
          this.completeMission2();
        } else {
          // Spawn a replacement so the field stays populated
          this.spawnRandomLetter();
        }
      }
    });
  }

  private completeMission2() {
    this.currentMission = 3;
    this.room?.send(1);
    this.updateHUD();
    this.vaultSprite.setAlpha(1);
    this.showDialog(
      "🎉 Mission 2 abgeschlossen!",
      `Du hast ${this.lettersCollected} Zeichen gesammelt!\nGeh jetzt zum Schmied – er wartet auf dich.`,
      [{ text: "Zum Schmied!", onSelect: () => { this.hideDialog(); this.showMissionIntro(3); } }]
    );
  }

  private interactWithSmith() {
    if (this.currentMission !== 3 || this.mission3Done) return;
    if (this.lettersCollected < 26) {
      this.showDialog(
        "⚒️ Schmied",
        `Du hast erst ${this.lettersCollected} / 26 Buchstaben gesammelt.\nSammle erst alle 26, dann kannst du weitermachen!`,
        [{ text: "Ok!", onSelect: () => this.hideDialog() }]
      );
      return;
    }
    this.mission3Done = true;
    this.showDialog(
      "⚒️ Schmied: Gut gemacht! 🔑",
      "Dein Passwort ist stark genug! Ich schmiede dir jetzt deinen persönlichen Passkey.\n\nEin Passkey ist ein moderner Zugangsschlüssel – du meldest dich damit mit Fingerabdruck oder Gesicht an, ohne Passwort zu tippen!",
      [{ text: "Passkey erhalten!", onSelect: () => this.showPasswordManagerDialog() }]
    );
  }

  private showPasswordManagerDialog() {
    this.showDialog(
      "🔐 Passwortmanager freigeschaltet!",
      "Ein Passwortmanager ist wie ein geheimer Tresor für alle deine Passwörter.\nDu brauchst dir nur ein starkes Masterpasswort zu merken – den Rest erledigt er!\n\n🎉 Du hast alle Missionen abgeschlossen!",
      [{ text: "Super! 🎊", onSelect: () => {
        this.hideDialog();
        this.showEndDialog();
      }}]
    );
  }

  private showEndDialog() {
    this.showDialog(
      "Was wir gelernt haben:",
      "👉 Ein Passwortmanager merkt sich alle Passwörter sicher.\n👉 Benutze für jedes Konto ein eigenes Passwort.\n👉 Dein Passwort sollte mindestens 20 Zeichen haben.\n👉 Passkeys sind die Zukunft – sicher und einfach!",
      [{ text: "Nochmal spielen!", onSelect: () => this.scene.restart() },
       { text: "Menü",            onSelect: () => this.scene.start("selector") }]
    );
  }

  // ─── Colyseus connection ───────────────────────────────────────────────────

  async connect() {
    const statusText = this.add.text(MAP_W / 2, MAP_H / 2, "Verbinde mit Server...",
      { color: "#ff0000", fontSize: "16px" }).setOrigin(0.5).setDepth(20);

    try {
      this.room = await this.client.joinOrCreate("learn_room", {});
      statusText.destroy();
    } catch {
      statusText.setText("Konnte nicht verbinden.");
      return;
    }

    const callbacks = Callbacks.get(this.room);

    callbacks.onAdd("players", (player: LearnPlayer, sessionId: string) => {
      const rect  = this.add.rectangle(player.x, player.y, 24, 24, 0xff4444).setDepth(3);
      const label = this.add.text(player.x, player.y - 18, "Du",
        { fontSize: "10px", color: "#ffffff", stroke: "#000", strokeThickness: 2 })
        .setDepth(4).setOrigin(0.5);

      this.playerEntities[sessionId] = { rect, label };

      if (sessionId === this.room.sessionId) {
        this.currentPlayer = rect;
        rect.setFillStyle(0x4444ff);
        label.setText("Du");
        callbacks.onChange(player, () => {
          // remote ref only; local player is moved via client prediction
        });
      } else {
        label.setText("");
        callbacks.onChange(player, () => {
          rect.setData("serverX", player.x);
          rect.setData("serverY", player.y);
        });
      }
    });

    callbacks.onRemove("players", (_player: LearnPlayer, sessionId: string) => {
      const e = this.playerEntities[sessionId];
      if (e) { e.rect.destroy(); e.label.destroy(); delete this.playerEntities[sessionId]; }
    });

    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
  }

  // ─── Game loop ─────────────────────────────────────────────────────────────

  update(time: number, delta: number) {
    if (!this.currentPlayer) return;

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick();
    }

    this.debugFPS.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
  }

  fixedTick() {
    this.currentTick++;

    // ─ Check dialog interaction key
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !this.dialogActive) {
      if (this.nearFisher)  this.interactWithFisher();
      else if (this.nearSmith) this.interactWithSmith();
    }

    // ─ Player movement (client-predicted, same as Part4)
    if (!this.dialogActive) {
      this.inputPayload.left  = this.cursorKeys.left.isDown;
      this.inputPayload.right = this.cursorKeys.right.isDown;
      this.inputPayload.up    = this.cursorKeys.up.isDown;
      this.inputPayload.down  = this.cursorKeys.down.isDown;
    } else {
      this.inputPayload.left = this.inputPayload.right =
      this.inputPayload.up   = this.inputPayload.down = false;
    }

    this.inputPayload.tick = this.currentTick;
    this.room?.send(0, this.inputPayload);

    if (this.inputPayload.left)  this.currentPlayer.x -= VELOCITY;
    if (this.inputPayload.right) this.currentPlayer.x += VELOCITY;
    if (this.inputPayload.up)    this.currentPlayer.y -= VELOCITY;
    if (this.inputPayload.down)  this.currentPlayer.y += VELOCITY;

    // Clamp to map
    this.currentPlayer.x = Phaser.Math.Clamp(this.currentPlayer.x, 16, MAP_W - 16);
    this.currentPlayer.y = Phaser.Math.Clamp(this.currentPlayer.y, 16, MAP_H - 16);

    // Follow player label
    const ent = this.playerEntities[this.room?.sessionId];
    if (ent) { ent.label.x = this.currentPlayer.x; ent.label.y = this.currentPlayer.y - 18; }

    // ─ Interpolate remote players
    for (const id in this.playerEntities) {
      if (id === this.room?.sessionId) continue;
      const e = this.playerEntities[id];
      const sX = e.rect.getData("serverX");
      const sY = e.rect.getData("serverY");
      if (sX !== undefined) { e.rect.x = Phaser.Math.Linear(e.rect.x, sX, 0.2); }
      if (sY !== undefined) { e.rect.y = Phaser.Math.Linear(e.rect.y, sY, 0.2); }
      e.label.x = e.rect.x; e.label.y = e.rect.y - 18;
    }

    // ─ Proximity checks
    const px = this.currentPlayer.x;
    const py = this.currentPlayer.y;

    const dFisher = Math.hypot(px - FISHER_POS.x, py - FISHER_POS.y);
    const dSmith  = Math.hypot(px - SMITH_POS.x,  py - SMITH_POS.y);

    this.nearFisher = dFisher < INTERACTION_RADIUS && this.currentMission === 1 && !this.mission1Done;
    this.nearSmith  = dSmith  < INTERACTION_RADIUS && this.currentMission === 3 && !this.mission3Done;

    this.hintText.setVisible((this.nearFisher || this.nearSmith) && !this.dialogActive);

    // ─ Collect letters (auto on overlap)
    if (this.currentMission === 2) this.tryCollect();
  }
}
