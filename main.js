// #region Event Handlers & Input
"use strict";
const pressedKeys = new Set();
const lastKeyTime = new Map(); // Track when each key was last processed
const keyDebounceDelay = 500; // Half second delay for key repeat
const isKeyDown = (key) => pressedKeys.has(key);

// Check if enough time has passed since last key action
const canProcessKey = (key) => {
    const now = Date.now();
    const lastTime = lastKeyTime.get(key) || 0;
    return now - lastTime >= keyDebounceDelay;
};

document.addEventListener('keydown', (e) => {
    pressedKeys.add(e.key);
    
    // Handle game state transitions
    if (e.key === ' ') {
        if (currentGameState === GAME_STATES.TITLE) {
            currentGameState = GAME_STATES.PLAYING;
            lastInputType = "Game Started!";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            return;
        }
    }
    
    // Visual feedback for keyboard input (only during gameplay)
    if (currentGameState === GAME_STATES.PLAYING && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        lastInputType = `Keyboard: ${e.key === ' ' ? 'Space' : e.key}`;
        lastInputTime = Date.now();
        inputFadeTimer = 2000; // Show for 2 seconds
    }
    
    // disable arrow keys default behaviour i.e. scrolling the browser window up/down
    switch (e.key) {
        case "ArrowLeft":
            e.preventDefault();
            break;
        case "ArrowRight":
            e.preventDefault();
            break;
        case "ArrowUp":
            e.preventDefault();
            break;
        case "ArrowDown":
            e.preventDefault();
            break;
        case " ":
            e.preventDefault();
            break;
    }
}
);
document.addEventListener('keyup', (e) => pressedKeys.delete(e.key));
// #endregion

// #region Touch Input Variables
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let touchStartTime = 0;
let swipeProcessed = false; // Prevent multiple swipe triggers
const swipeThreshold = 30; // Minimum distance in px for swipe
const tapTimeThreshold = 300; // Max ms for tap
const tapMoveThreshold = 10; // Max px movement for tap

function setupCanvasEventListeners() {
    // Mouse events
    document.addEventListener("mousedown", function (e) {
        getMouseClickPosition(canvas, e);
        // Visual feedback for mouse click
        lastInputType = "Mouse Click";
        clickCoordinates = `(${mouseX}, ${mouseY})`;
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
    });
    
    // Window resize events
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    
    // Touch events
    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
            swipeProcessed = false; // Reset swipe flag
        }
    }, {passive: false});
    
    canvas.addEventListener('touchend', function(e) {
        if (e.changedTouches.length === 1 && !swipeProcessed) {
            const touch = e.changedTouches[0];
            touchEndX = touch.clientX;
            touchEndY = touch.clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            const dt = Date.now() - touchStartTime;
            
            // Detect swipe
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
                swipeProcessed = true; // Mark as processed
                if (dx > 0) {
                    // Swipe right
                    pressedKeys.add('ArrowRight');
                    setTimeout(() => pressedKeys.delete('ArrowRight'), 50);
                    lastInputType = "Swipe Right";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                } else {
                    // Swipe left
                    pressedKeys.add('ArrowLeft');
                    setTimeout(() => pressedKeys.delete('ArrowLeft'), 50);
                    lastInputType = "Swipe Left";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                }
            } else if (Math.abs(dy) > swipeThreshold) {
                swipeProcessed = true; // Mark as processed
                if (dy > 0) {
                    // Swipe down
                    pressedKeys.add('ArrowDown');
                    setTimeout(() => pressedKeys.delete('ArrowDown'), 50);
                    lastInputType = "Swipe Down";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                } else {
                    // Swipe up
                    pressedKeys.add('ArrowUp');
                    setTimeout(() => pressedKeys.delete('ArrowUp'), 50);
                    lastInputType = "Swipe Up";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                }
            } else if (dt < tapTimeThreshold && Math.abs(dx) < tapMoveThreshold && Math.abs(dy) < tapMoveThreshold) {
                // Tap detected
                if (currentGameState === GAME_STATES.TITLE) {
                    // Start game on tap from title screen
                    currentGameState = GAME_STATES.PLAYING;
                    lastInputType = "Game Started!";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                } else if (currentGameState === GAME_STATES.PLAYING) {
                    // Normal tap behavior during gameplay
                    pressedKeys.add(' '); // Spacebar
                    setTimeout(() => pressedKeys.delete(' '), 50);
                    // Simulate mouse click
                    getMouseClickPosition(canvas, touch);
                    lastInputType = "Touch Tap";
                    clickCoordinates = `(${mouseX}, ${mouseY})`;
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                }
            }
        }
    }, {passive: false});
}
// #endregion

// #region Game Variables
let canvas;
let context;
let secondsPassed = 0;
let oldTimeStamp = 0;
let baseWidth = 800;
let baseHeight = 600;
let canvasColour = "#5f5a5aff"
let scale = 1;
let xOffset = 0;
let yOffset = 0;
let mouseX = 0;
let mouseY = 0;

// Game state management
const GAME_STATES = {
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused'
};
let currentGameState = GAME_STATES.TITLE;

// Input feedback variables
let lastInputType = "";
let lastInputTime = 0;
let clickCoordinates = "";
let inputFadeTimer = 0;

const crateEscapeCartoon = new Image();
const spriteSheet = new Image();
const textureAtlas = {
  spriteSheet,
  frames: {
    "block_01.png": { x: 640, y: 640, width: 128, height: 128 },
    "block_02.png": { x: 640, y: 512, width: 128, height: 128 },
    "block_03.png": { x: 640, y: 384, width: 128, height: 128 },
    "block_04.png": { x: 640, y: 256, width: 128, height: 128 },
    "block_05.png": { x: 640, y: 128, width: 128, height: 128 },
    "block_06.png": { x: 640, y: 0, width: 128, height: 128 },
    "block_07.png": { x: 512, y: 1024, width: 128, height: 128 },
    "block_08.png": { x: 512, y: 896, width: 128, height: 128 },
    "crate_01.png": { x: 512, y: 768, width: 128, height: 128 },
    "crate_02.png": { x: 512, y: 640, width: 128, height: 128 },
    "crate_03.png": { x: 512, y: 512, width: 128, height: 128 },
    "crate_04.png": { x: 512, y: 384, width: 128, height: 128 },
    "crate_05.png": { x: 512, y: 256, width: 128, height: 128 },
    "crate_06.png": { x: 512, y: 128, width: 128, height: 128 },
    "crate_07.png": { x: 512, y: 0, width: 128, height: 128 },
    "crate_08.png": { x: 384, y: 1024, width: 128, height: 128 },
    "crate_09.png": { x: 384, y: 896, width: 128, height: 128 },
    "crate_10.png": { x: 384, y: 768, width: 128, height: 128 },
    "crate_11.png": { x: 384, y: 640, width: 128, height: 128 },
    "crate_12.png": { x: 384, y: 512, width: 128, height: 128 },
    "crate_13.png": { x: 384, y: 384, width: 128, height: 128 },
    "crate_14.png": { x: 384, y: 256, width: 128, height: 128 },
    "crate_15.png": { x: 384, y: 128, width: 128, height: 128 },
    "crate_16.png": { x: 384, y: 0, width: 128, height: 128 },
    "crate_17.png": { x: 256, y: 1024, width: 128, height: 128 },
    "crate_18.png": { x: 256, y: 896, width: 128, height: 128 },
    "crate_19.png": { x: 256, y: 768, width: 128, height: 128 },
    "crate_20.png": { x: 256, y: 640, width: 128, height: 128 },
    "crate_21.png": { x: 256, y: 512, width: 128, height: 128 },
    "crate_22.png": { x: 256, y: 384, width: 128, height: 128 },
    "crate_23.png": { x: 256, y: 256, width: 128, height: 128 },
    "crate_24.png": { x: 256, y: 128, width: 128, height: 128 },
    "crate_25.png": { x: 256, y: 0, width: 128, height: 128 },
    "crate_26.png": { x: 128, y: 1040, width: 128, height: 128 },
    "crate_27.png": { x: 128, y: 912, width: 128, height: 128 },
    "crate_28.png": { x: 128, y: 784, width: 128, height: 128 },
    "crate_29.png": { x: 128, y: 656, width: 128, height: 128 },
    "crate_30.png": { x: 128, y: 528, width: 128, height: 128 },
    "crate_31.png": { x: 128, y: 400, width: 128, height: 128 },
    "crate_32.png": { x: 128, y: 320, width: 128, height: 80 },
    "crate_33.png": { x: 128, y: 240, width: 128, height: 80 },
    "crate_34.png": { x: 128, y: 160, width: 128, height: 80 },
    "crate_35.png": { x: 128, y: 80, width: 128, height: 80 },
    "crate_36.png": { x: 128, y: 0, width: 128, height: 80 },
    "crate_37.png": { x: 0, y: 1024, width: 128, height: 128 },
    "crate_38.png": { x: 0, y: 896, width: 128, height: 128 },
    "crate_39.png": { x: 0, y: 768, width: 128, height: 128 },
    "crate_40.png": { x: 0, y: 640, width: 128, height: 128 },
    "crate_41.png": { x: 0, y: 512, width: 128, height: 128 },
    "crate_42.png": { x: 0, y: 384, width: 128, height: 128 },
    "crate_43.png": { x: 0, y: 256, width: 128, height: 128 },
    "crate_44.png": { x: 0, y: 128, width: 128, height: 128 },
    "crate_45.png": { x: 0, y: 0, width: 128, height: 128 },
    "environment_01.png": { x: 768, y: 896, width: 128, height: 128 },
    "environment_02.png": { x: 80, y: 1152, width: 40, height: 40 },
    "environment_03.png": { x: 768, y: 0, width: 128, height: 128 },
    "environment_04.png": { x: 640, y: 896, width: 128, height: 128 },
    "environment_05.png": { x: 296, y: 1152, width: 40, height: 40 },
    "environment_06.png": { x: 768, y: 768, width: 128, height: 128 },
    "environment_07.png": { x: 640, y: 768, width: 128, height: 128 },
    "environment_08.png": { x: 40, y: 1152, width: 40, height: 40 },
    "environment_09.png": { x: 640, y: 1024, width: 128, height: 128 },
    "environment_10.png": { x: 0, y: 1152, width: 40, height: 40 },
    "environment_11.png": { x: 1008, y: 600, width: 56, height: 56 },
    "environment_12.png": { x: 1024, y: 316, width: 56, height: 56 },
    "environment_13.png": { x: 896, y: 0, width: 128, height: 128 },
    "environment_14.png": { x: 256, y: 1152, width: 40, height: 40 },
    "environment_15.png": { x: 896, y: 256, width: 128, height: 128 },
    "environment_16.png": { x: 768, y: 384, width: 128, height: 128 },
    "ground_01.png": { x: 768, y: 640, width: 128, height: 128 },
    "ground_02.png": { x: 896, y: 128, width: 128, height: 128 },
    "ground_03.png": { x: 768, y: 128, width: 128, height: 128 },
    "ground_04.png": { x: 768, y: 256, width: 128, height: 128 },
    "ground_05.png": { x: 768, y: 1024, width: 128, height: 128 },
    "ground_06.png": { x: 768, y: 512, width: 128, height: 128 },
    "playerFace.png": { x: 896, y: 576, width: 112, height: 88 },
    "playerFace_dark.png": { x: 896, y: 480, width: 120, height: 96 },
    "player_01.png": { x: 1116, y: 0, width: 84, height: 100 },
    "player_02.png": { x: 1114, y: 216, width: 84, height: 100 },
    "player_03.png": { x: 994, y: 988, width: 92, height: 108 },
    "player_04.png": { x: 994, y: 880, width: 92, height: 108 },
    "player_05.png": { x: 1024, y: 108, width: 92, height: 108 },
    "player_06.png": { x: 1016, y: 492, width: 92, height: 108 },
    "player_07.png": { x: 1024, y: 0, width: 92, height: 108 },
    "player_08.png": { x: 1016, y: 384, width: 92, height: 108 },
    "player_09.png": { x: 1086, y: 880, width: 89, height: 100 },
    "player_10.png": { x: 986, y: 1096, width: 90, height: 100 },
    "player_11.png": { x: 1076, y: 1096, width: 90, height: 100 },
    "player_12.png": { x: 1086, y: 980, width: 89, height: 100 },
    "player_13.png": { x: 1024, y: 216, width: 90, height: 100 },
    "player_14.png": { x: 896, y: 1096, width: 90, height: 100 },
    "player_15.png": { x: 994, y: 664, width: 97, height: 108 },
    "player_16.png": { x: 896, y: 664, width: 98, height: 108 },
    "player_17.png": { x: 896, y: 880, width: 98, height: 108 },
    "player_18.png": { x: 994, y: 772, width: 97, height: 108 },
    "player_19.png": { x: 896, y: 772, width: 98, height: 108 },
    "player_20.png": { x: 896, y: 988, width: 98, height: 108 },
    "player_21.png": { x: 1091, y: 600, width: 84, height: 100 },
    "player_22.png": { x: 1091, y: 700, width: 84, height: 100 },
    "player_23.png": { x: 1108, y: 316, width: 84, height: 100 },
    "player_24.png": { x: 1108, y: 416, width: 84, height: 100 },
    "ret_74.png": { x: 896, y: 384, width: 120, height: 96 }
  }
};
const playerSprite = textureAtlas.frames["player_03.png"];
// #endregion

// #region Initialization & Asset Loading
window.onload = init;
function init() {
    let imagesLoaded = 0;
    const numberImages = 2;
    
    crateEscapeCartoon.src = "assets/images/crateEscapeCartoon.png";
    crateEscapeCartoon.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    spriteSheet.src = "assets/images/spriteSheet.png";
    spriteSheet.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
}
function createCanvas() {
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    setupCanvasEventListeners(); // Set up event listeners after canvas is created
    resizeCanvas();
    window.requestAnimationFrame(gameLoop);
    gameLoad();
}
// #endregion

// #region Game Loop
function gameLoop(timeStamp) {
    secondsPassed = (timeStamp - oldTimeStamp) / 1000;
    oldTimeStamp = timeStamp;
    update(secondsPassed);
    secondsPassed = Math.min(secondsPassed, 0.1);
    draw();
    window.requestAnimationFrame(gameLoop);
}
// #endregion

// #region Game Load
function gameLoad() {
    // Initialize game state here
}
// #endregion

// #region Update Game State
function update(secondsPassed) {
    // Update input feedback timer
    if (inputFadeTimer > 0) {
        inputFadeTimer -= secondsPassed * 1000;
        if (inputFadeTimer <= 0) {
            lastInputType = "";
            clickCoordinates = "";
        }
    }

    // Only process game logic when playing
    if (currentGameState === GAME_STATES.PLAYING) {
        if (isKeyDown('ArrowLeft') && canProcessKey('ArrowLeft')) {
            lastKeyTime.set('ArrowLeft', Date.now());
            console.log('Left key is pressed');
            // ...existing code...
        }
        if (isKeyDown('ArrowRight') && canProcessKey('ArrowRight')) {
            lastKeyTime.set('ArrowRight', Date.now());
            // ...existing code...
        }
        if (isKeyDown('ArrowUp') && canProcessKey('ArrowUp')) {
            lastKeyTime.set('ArrowUp', Date.now());
            // ...existing code...
        }
        if (isKeyDown('ArrowDown') && canProcessKey('ArrowDown')) {
            lastKeyTime.set('ArrowDown', Date.now());
            // ...existing code...
        }
    }
}
// #endregion

// #region Draw Each Frame
function draw() {
    context.fillStyle = canvasColour;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    if (currentGameState === GAME_STATES.TITLE) {
        drawTitleScreen();
    } else if (currentGameState === GAME_STATES.PLAYING) {
        drawGameplay();
    }
    
    // Draw input feedback (always on top)
    if (lastInputType && inputFadeTimer > 0) {
        const alpha = Math.min(inputFadeTimer / 1000, 1); // Fade out effect
        context.save();
        context.globalAlpha = alpha;
        
        // Background for text
        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(10, 10, 300, clickCoordinates ? 60 : 40);
        
        // Input type text
        context.fillStyle = "#ffffff";
        context.font = "20px Arial";
        context.fillText(`Input: ${lastInputType}`, 20, 35);
        
        // Coordinates if available
        if (clickCoordinates) {
            context.fillText(`Coordinates: ${clickCoordinates}`, 20, 55);
        }
        
        context.restore();
    }
}

function drawTitleScreen() {
    // Draw title screen background
    context.fillStyle = "#2a2a2a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the cartoon image in the center
    if (crateEscapeCartoon.complete) {
        const imgWidth = crateEscapeCartoon.width;
        const imgHeight = crateEscapeCartoon.height;
        const scale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight) * 0.8; // 80% of max size
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        context.drawImage(crateEscapeCartoon, x, y, scaledWidth, scaledHeight);
    }
    
    // Draw title text
    context.fillStyle = "#ffffff";
    context.font = "bold 48px Arial";
    context.textAlign = "center";
    context.fillText("THE CRATE ESCAPE", canvas.width / 2, 80);
    
    // Draw subtitle
    context.font = "24px Arial";
    context.fillText("Stack, Solve, and Celebrate!", canvas.width / 2, 120);
    
    // Draw instructions
    context.font = "20px Arial";
    context.fillStyle = "#cccccc";
    context.fillText("Press SPACE or TAP to start", canvas.width / 2, canvas.height - 50);
    
    // Reset text alignment
    context.textAlign = "left";
}

function drawGameplay() {
    // Draw the player sprite and game elements
    context.drawImage(spriteSheet, playerSprite.x, playerSprite.y, playerSprite.width, playerSprite.height, 100, 100, playerSprite.width/2, playerSprite.height/2);
}
// #endregion

// #region Utility Methods
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    baseWidth = canvas.width;
    baseHeight = canvas.height;
    scale = 1;
    canvas.style.transform = '';
    canvas.style.position = 'absolute';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
}
function getMouseClickPosition(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    mouseX = Math.round(x / scale);
    mouseY = Math.round(y / scale);
}
// #endregion
