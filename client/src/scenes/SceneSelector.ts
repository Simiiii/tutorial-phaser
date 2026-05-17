import Phaser from "phaser";

export class SceneSelector extends Phaser.Scene {

    parts = {
        '1': "Basic Player Movement",
        '2': "Interpolation",
        '3': "Client-predicted Input",
        '4': "Fixed Tickrate",
        'learn': "🎮 Learn: Cybersecurity",
    };

    constructor() {
        super({ key: "selector", active: true });
    }

    preload() {
        // update menu background color
        this.cameras.main.setBackgroundColor(0x000000);

        // preload demo assets
        this.load.image('ship_0001', 'assets/ship_0001.png');
    }

    create() {
        // automatically navigate to hash scene if provided
        if (window.location.hash) {
            this.runScene(window.location.hash.substring(1));
            return;
        }

        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            color: "#ff0000",
            fontSize: "32px",
            // fontSize: "24px",
            fontFamily: "Arial"
        };

        const keys = Object.keys(this.parts);
        for (let i = 0; i < keys.length; i++) {
            const partNum = keys[i];
            const label = this.parts[partNum];
            const sceneKey = isNaN(parseInt(partNum)) ? partNum : `part${partNum}`;
            const displayName = isNaN(parseInt(partNum)) ? label : `Part ${partNum}: ${label}`;

            this.add.text(130, 150 + 70 * i, displayName, textStyle)
                .setInteractive()
                .setPadding(6)
                .on("pointerdown", () => {
                    this.runScene(sceneKey);
                });
        }
    }

    runScene(key: string) {
        this.game.scene.switch("selector", key)
    }

}