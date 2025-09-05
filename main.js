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
    
    // Handle player movement during gameplay
    if (currentGameState === GAME_STATES.PLAYING && !isPlayerMoving) {
        let moveDirection = { x: 0, y: 0 };
        
        switch (e.key) {
            case "ArrowLeft":
                moveDirection = { x: -1, y: 0 };
                break;
            case "ArrowRight":
                moveDirection = { x: 1, y: 0 };
                break;
            case "ArrowUp":
                moveDirection = { x: 0, y: -1 };
                break;
            case "ArrowDown":
                moveDirection = { x: 0, y: 1 };
                break;
        }
        
        if (moveDirection.x !== 0 || moveDirection.y !== 0) {
            attemptPlayerMove(moveDirection);
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

// Continuous touch movement variables
let touchCurrentX = 0;
let touchCurrentY = 0;
let isTouchActive = false;
let lastTouchMoveTime = 0;
let touchMoveDirection = { x: 0, y: 0 };
let touchMoveTimer = null;
const touchMoveThreshold = 20; // Minimum movement to trigger continuous movement
const touchMoveCooldown = 200; // Milliseconds between continuous moves

function setupCanvasEventListeners() {
    // Mouse events
    document.addEventListener("mousedown", function (e) {
        // Handle game state transitions (same logic as space key)
        if (currentGameState === GAME_STATES.TITLE) {
            currentGameState = GAME_STATES.PLAYING;
            lastInputType = "Game Started!";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            return;
        }
        
        // Visual feedback for mouse click during gameplay
        getMouseClickPosition(canvas, e);
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
            touchCurrentX = touch.clientX;
            touchCurrentY = touch.clientY;
            touchStartTime = Date.now();
            swipeProcessed = false; // Reset swipe flag
            isTouchActive = true;
            lastTouchMoveTime = 0;
            touchMoveDirection = { x: 0, y: 0 };
            
            // Clear any existing continuous movement timer
            if (touchMoveTimer) {
                clearInterval(touchMoveTimer);
                touchMoveTimer = null;
            }
        }
    }, {passive: false});
    
    canvas.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && isTouchActive && currentGameState === GAME_STATES.PLAYING) {
            e.preventDefault();
            const touch = e.touches[0];
            const currentTime = Date.now();
            
            touchCurrentX = touch.clientX;
            touchCurrentY = touch.clientY;
            
            const dx = touchCurrentX - touchStartX;
            const dy = touchCurrentY - touchStartY;
            
            // Determine movement direction based on current touch position
            let newDirection = { x: 0, y: 0 };
            
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > touchMoveThreshold) {
                // Horizontal movement
                newDirection.x = dx > 0 ? 1 : -1;
            } else if (Math.abs(dy) > touchMoveThreshold) {
                // Vertical movement  
                newDirection.y = dy > 0 ? 1 : -1;
            }
            
            // If direction changed or first movement, trigger immediate move
            if ((newDirection.x !== touchMoveDirection.x || newDirection.y !== touchMoveDirection.y) && 
                (newDirection.x !== 0 || newDirection.y !== 0)) {
                
                touchMoveDirection = newDirection;
                lastTouchMoveTime = currentTime;
                
                // Attempt immediate movement
                if (!isPlayerMoving) {
                    attemptPlayerMove(touchMoveDirection);
                }
                
                // Start continuous movement timer
                if (touchMoveTimer) {
                    clearInterval(touchMoveTimer);
                }
                
                touchMoveTimer = setInterval(() => {
                    if (isTouchActive && !isPlayerMoving && currentGameState === GAME_STATES.PLAYING &&
                        (touchMoveDirection.x !== 0 || touchMoveDirection.y !== 0)) {
                        attemptPlayerMove(touchMoveDirection);
                    }
                }, touchMoveCooldown);
            }
        }
    }, {passive: false});
    
    canvas.addEventListener('touchend', function(e) {
        // Stop continuous movement
        isTouchActive = false;
        touchMoveDirection = { x: 0, y: 0 };
        if (touchMoveTimer) {
            clearInterval(touchMoveTimer);
            touchMoveTimer = null;
        }
        
        // Handle tap for title screen transition (fallback for old swipe behavior)
        if (e.changedTouches.length === 1 && !swipeProcessed) {
            const touch = e.changedTouches[0];
            touchEndX = touch.clientX;
            touchEndY = touch.clientY;
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            const dt = Date.now() - touchStartTime;
            
            // Only handle tap for title screen transition now
            if (dt < tapTimeThreshold && Math.abs(dx) < tapMoveThreshold && Math.abs(dy) < tapMoveThreshold) {
                // Tap detected
                if (currentGameState === GAME_STATES.TITLE) {
                    // Start game on tap from title screen
                    currentGameState = GAME_STATES.PLAYING;
                    lastInputType = "Game Started!";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                }
                
                // Show tap feedback
                lastInputType = "Tap";
                lastInputTime = Date.now();
                inputFadeTimer = 2000;
                clickCoordinates = `(${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`;
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

// Game level variables
let currentLevel = null;
let currentSet = 'setI';
let currentLevelNumber = 1; // Large level for testing responsive sizing
let tileSize = 32; // Size of each tile in pixels - will be calculated dynamically
let levelOffsetX = 0; // Offset for centering the level
let levelOffsetY = 0;

// Player movement variables
let playerPos = { x: 0, y: 0 }; // Current player position in grid coordinates
let playerPixelPos = { x: 0, y: 0 }; // Current player position in pixel coordinates
let isPlayerMoving = false;
let moveAnimationProgress = 0;
let moveDuration = 0.25; // Animation duration in seconds
let moveStartPos = { x: 0, y: 0 };
let moveTargetPos = { x: 0, y: 0 };
let movingBox = null; // Box being pushed (if any)
let moveStartBoxPos = { x: 0, y: 0 };
let moveTargetBoxPos = { x: 0, y: 0 };

// Player animation variables
let playerAnimationState = 'idle'; // 'idle', 'moving-down', 'moving-up', 'moving-left', 'moving-right'
let playerAnimationFrame = 0;
let playerAnimationTimer = 0;
const playerAnimationSpeed = 0.083; // Seconds between frame changes (matches movement duration / 3 frames)

// Player animation frame sequences
const playerAnimations = {
    idle: [3],
    'moving-down': [3, 4, 5],
    'moving-up': [6, 7, 8], 
    'moving-left': [18, 19, 20],
    'moving-right': [15, 16, 17]
};

// Function to calculate optimal tile size with mobile-friendly constraints
function calculateOptimalTileSize() {
    if (!currentLevel) return 32;
    
    // Define safe tile sizes that avoid scaling artifacts
    // These are clean multiples/divisors of common sprite sizes (16px, 32px, 64px)
    const safeTileSizes = [8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];
    
    // Calculate available screen space with padding
    const padding = 60; // Leave space for UI elements and margins
    const availableWidth = canvas.width - padding;
    const availableHeight = canvas.height - padding;
    
    // Calculate max tile size that fits the screen
    const maxTileWidth = Math.floor(availableWidth / currentLevel.width);
    const maxTileHeight = Math.floor(availableHeight / currentLevel.height);
    const maxPossibleTileSize = Math.min(maxTileWidth, maxTileHeight);
    
    // Find the largest safe tile size that fits within our constraints
    let optimalSize = 8; // Default minimum safe size
    
    for (let size of safeTileSizes) {
        if (size <= maxPossibleTileSize) {
            optimalSize = size;
        } else {
            break; // Sizes are ordered, so we can stop here
        }
    }
    
    // Apply level-specific constraints
    const levelArea = currentLevel.width * currentLevel.height;
    const isLargeLevel = levelArea > 200 || currentLevel.width > 20 || currentLevel.height > 15;
    
    if (!isLargeLevel) {
        // Small levels: apply minimum constraint for usability
        const minTileSize = 24; // Minimum for mobile touch targets
        const maxTileSize = 64; // Maximum to prevent overly large tiles
        
        // Find the best safe size within min/max range
        let bestSize = minTileSize;
        for (let size of safeTileSizes) {
            if (size >= minTileSize && size <= maxTileSize && size <= maxPossibleTileSize) {
                bestSize = size;
            }
        }
        optimalSize = bestSize;
    }
    
    // Ensure level never exceeds screen bounds
    const levelWidth = currentLevel.width * optimalSize;
    const levelHeight = currentLevel.height * optimalSize;
    
    if (levelWidth > availableWidth || levelHeight > availableHeight) {
        // Fallback: use the largest safe size that definitely fits
        for (let i = safeTileSizes.length - 1; i >= 0; i--) {
            const size = safeTileSizes[i];
            if (currentLevel.width * size <= availableWidth && 
                currentLevel.height * size <= availableHeight) {
                optimalSize = size;
                break;
            }
        }
    }
    
    console.log(`Level size: ${currentLevel.width}x${currentLevel.height} (${levelArea} tiles), Large level: ${isLargeLevel}, Safe tile size: ${optimalSize}px`);
    
    return optimalSize;
}

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
    // Load level 1 from Set I
    loadLevel(currentSet, currentLevelNumber);
}

// Function to load a specific level
function loadLevel(setName, levelNumber) {
    currentLevel = LevelManager.getParsedLevel(setName, levelNumber);
    
    if (!currentLevel) {
        console.error(`Failed to load level ${levelNumber} from set ${setName}`);
        return false;
    }
    
    // Calculate optimal tile size for this level and screen
    tileSize = calculateOptimalTileSize();
    
    // Initialize player position from level data
    playerPos = {
        x: currentLevel.playerStart.x,
        y: currentLevel.playerStart.y
    };
    
    // Reset movement state
    isPlayerMoving = false;
    moveAnimationProgress = 0;
    moveTargetPos = { x: playerPos.x, y: playerPos.y };
    movingBox = null;
    
    // Reset animation state
    playerAnimationState = 'idle';
    playerAnimationFrame = 0;
    playerAnimationTimer = 0;
    
    console.log(`Loaded level ${levelNumber} from ${setName}`);
    console.log(`Level size: ${currentLevel.width}x${currentLevel.height}`);
    console.log(`Using tile size: ${tileSize}px`);
    console.log(`Player starts at: (${playerPos.x}, ${playerPos.y})`);
    console.log(`Boxes: ${currentLevel.boxes.length}, Goals: ${currentLevel.goals.length}`);
    
    // Calculate level centering offsets
    levelOffsetX = (canvas.width - currentLevel.width * tileSize) / 2;
    levelOffsetY = (canvas.height - currentLevel.height * tileSize) / 2;
    
    return true;
}
// #endregion

// #region Update Game State
// Player movement functions
function attemptPlayerMove(direction) {
    const newX = playerPos.x + direction.x;
    const newY = playerPos.y + direction.y;
    
    // Check if move is within bounds
    if (newX < 0 || newX >= currentLevel.width || newY < 0 || newY >= currentLevel.height) {
        return false;
    }
    
    // Check if destination is a wall
    if (isWall(newX, newY)) {
        return false;
    }
    
    // Check if there's a box at the destination
    const boxIndex = findBoxAt(newX, newY);
    if (boxIndex !== -1) {
        // Try to push the box
        const boxNewX = newX + direction.x;
        const boxNewY = newY + direction.y;
        
        // Check if box can be pushed
        if (boxNewX < 0 || boxNewX >= currentLevel.width || 
            boxNewY < 0 || boxNewY >= currentLevel.height ||
            isWall(boxNewX, boxNewY) || 
            findBoxAt(boxNewX, boxNewY) !== -1) {
            return false;
        }
        
        // Start movement with box pushing
        startPlayerMove(newX, newY, boxIndex, boxNewX, boxNewY, direction);
    } else {
        // Simple movement without box
        startPlayerMove(newX, newY, null, 0, 0, direction);
    }
    
    return true;
}

function startPlayerMove(targetX, targetY, boxIndex = null, boxTargetX = 0, boxTargetY = 0, direction = {x: 0, y: 0}) {
    isPlayerMoving = true;
    moveAnimationProgress = 0;
    
    moveStartPos = { x: playerPos.x, y: playerPos.y };
    moveTargetPos = { x: targetX, y: targetY };
    
    if (boxIndex !== null) {
        movingBox = {
            index: boxIndex,
            startPos: { x: currentLevel.boxes[boxIndex].x, y: currentLevel.boxes[boxIndex].y },
            targetPos: { x: boxTargetX, y: boxTargetY }
        };
    } else {
        movingBox = null;
    }
    
    // Set animation state based on movement direction
    if (direction.x > 0) {
        playerAnimationState = 'moving-right';
    } else if (direction.x < 0) {
        playerAnimationState = 'moving-left';
    } else if (direction.y > 0) {
        playerAnimationState = 'moving-down';
    } else if (direction.y < 0) {
        playerAnimationState = 'moving-up';
    }
    
    // Reset animation frame and timer for new animation
    playerAnimationFrame = 0;
    playerAnimationTimer = 0;
}

function updatePlayerMovement(deltaTime) {
    if (!isPlayerMoving) return;
    
    moveAnimationProgress += deltaTime / moveDuration;
    
    if (moveAnimationProgress >= 1.0) {
        // Movement complete
        moveAnimationProgress = 1.0;
        isPlayerMoving = false;
        
        // Update final positions
        playerPos.x = moveTargetPos.x;
        playerPos.y = moveTargetPos.y;
        
        if (movingBox) {
            currentLevel.boxes[movingBox.index].x = movingBox.targetPos.x;
            currentLevel.boxes[movingBox.index].y = movingBox.targetPos.y;
            movingBox = null;
        }
        
        // Immediately check for continued input to eliminate pause
        checkForContinuedInput();
        
        // Reset to idle animation when movement completes and no continuous input
        if (!isContinuousInputActive()) {
            playerAnimationState = 'idle';
            playerAnimationFrame = 0;
            playerAnimationTimer = 0;
        }
    }
}

function updatePlayerAnimation(deltaTime) {
    // If there's no continuous input and no movement happening, reset to idle
    if (!isContinuousInputActive() && !isPlayerMoving && playerAnimationState !== 'idle') {
        playerAnimationState = 'idle';
        playerAnimationFrame = 0;
        playerAnimationTimer = 0;
        return;
    }
    
    // If moving, sync animation to movement progress instead of independent timer
    if (isPlayerMoving) {
        const frameSequence = playerAnimations[playerAnimationState];
        if (frameSequence && frameSequence.length > 1) {
            // Calculate frame based on movement progress (0.0 to 1.0)
            const frameIndex = Math.floor(moveAnimationProgress * frameSequence.length);
            playerAnimationFrame = Math.min(frameIndex, frameSequence.length - 1);
        } else {
            playerAnimationFrame = 0;
        }
    } else {
        // When not moving, use timer-based animation for idle
        playerAnimationTimer += deltaTime;
        
        if (playerAnimationTimer >= playerAnimationSpeed) {
            playerAnimationTimer = 0;
            
            const frameSequence = playerAnimations[playerAnimationState];
            if (frameSequence && frameSequence.length > 1) {
                playerAnimationFrame = (playerAnimationFrame + 1) % frameSequence.length;
            } else {
                playerAnimationFrame = 0;
            }
        }
    }
}

function isContinuousInputActive() {
    // Check if any movement keys are currently pressed
    return isKeyDown('ArrowLeft') || isKeyDown('ArrowRight') || 
           isKeyDown('ArrowUp') || isKeyDown('ArrowDown') ||
           (isTouchActive && (touchMoveDirection.x !== 0 || touchMoveDirection.y !== 0));
}

function checkForContinuedInput() {
    // When movement completes, immediately check for continued input
    // This eliminates the pause between consecutive tile movements
    
    let moveDirection = { x: 0, y: 0 };
    
    // Check for held keys
    if (isKeyDown('ArrowLeft')) {
        moveDirection = { x: -1, y: 0 };
    } else if (isKeyDown('ArrowRight')) {
        moveDirection = { x: 1, y: 0 };
    } else if (isKeyDown('ArrowUp')) {
        moveDirection = { x: 0, y: -1 };
    } else if (isKeyDown('ArrowDown')) {
        moveDirection = { x: 0, y: 1 };
    }
    
    // Check for active touch input
    if (isTouchActive && (touchMoveDirection.x !== 0 || touchMoveDirection.y !== 0)) {
        moveDirection = touchMoveDirection;
    }
    
    // If input is present, start next movement immediately
    if (moveDirection.x !== 0 || moveDirection.y !== 0) {
        attemptPlayerMove(moveDirection);
    }
}

function getCurrentPlayerPixelPos() {
    if (!isPlayerMoving) {
        return {
            x: levelOffsetX + playerPos.x * tileSize,
            y: levelOffsetY + playerPos.y * tileSize
        };
    }
    
    // Interpolate position during movement
    const t = easeInOutQuad(moveAnimationProgress);
    const lerpX = moveStartPos.x + (moveTargetPos.x - moveStartPos.x) * t;
    const lerpY = moveStartPos.y + (moveTargetPos.y - moveStartPos.y) * t;
    
    return {
        x: levelOffsetX + lerpX * tileSize,
        y: levelOffsetY + lerpY * tileSize
    };
}

function getCurrentBoxPixelPos(boxIndex) {
    if (!movingBox || movingBox.index !== boxIndex) {
        // Box is not moving, return grid position
        const box = currentLevel.boxes[boxIndex];
        return {
            x: levelOffsetX + box.x * tileSize,
            y: levelOffsetY + box.y * tileSize
        };
    }
    
    // Interpolate position during movement
    const t = easeInOutQuad(moveAnimationProgress);
    const lerpX = movingBox.startPos.x + (movingBox.targetPos.x - movingBox.startPos.x) * t;
    const lerpY = movingBox.startPos.y + (movingBox.targetPos.y - movingBox.startPos.y) * t;
    
    return {
        x: levelOffsetX + lerpX * tileSize,
        y: levelOffsetY + lerpY * tileSize
    };
}

// Helper functions
function isWall(x, y) {
    return currentLevel.walls.some(wall => wall.x === x && wall.y === y);
}

function findBoxAt(x, y) {
    return currentLevel.boxes.findIndex(box => box.x === x && box.y === y);
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

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
        // Update player movement animation
        updatePlayerMovement(secondsPassed);
        
        // Update player sprite animation
        updatePlayerAnimation(secondsPassed);
        
        // Legacy key processing (can be removed later)
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
    // Disable image smoothing to prevent anti-aliasing artifacts
    context.imageSmoothingEnabled = false;
    
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
    
    // Draw the cartoon image to fill the screen while maintaining aspect ratio
    if (crateEscapeCartoon.complete) {
        const imgWidth = crateEscapeCartoon.width;
        const imgHeight = crateEscapeCartoon.height;
        const scale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight); // Fill screen completely
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        context.drawImage(crateEscapeCartoon, x, y, scaledWidth, scaledHeight);
    }
}

function drawGameplay() {
    if (!currentLevel) {
        // If no level is loaded, show error message
        context.fillStyle = "#ffffff";
        context.font = "24px Arial";
        context.textAlign = "center";
        context.fillText("No level loaded", canvas.width / 2, canvas.height / 2);
        context.textAlign = "left";
        return;
    }
    
    // Draw the level grid
    for (let y = 0; y < currentLevel.height; y++) {
        for (let x = 0; x < currentLevel.width; x++) {
            const tileX = levelOffsetX + x * tileSize;
            const tileY = levelOffsetY + y * tileSize;
            const char = currentLevel.grid[y][x];
            
            // Draw background/floor for all tiles
            drawFloorTile(tileX, tileY);
            
            // Draw the appropriate sprite based on the character
            switch (char) {
                case '#': // Wall
                    drawWallTile(tileX, tileY);
                    break;
                case '.': // Goal
                    drawGoalTile(tileX, tileY);
                    break;
                case ' ': // Empty space (floor only)
                    // Floor already drawn above
                    break;
            }
        }
    }
    
    // Draw boxes with smooth movement
    currentLevel.boxes.forEach((box, index) => {
        const pixelPos = getCurrentBoxPixelPos(index);
        drawBoxTile(pixelPos.x, pixelPos.y);
    });
    
    // Draw player with smooth movement
    const playerPixelPos = getCurrentPlayerPixelPos();
    drawPlayerTile(playerPixelPos.x, playerPixelPos.y);
    
    // Draw level info
    drawLevelInfo();
}

// Placeholder functions for drawing tiles - YOU CAN MODIFY THESE TO USE SPRITES
function drawFloorTile(x, y) {
    // Using ground_01.png sprite from spriteSheet
    const sprite = textureAtlas.frames["ground_05.png"];
    context.drawImage(
        spriteSheet,
        sprite.x, sprite.y, sprite.width, sprite.height,
        x, y, tileSize, tileSize
    );
}

function drawWallTile(x, y) {
    // Using block_01.png sprite from spriteSheet
    const sprite = textureAtlas.frames["block_05.png"];
    context.drawImage(
        spriteSheet,
        sprite.x, sprite.y, sprite.width, sprite.height,
        x, y, tileSize, tileSize
    );
}

function drawGoalTile(x, y) {
    // Draw floor first
    drawFloorTile(x, y);
    
    // Using environment_02.png sprite (small goal/target sprite) from spriteSheet
    const sprite = textureAtlas.frames["environment_06.png"];
    // Scale goal to fit within tile with some margin for visibility
    const goalMargin = 4; // Margin so goal doesn't fill entire tile
    const goalSize = tileSize - (goalMargin * 2);
    // Center the goal sprite on the tile
    const goalX = x + goalMargin;
    const goalY = y + goalMargin;
    context.drawImage(
        spriteSheet,
        sprite.x, sprite.y, sprite.width, sprite.height,
        goalX, goalY, goalSize, goalSize
    );
}

function drawBoxTile(x, y) {
    // Using crate_01.png sprite from spriteSheet
    const sprite = textureAtlas.frames["crate_01.png"];
    context.drawImage(
        spriteSheet,
        sprite.x, sprite.y, sprite.width, sprite.height,
        x, y, tileSize, tileSize
    );
}

function drawPlayerTile(x, y) {
    // Get current animation frame sequence
    const frameSequence = playerAnimations[playerAnimationState];
    const frameNumber = frameSequence[playerAnimationFrame];
    
    // Get the sprite name for this frame (player sprites are numbered 01-24 with zero padding)
    const spriteName = `player_${frameNumber.toString().padStart(2, '0')}.png`;
    const sprite = textureAtlas.frames[spriteName];
    
    if (sprite) {
        context.drawImage(
            spriteSheet,
            sprite.x, sprite.y, sprite.width, sprite.height,
            x, y, tileSize, tileSize
        );
    } else {
        // Fallback to default sprite if frame not found
        const defaultSprite = textureAtlas.frames["player_03.png"];
        context.drawImage(
            spriteSheet,
            defaultSprite.x, defaultSprite.y, defaultSprite.width, defaultSprite.height,
            x, y, tileSize, tileSize
        );
        console.warn(`Player sprite not found: ${spriteName}`);
    }
}

function drawLevelInfo() {
    // Draw level information in the top-left corner
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(10, 10, 200, 80);
    
    context.fillStyle = "#ffffff";
    context.font = "16px Arial";
    context.fillText(`Set: ${currentSet}`, 20, 30);
    context.fillText(`Level: ${currentLevelNumber}`, 20, 50);
    context.fillText(`Boxes: ${currentLevel.boxes.length}`, 20, 70);
    context.fillText(`Goals: ${currentLevel.goals.length}`, 20, 90);
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
    
    // Recalculate tile size and level positioning for new screen dimensions
    if (currentLevel) {
        recalculateLevelLayout();
    }
}

// Function to recalculate level layout when screen size changes
function recalculateLevelLayout() {
    if (!currentLevel) return;
    
    // Recalculate optimal tile size for new screen dimensions
    tileSize = calculateOptimalTileSize();
    
    // Recalculate level centering offsets
    levelOffsetX = (canvas.width - currentLevel.width * tileSize) / 2;
    levelOffsetY = (canvas.height - currentLevel.height * tileSize) / 2;
    
    console.log(`Screen resized - New tile size: ${tileSize}px, Level centered at: (${levelOffsetX}, ${levelOffsetY})`);
}
function getMouseClickPosition(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    mouseX = Math.round(x / scale);
    mouseY = Math.round(y / scale);
}
// #endregion
