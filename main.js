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
            currentGameState = GAME_STATES.LEVEL_SELECT;
            initializeLevelSelect();
            lastInputType = "Level Select";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            return;
        } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
            advanceToNextLevel();
            return;
        }
    }
    
    // Handle level restart with Escape key
    if (e.key === 'Escape' && currentGameState === GAME_STATES.PLAYING) {
        restartCurrentLevel();
        return;
    }
    
    // Handle level selection navigation
    if (currentGameState === GAME_STATES.LEVEL_SELECT) {
        handleLevelSelectInput(e.key);
        return;
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
    if (currentGameState === GAME_STATES.PLAYING && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape'].includes(e.key)) {
        let keyName = e.key;
        if (e.key === ' ') keyName = 'Space';
        if (e.key === 'Escape') keyName = 'Escape (Restart)';
        
        lastInputType = `Keyboard: ${keyName}`;
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
        case "Escape":
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
        // Get click position
        getMouseClickPosition(canvas, e);
        
        // Check for restart button click during gameplay
        if (currentGameState === GAME_STATES.PLAYING && isClickOnRestartButton(mouseX, mouseY)) {
            restartCurrentLevel();
            return;
        }
        
        // Handle game state transitions (same logic as space key)
        if (currentGameState === GAME_STATES.TITLE) {
            currentGameState = GAME_STATES.LEVEL_SELECT;
            initializeLevelSelect();
            lastInputType = "Level Select";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            return;
        } else if (currentGameState === GAME_STATES.LEVEL_SELECT) {
            handleLevelSelectClick(mouseX, mouseY);
            return;
        } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
            advanceToNextLevel();
            return;
        }
        
        // Visual feedback for mouse click during gameplay
        lastInputType = "Mouse Click";
        clickCoordinates = `(${mouseX}, ${mouseY})`;
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
    });
    
    // Window resize events
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    
    // Prevent iOS magnifier and context menu on long press
    canvas.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Prevent selection and drag behaviors that can trigger magnifier
    canvas.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
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
                // Convert touch to canvas coordinates
                const canvasPos = getTouchCanvasPosition(touch);
                
                // Check for restart button tap during gameplay
                if (currentGameState === GAME_STATES.PLAYING && isClickOnRestartButton(canvasPos.x, canvasPos.y)) {
                    restartCurrentLevel();
                    return;
                }
                
                // Tap detected
                if (currentGameState === GAME_STATES.TITLE) {
                    // Go to level select on tap from title screen
                    currentGameState = GAME_STATES.LEVEL_SELECT;
                    initializeLevelSelect();
                    lastInputType = "Level Select";
                    lastInputTime = Date.now();
                    inputFadeTimer = 2000;
                } else if (currentGameState === GAME_STATES.LEVEL_SELECT) {
                    handleLevelSelectClick(canvasPos.x, canvasPos.y);
                } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
                    advanceToNextLevel();
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
let canvasColour = "#000000" // Black background
let scale = 1;
let xOffset = 0;
let yOffset = 0;
let mouseX = 0;
let mouseY = 0;

// Game state management
const GAME_STATES = {
    TITLE: 'title',
    LEVEL_SELECT: 'level_select',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_COMPLETE: 'level_complete'
};
let currentGameState = GAME_STATES.TITLE;

// Level selection variables
let levelSelectOption = 'start'; // 'start', 'set', 'level'
let selectedSet = 'Microban';
let selectedLevel = 1;

// Level progression variables
let currentSetName = 'Microban';
let isGameComplete = false;
let levelCompletionStartTime = 0;

// Level progression order: Microban -> Sasquatch_I -> Sasquatch_II -> Sasquatch_III
// Level counts are automatically calculated from SOKOBAN_LEVELS
const LEVEL_PROGRESSION = [
    { setName: 'Microban' },
    { setName: 'Sasquatch_I' },
    { setName: 'Sasquatch_II' },
    { setName: 'Sasquatch_III' }
];

// Function to get the number of levels in a set
function getLevelCount(setName) {
    const levelSet = SOKOBAN_LEVELS[setName];
    return levelSet ? levelSet.length : 0;
}

// Input feedback variables
let lastInputType = "";
let lastInputTime = 0;
let clickCoordinates = "";
let inputFadeTimer = 0;

// Game level variables
let currentLevel = null;
let currentSet = 'Microban'; // Start with Microban levels
let currentLevelNumber = 1; // Start with level 1
let tileSize = 32; // Size of each tile in pixels - will be calculated dynamically
let levelOffsetX = 0; // Offset for centering the level
let levelOffsetY = 0;

// Camera variables for panning large levels
let cameraX = 0; // Camera position in world coordinates
let cameraY = 0;
let levelNeedsPanning = false; // Whether level is larger than screen

// Status bar configuration
const STATUS_BAR_HEIGHT = 60;
let moveCount = 0;
let attemptCount = 1; // Start at 1 since first play is attempt 1

// Player movement variables
let playerPos = { x: 0, y: 0 }; // Current player position in grid coordinates
let playerPixelPos = { x: 0, y: 0 }; // Current player position in pixel coordinates
let isPlayerMoving = false;
let moveAnimationProgress = 0;
let moveDuration = 0.25; // Base animation duration in seconds
let currentMoveDuration = 0.25; // Current animation duration (can be adjusted for continuous movement)
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
    const availableHeight = canvas.height - padding - STATUS_BAR_HEIGHT; // Account for status bar
    
    // Calculate max tile size that fits the screen
    const maxTileWidth = Math.floor(availableWidth / currentLevel.width);
    const maxTileHeight = Math.floor(availableHeight / currentLevel.height);
    const maxPossibleTileSize = Math.min(maxTileWidth, maxTileHeight);
    
    // Enforce minimum tile size for mobile usability - prefer overflow over tiny tiles
    const minTileSize = 32; // Minimum for comfortable touch interaction
    
    // Find the largest safe tile size that fits within our constraints
    let optimalSize = 8; // Default minimum safe size
    
    for (let size of safeTileSizes) {
        if (size <= maxPossibleTileSize) {
            optimalSize = size;
        } else {
            break; // Sizes are ordered, so we can stop here
        }
    }
    
    // If the optimal size is below minimum, use minimum and allow overflow
    if (optimalSize < minTileSize) {
        optimalSize = minTileSize;
        console.log(`Level too large for screen - using minimum tile size ${minTileSize}px (level will overflow)`);
    }
    
    // Apply level-specific constraints for small levels only
    const levelArea = currentLevel.width * currentLevel.height;
    const isLargeLevel = levelArea > 200 || currentLevel.width > 20 || currentLevel.height > 15;
    
    if (!isLargeLevel && optimalSize >= minTileSize) {
        // Small levels: apply maximum constraint to prevent overly large tiles
        const maxTileSize = 64; // Maximum to prevent overly large tiles
        
        // Find the best safe size within min/max range
        let bestSize = optimalSize;
        for (let size of safeTileSizes) {
            if (size >= minTileSize && size <= maxTileSize && size <= maxPossibleTileSize) {
                bestSize = size;
            }
        }
        optimalSize = bestSize;
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
    
    // Clamp deltaTime to prevent large jumps that can cause judder
    secondsPassed = Math.min(secondsPassed, 0.1);
    
    update(secondsPassed);
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
function loadLevel(setName, levelNumber, isRestart = false) {
    currentLevel = LevelManager.getParsedLevel(setName, levelNumber);
    
    if (!currentLevel) {
        console.error(`Failed to load level ${levelNumber} from set ${setName}`);
        return false;
    }
    
    // Reset move count for level load/restart
    moveCount = 0;
    
    // Only reset attempt count for new levels, not restarts
    if (!isRestart) {
        attemptCount = 1;
    }
    
    // Calculate optimal tile size for this level and screen
    tileSize = calculateOptimalTileSize();
    
    // Check if level needs panning (level is larger than screen with minimum tile size)
    const levelPixelWidth = currentLevel.width * tileSize;
    const levelPixelHeight = currentLevel.height * tileSize;
    levelNeedsPanning = levelPixelWidth > canvas.width || levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT);
    
    // Initialize player position from level data
    playerPos = {
        x: currentLevel.playerStart.x,
        y: currentLevel.playerStart.y
    };
    
    // Initialize camera position
    if (levelNeedsPanning) {
        const halfScreenWidth = canvas.width / 2;
        const halfScreenHeight = (canvas.height - STATUS_BAR_HEIGHT) / 2;
        
        // Handle X axis (horizontal)
        if (levelPixelWidth > canvas.width) {
            // Level is wider than screen - use camera panning
            cameraX = Math.round(Math.max(0, Math.min(
                levelPixelWidth - canvas.width,
                playerPos.x * tileSize + tileSize / 2 - halfScreenWidth
            )));
        } else {
            // Level fits horizontally - center it (use negative offset for centering)
            cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
        }
        
        // Handle Y axis (vertical)
        if (levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT)) {
            // Level is taller than screen - use camera panning
            cameraY = Math.round(Math.max(0, Math.min(
                levelPixelHeight - (canvas.height - STATUS_BAR_HEIGHT),
                playerPos.y * tileSize + tileSize / 2 - halfScreenHeight
            ))) + STATUS_BAR_HEIGHT;
        } else {
            // Level fits vertically - center it (use negative offset for centering)
            cameraY = Math.round(-((canvas.height - STATUS_BAR_HEIGHT) - levelPixelHeight) / 2) + STATUS_BAR_HEIGHT;
        }
    } else {
        // No panning needed, reset camera to 0
        cameraX = 0;
        cameraY = 0;
    }
    
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
    
    // Calculate level centering offsets - use Math.floor to ensure integer pixel positions
    levelOffsetX = Math.floor((canvas.width - currentLevel.width * tileSize) / 2);
    levelOffsetY = Math.floor((canvas.height - STATUS_BAR_HEIGHT - currentLevel.height * tileSize) / 2) + STATUS_BAR_HEIGHT;
    
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
    
    // Increment move count
    moveCount++;
    
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
    
    // Determine new animation state based on movement direction
    let newAnimationState = 'idle';
    if (direction.x > 0) {
        newAnimationState = 'moving-right';
    } else if (direction.x < 0) {
        newAnimationState = 'moving-left';
    } else if (direction.y > 0) {
        newAnimationState = 'moving-down';
    } else if (direction.y < 0) {
        newAnimationState = 'moving-up';
    }
    
    // Only reset animation if direction changed, otherwise continue current animation
    if (playerAnimationState !== newAnimationState) {
        playerAnimationState = newAnimationState;
        playerAnimationFrame = 0;
        playerAnimationTimer = 0;
    }
    // If same direction, keep current frame and timer for smooth continuation
}

function updatePlayerMovement(deltaTime) {
    if (!isPlayerMoving) return;
    
    moveAnimationProgress += deltaTime / moveDuration;
    
    // Update camera during movement for smooth panning
    if (levelNeedsPanning) {
        // Use adaptive interpolation for smoother continuous movement
        const t = getInterpolationValue(moveAnimationProgress);
        const currentPlayerX = moveStartPos.x + (moveTargetPos.x - moveStartPos.x) * t;
        const currentPlayerY = moveStartPos.y + (moveTargetPos.y - moveStartPos.y) * t;
        
        // Update camera to follow interpolated player position
        const levelPixelWidth = currentLevel.width * tileSize;
        const levelPixelHeight = currentLevel.height * tileSize;
        const halfScreenWidth = canvas.width / 2;
        const halfScreenHeight = (canvas.height - STATUS_BAR_HEIGHT) / 2;
        
        // Handle X axis (horizontal)
        if (levelPixelWidth > canvas.width) {
            // Level is wider than screen - follow player
            const desiredCameraX = currentPlayerX * tileSize + tileSize / 2 - halfScreenWidth;
            cameraX = Math.round(Math.max(0, Math.min(levelPixelWidth - canvas.width, desiredCameraX)));
        } else {
            // Level fits horizontally - keep centered
            cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
        }
        
        // Handle Y axis (vertical)
        if (levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT)) {
            // Level is taller than screen - follow player
            const desiredCameraY = currentPlayerY * tileSize + tileSize / 2 - halfScreenHeight;
            cameraY = Math.round(Math.max(0, Math.min(levelPixelHeight - (canvas.height - STATUS_BAR_HEIGHT), desiredCameraY))) + STATUS_BAR_HEIGHT;
        } else {
            // Level fits vertically - keep centered
            cameraY = Math.round(-((canvas.height - STATUS_BAR_HEIGHT) - levelPixelHeight) / 2) + STATUS_BAR_HEIGHT;
        }
    }
    
    if (moveAnimationProgress >= 1.0) {
        // Movement complete
        moveAnimationProgress = 1.0;
        isPlayerMoving = false;
        
        // Update final positions
        playerPos.x = moveTargetPos.x;
        playerPos.y = moveTargetPos.y;
        
        // Update camera to follow player if panning is enabled
        updateCameraPosition();
        
        if (movingBox) {
            currentLevel.boxes[movingBox.index].x = movingBox.targetPos.x;
            currentLevel.boxes[movingBox.index].y = movingBox.targetPos.y;
            movingBox = null;
        }
        
        // Check if level is complete after movement
        checkLevelCompletion();
        
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
    
    // Use timer-based animation for consistent frame progression during multi-tile movement
    playerAnimationTimer += deltaTime;
    
    if (playerAnimationTimer >= playerAnimationSpeed) {
        playerAnimationTimer = 0;
        
        const frameSequence = playerAnimations[playerAnimationState];
        if (frameSequence && frameSequence.length > 1) {
            // Advance to next frame in sequence, cycling through frames
            playerAnimationFrame = (playerAnimationFrame + 1) % frameSequence.length;
        } else {
            // Single frame animations (like idle) stay at frame 0
            playerAnimationFrame = 0;
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
    if (levelNeedsPanning) {
        // For panning levels, player stays in center of screen (camera follows player)
        if (!isPlayerMoving) {
            return {
                x: playerPos.x * tileSize - cameraX,
                y: playerPos.y * tileSize - cameraY
            };
        }
        
        // Interpolate position during movement
        // Use adaptive interpolation for smoother continuous movement
        const t = getInterpolationValue(moveAnimationProgress);
        const lerpX = moveStartPos.x + (moveTargetPos.x - moveStartPos.x) * t;
        const lerpY = moveStartPos.y + (moveTargetPos.y - moveStartPos.y) * t;
        
        return {
            x: Math.round(lerpX * tileSize - cameraX),
            y: Math.round(lerpY * tileSize - cameraY)
        };
    } else {
        // For smaller levels, use level centering
        if (!isPlayerMoving) {
            return {
                x: levelOffsetX + playerPos.x * tileSize,
                y: levelOffsetY + playerPos.y * tileSize
            };
        }
        
        // Interpolate position during movement
        // Use adaptive interpolation for smoother continuous movement
        const t = getInterpolationValue(moveAnimationProgress);
        const lerpX = moveStartPos.x + (moveTargetPos.x - moveStartPos.x) * t;
        const lerpY = moveStartPos.y + (moveTargetPos.y - moveStartPos.y) * t;
        
        return {
            x: Math.round(levelOffsetX + lerpX * tileSize),
            y: Math.round(levelOffsetY + lerpY * tileSize)
        };
    }
}

function getCurrentBoxPixelPos(boxIndex) {
    if (!movingBox || movingBox.index !== boxIndex) {
        // Box is not moving, return grid position
        const box = currentLevel.boxes[boxIndex];
        
        if (levelNeedsPanning) {
            return {
                x: box.x * tileSize - cameraX,
                y: box.y * tileSize - cameraY
            };
        } else {
            return {
                x: levelOffsetX + box.x * tileSize,
                y: levelOffsetY + box.y * tileSize
            };
        }
    }
    
    // Interpolate position during movement
    // Use adaptive interpolation for smoother continuous movement
    const t = getInterpolationValue(moveAnimationProgress);
    const lerpX = movingBox.startPos.x + (movingBox.targetPos.x - movingBox.startPos.x) * t;
    const lerpY = movingBox.startPos.y + (movingBox.targetPos.y - movingBox.startPos.y) * t;
    
    if (levelNeedsPanning) {
        return {
            x: Math.round(lerpX * tileSize - cameraX),
            y: Math.round(lerpY * tileSize - cameraY)
        };
    } else {
        return {
            x: Math.round(levelOffsetX + lerpX * tileSize),
            y: Math.round(levelOffsetY + lerpY * tileSize)
        };
    }
}

// Helper functions
function isWall(x, y) {
    return currentLevel.walls.some(wall => wall.x === x && wall.y === y);
}

function findBoxAt(x, y) {
    return currentLevel.boxes.findIndex(box => box.x === x && box.y === y);
}

function isBoxOnGoal(boxIndex) {
    const box = currentLevel.boxes[boxIndex];
    return currentLevel.goals.some(goal => goal.x === box.x && goal.y === box.y);
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function isLevelComplete() {
    // Check if all boxes are on goal tiles
    if (!currentLevel || currentLevel.boxes.length === 0) return false;
    
    return currentLevel.boxes.every(box => 
        currentLevel.goals.some(goal => goal.x === box.x && goal.y === box.y)
    );
}

function checkLevelCompletion() {
    if (currentGameState === GAME_STATES.PLAYING && isLevelComplete()) {
        currentGameState = GAME_STATES.LEVEL_COMPLETE;
        levelCompletionStartTime = Date.now();
    }
}

function getNextLevel() {
    // Find current set in progression
    const currentSetIndex = LEVEL_PROGRESSION.findIndex(set => set.setName === currentSet);
    const currentSetInfo = LEVEL_PROGRESSION[currentSetIndex];
    const currentSetLevelCount = getLevelCount(currentSet);
    
    // Check if there are more levels in current set
    if (currentLevelNumber < currentSetLevelCount) {
        return {
            setName: currentSet,
            levelNumber: currentLevelNumber + 1,
            isComplete: false
        };
    }
    
    // Move to next set
    if (currentSetIndex < LEVEL_PROGRESSION.length - 1) {
        const nextSet = LEVEL_PROGRESSION[currentSetIndex + 1];
        return {
            setName: nextSet.setName,
            levelNumber: 1,
            isComplete: false
        };
    }
    
    // Game complete
    return {
        setName: currentSet,
        levelNumber: currentLevelNumber,
        isComplete: true
    };
}

function advanceToNextLevel() {
    const nextLevel = getNextLevel();
    
    if (nextLevel.isComplete) {
        isGameComplete = true;
        return;
    }
    
    currentSet = nextLevel.setName;
    currentLevelNumber = nextLevel.levelNumber;
    
    // Load the new level
    if (loadLevel(currentSet, currentLevelNumber)) {
        currentGameState = GAME_STATES.PLAYING;
    } else {
        console.error(`Failed to load level ${currentLevelNumber} from ${currentSet}`);
    }
}

function restartCurrentLevel() {
    // Increment attempt count
    attemptCount++;
    
    // Reload the current level with restart flag
    if (loadLevel(currentSet, currentLevelNumber, true)) {
        currentGameState = GAME_STATES.PLAYING;
        console.log(`Restarted level ${currentLevelNumber} from ${currentSet} (Attempt ${attemptCount})`);
    } else {
        console.error(`Failed to restart level ${currentLevelNumber} from ${currentSet}`);
    }
}

function isClickOnRestartButton(x, y) {
    // Restart button dimensions and position
    const buttonWidth = 80;
    const buttonHeight = 40;
    const buttonX = canvas.width - buttonWidth - 10; // 10px margin from right edge
    const buttonY = 10; // 10px margin from top
    
    return x >= buttonX && x <= buttonX + buttonWidth && 
           y >= buttonY && y <= buttonY + buttonHeight;
}

function getTouchCanvasPosition(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.round((touch.clientX - rect.left) / scale),
        y: Math.round((touch.clientY - rect.top) / scale)
    };
}

function getInterpolationValue(progress) {
    // Use linear interpolation for continuous movement to avoid pauses
    // Use eased interpolation for single movements for natural feel
    if (isContinuousInputActive()) {
        return progress; // Linear interpolation - constant speed
    } else {
        return easeInOutQuad(progress); // Eased interpolation - natural feel
    }
}

function updateCameraPosition() {
    if (!levelNeedsPanning) return;
    
    // Calculate level dimensions in pixels
    const levelPixelWidth = currentLevel.width * tileSize;
    const levelPixelHeight = currentLevel.height * tileSize;
    
    // Calculate desired camera position to center player on screen
    const halfScreenWidth = canvas.width / 2;
    const halfScreenHeight = (canvas.height - STATUS_BAR_HEIGHT) / 2;
    
    // Handle X axis (horizontal)
    if (levelPixelWidth > canvas.width) {
        // Level is wider than screen - follow player
        const desiredCameraX = playerPos.x * tileSize + tileSize / 2 - halfScreenWidth;
        cameraX = Math.round(Math.max(0, Math.min(levelPixelWidth - canvas.width, desiredCameraX)));
    } else {
        // Level fits horizontally - keep centered
        cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
    }
    
    // Handle Y axis (vertical)
    if (levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT)) {
        // Level is taller than screen - follow player
        const desiredCameraY = playerPos.y * tileSize + tileSize / 2 - halfScreenHeight;
        cameraY = Math.round(Math.max(0, Math.min(levelPixelHeight - (canvas.height - STATUS_BAR_HEIGHT), desiredCameraY))) + STATUS_BAR_HEIGHT;
    } else {
        // Level fits vertically - keep centered
        cameraY = Math.round(-((canvas.height - STATUS_BAR_HEIGHT) - levelPixelHeight) / 2) + STATUS_BAR_HEIGHT;
    }
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
    } else if (currentGameState === GAME_STATES.LEVEL_SELECT) {
        drawLevelSelectScreen();
    } else if (currentGameState === GAME_STATES.PLAYING) {
        drawGameplay();
    } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
        drawGameplay(); // Draw the completed level in background
        drawLevelCompleteOverlay();
    }
}

function drawTitleScreen() {
    // Draw title screen background
    context.fillStyle = "#000000"; // Black background
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the cartoon image to fill the screen while maintaining aspect ratio
    if (crateEscapeCartoon.complete) {
        const imgWidth = crateEscapeCartoon.width;
        const imgHeight = crateEscapeCartoon.height;
        const scale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight);
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        // Enable high-quality image smoothing for better scaling
        context.save();
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        context.drawImage(crateEscapeCartoon, x, y, scaledWidth, scaledHeight);
        
        context.restore();
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
            let tileX, tileY;
            
            if (levelNeedsPanning) {
                // Use camera offset for panning levels
                tileX = x * tileSize - cameraX;
                tileY = y * tileSize - cameraY;
            } else {
                // Use level centering for smaller levels
                tileX = levelOffsetX + x * tileSize;
                tileY = levelOffsetY + y * tileSize;
            }
            
            // Skip drawing tiles that are outside the visible area
            if (tileX + tileSize < 0 || tileX > canvas.width || 
                tileY + tileSize < 0 || tileY > canvas.height) {
                continue;
            }
            
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
        const isOnGoal = isBoxOnGoal(index);
        drawBoxTile(pixelPos.x, pixelPos.y, isOnGoal);
    });
    
    // Draw player with smooth movement
    const playerPixelPos = getCurrentPlayerPixelPos();
    drawPlayerTile(playerPixelPos.x, playerPixelPos.y);
    
    // Draw status bar on top of everything
    drawStatusBar();
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

function drawBoxTile(x, y, isOnGoal = false) {
    // Use different sprites based on whether box is on goal or not
    let spriteName;
    
    if (isOnGoal) {
        spriteName = "crate_01.png"; // Brighter sprite for boxes on goals
    } else {
        spriteName = "crate_11.png"; // Darker sprite for boxes not on goals
    }
    
    const sprite = textureAtlas.frames[spriteName];
    
    // Fallback to crate_01.png if the specified sprite doesn't exist
    if (!sprite) {
        spriteName = "crate_01.png";
        const fallbackSprite = textureAtlas.frames[spriteName];
        console.log(`Sprite "${spriteName}" not found, using fallback crate_01.png`);
    }
    
    if (isOnGoal) {
        // Draw a subtle glow behind the box when it's on a goal
        context.save();
        context.globalAlpha = 0.6;
        context.fillStyle = "#00FF00"; // Green glow
        context.fillRect(x - 2, y - 2, tileSize + 4, tileSize + 4);
        context.restore();
        
        // Draw the box with a slight color tint
        context.save();
        context.globalCompositeOperation = "multiply";
        context.fillStyle = "#CCFFCC"; // Light green tint
        context.fillRect(x, y, tileSize, tileSize);
        context.globalCompositeOperation = "source-over";
        context.restore();
    }
    
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

function drawStatusBar() {
    // Draw dark background with subtle gradient
    const gradient = context.createLinearGradient(0, 0, 0, STATUS_BAR_HEIGHT);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.95)");
    gradient.addColorStop(1, "rgba(20, 20, 40, 0.95)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, STATUS_BAR_HEIGHT);
    
    // Draw neon border at bottom of status bar (more subtle)
    context.shadowColor = "#00ffff";
    context.shadowBlur = 8;
    context.fillStyle = "#00ffff";
    context.fillRect(0, STATUS_BAR_HEIGHT - 3, canvas.width, 3);
    context.shadowBlur = 0;
    
    // Helper function to draw neon text
    function drawNeonText(text, x, y, color = "#00ffff", glowColor = "#00ffff") {
        // Draw text without glow - just the color
        context.shadowBlur = 0;
        context.fillStyle = color;
        context.fillText(text, x, y);
    }
    
    // Responsive layout based on screen width
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? "bold 14px 'Courier New', monospace" : "bold 18px 'Courier New', monospace";
    
    // Set text properties
    context.font = fontSize;
    context.textAlign = "left";
    
    // Draw neon restart button first to reserve space
    const buttonWidth = isMobile ? 70 : 90;
    const buttonHeight = isMobile ? 30 : 40;
    const buttonX = canvas.width - buttonWidth - 10;
    const buttonY = isMobile ? 15 : 10;
    const reservedButtonSpace = buttonWidth + 20; // Button width + padding
    
    // Available space for text (excluding button area)
    const availableTextWidth = canvas.width - 30 - reservedButtonSpace; // 15px left + 15px right padding
    
    if (isMobile) {
        // Mobile layout: Stack text in two rows with full text
        const levelText = `${currentSet} - Level ${currentLevelNumber}`;
        const moveText = `Moves: ${moveCount}`;
        const attemptText = `Attempts: ${attemptCount}`;
        
        drawNeonText(levelText, 15, 25, "#00ffff", "#00ffff");
        
        // Draw moves and attempts separately to maintain colors
        drawNeonText(moveText, 15, 45, "#00ff88", "#00ff88");
        const moveTextWidth = context.measureText(moveText).width;
        drawNeonText(attemptText, 15 + moveTextWidth + 20, 45, "#ff00ff", "#ff00ff");
    } else {
        // Desktop layout: Single row with proper spacing
        const levelText = `${currentSet} - Level ${currentLevelNumber}`;
        const moveText = `Moves: ${moveCount}`;
        const attemptText = `Attempts: ${attemptCount}`;
        
        // Measure text widths
        const levelTextWidth = context.measureText(levelText).width;
        const moveTextWidth = context.measureText(moveText).width;
        const attemptTextWidth = context.measureText(attemptText).width;
        
        // Calculate total width needed
        const totalTextWidth = levelTextWidth + moveTextWidth + attemptTextWidth + 60; // 60px for spacing
        
        if (totalTextWidth <= availableTextWidth) {
            // All text fits - use normal spacing
            drawNeonText(levelText, 15, 35, "#00ffff", "#00ffff");
            drawNeonText(moveText, 15 + levelTextWidth + 30, 35, "#00ff88", "#00ff88");
            drawNeonText(attemptText, 15 + levelTextWidth + 30 + moveTextWidth + 30, 35, "#ff00ff", "#ff00ff");
        } else {
            // Text doesn't fit - use abbreviated format
            const shortLevelText = `${currentSet} - Lv${currentLevelNumber}`;
            const shortStatsText = `${moveCount}m ${attemptCount}a`;
            
            drawNeonText(shortLevelText, 15, 35, "#00ffff", "#00ffff");
            const shortLevelWidth = context.measureText(shortLevelText).width;
            drawNeonText(shortStatsText, 15 + shortLevelWidth + 20, 35, "#00ff88", "#00ff88");
        }
    }
    
    // Button neon glow background (more subtle)
    context.shadowColor = "#ff6600";
    context.shadowBlur = 12;
    context.fillStyle = "rgba(255, 102, 0, 0.2)";
    context.fillRect(buttonX - 5, buttonY - 5, buttonWidth + 10, buttonHeight + 10);
    
    // Button background
    context.shadowBlur = 0;
    context.fillStyle = "rgba(30, 30, 30, 0.9)";
    context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button neon border (more subtle)
    context.shadowColor = "#ff6600";
    context.shadowBlur = 8;
    context.strokeStyle = "#ff6600";
    context.lineWidth = 2;
    context.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    context.shadowBlur = 0;
    
    // Button text with orange neon
    context.font = isMobile ? "bold 12px 'Courier New', monospace" : "bold 14px 'Courier New', monospace";
    context.textAlign = "center";
    drawNeonText("RESTART", buttonX + buttonWidth / 2, buttonY + buttonHeight / 2 + 5, "#ff6600", "#ff6600");
    
    // Reset text alignment
    context.textAlign = "left";
}

function drawLevelCompleteOverlay() {
    // Calculate text positioning
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Mobile detection and responsive sizing
    const isMobile = canvas.width < 600;
    const padding = isMobile ? 20 : 40; // Reduce padding on mobile
    
    // Calculate overlay height based on content
    const lineHeight = 60; // Space between text lines
    const overlayHeight = 200; // Fixed height for 4 lines of text + padding
    const overlayY = centerY - overlayHeight / 2;
    
    // Draw semi-transparent overlay with dark gradient (more transparent)
    const gradient = context.createLinearGradient(0, overlayY, 0, overlayY + overlayHeight);
    gradient.addColorStop(0, "rgba(0, 10, 20, 0.7)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.7)");
    gradient.addColorStop(1, "rgba(20, 0, 20, 0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, overlayY, canvas.width, overlayHeight);
    
    // Draw neon borders at top and bottom (more subtle)
    context.shadowColor = "#00ff00";
    context.shadowBlur = 10;
    context.fillStyle = "#00ff00";
    context.fillRect(0, overlayY, canvas.width, 3); // Top border
    context.fillRect(0, overlayY + overlayHeight - 3, canvas.width, 3); // Bottom border
    context.shadowBlur = 0;
    
    // Helper function to draw responsive text with overflow protection
    function drawResponsiveText(text, x, y, color = "#00ffff", baseFontSize = 24) {
        // Responsive font sizing
        const fontSize = isMobile ? Math.max(baseFontSize * 0.7, 16) : baseFontSize;
        context.font = `bold ${fontSize}px 'Courier New', monospace`;
        
        // Check if text fits, if not, try smaller font or truncate
        let adjustedText = text;
        let textWidth = context.measureText(adjustedText).width;
        const maxWidth = canvas.width - (padding * 2);
        
        if (textWidth > maxWidth) {
            // Try smaller font first
            const smallerSize = fontSize * 0.8;
            context.font = `bold ${smallerSize}px 'Courier New', monospace`;
            textWidth = context.measureText(adjustedText).width;
            
            // If still too wide, truncate text
            if (textWidth > maxWidth) {
                while (textWidth > maxWidth && adjustedText.length > 10) {
                    adjustedText = adjustedText.slice(0, -4) + "...";
                    textWidth = context.measureText(adjustedText).width;
                }
            }
        }
        
        // Draw text without glow - just the color
        context.shadowBlur = 0;
        context.fillStyle = color;
        context.fillText(adjustedText, x, y);
        
        return adjustedText; // Return in case caller needs the adjusted text
    }
    
    // Main completion message with green neon glow
    context.textAlign = "center";
    drawResponsiveText("LEVEL COMPLETE!", centerX, centerY - 40, "#00ff00", 48);
    
    // Get next level info for subtitle
    const nextLevel = getNextLevel();
    let subtitle = "";
    let subtitleColor = "#00ffff";
    
    if (nextLevel.isComplete) {
        subtitle = "CONGRATULATIONS! GAME COMPLETE!";
        subtitleColor = "#ff6600"; // Orange for game complete
    } else if (nextLevel.setName !== currentSet) {
        // Moving to new set
        subtitle = `STARTING ${nextLevel.setName.toUpperCase()}`;
        subtitleColor = "#ff00ff"; // Magenta for new set
    } else {
        // Next level in same set
        subtitle = `NEXT: LEVEL ${nextLevel.levelNumber}`;
        subtitleColor = "#00ffff"; // Cyan for next level
    }
    
    drawResponsiveText(subtitle, centerX, centerY + 10, subtitleColor, 24);
    
    // Show completion stats with gold neon
    const statsText = `COMPLETED IN ${moveCount} MOVES (ATTEMPT ${attemptCount})`;
    drawResponsiveText(statsText, centerX, centerY + 40, "#ffdd00", 20);
    
    // Instructions with pulsing effect
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
    const instructColor = `rgba(255, 255, 255, ${pulse})`;
    
    // Use responsive sizing for instructions too
    const instructFontSize = isMobile ? 14 : 18;
    context.font = `bold ${instructFontSize}px 'Courier New', monospace`;
    context.shadowColor = "#ffffff";
    context.shadowBlur = 10 * pulse;
    context.fillStyle = instructColor;
    
    // Check if instruction text fits
    let instructText = "PRESS SPACE OR TAP TO CONTINUE";
    let instructWidth = context.measureText(instructText).width;
    if (instructWidth > canvas.width - (padding * 2)) {
        instructText = "TAP TO CONTINUE";
    }
    
    context.fillText(instructText, centerX, centerY + 70);
    context.shadowBlur = 0;
    
    // Reset text alignment
    context.textAlign = "left";
}
// #endregion

// #region Level Selection System
function initializeLevelSelect() {
    levelSelectOption = 'start';
    selectedSet = 'Microban';
    selectedLevel = 1;
}

function drawLevelSelectScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? 24 : 32;
    const smallFontSize = isMobile ? 16 : 20;
    
    // Title
    context.font = `bold ${fontSize + 8}px 'Courier New', monospace`;
    context.fillStyle = "#00ffff";
    context.textAlign = "center";
    context.fillText("SELECT LEVEL", centerX, 80);
    
    // Options
    const optionY = 150;
    const spacing = 80;
    
    // Start from beginning option
    const startColor = levelSelectOption === 'start' ? "#00ff00" : "#ffffff";
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = startColor;
    context.fillText("► START FROM BEGINNING", centerX, optionY);
    
    // Choose level option
    const chooseColor = levelSelectOption === 'choose' ? "#00ff00" : "#ffffff";
    context.fillStyle = chooseColor;
    context.fillText("► CHOOSE LEVEL", centerX, optionY + spacing);
    
    if (levelSelectOption === 'choose') {
        // Show set selection
        context.font = `bold ${smallFontSize}px 'Courier New', monospace`;
        context.fillStyle = "#ffdd00";
        context.fillText(`SET: ${selectedSet}`, centerX, optionY + spacing + 40);
        
        // Show level selection
        const maxLevel = getLevelCount(selectedSet);
        context.fillText(`LEVEL: ${selectedLevel} / ${maxLevel}`, centerX, optionY + spacing + 70);
        
        // Instructions
        context.font = `${smallFontSize - 2}px 'Courier New', monospace`;
        context.fillStyle = "#cccccc";
        context.fillText("↑↓ CHANGE OPTION  ←→ CHANGE VALUES  SPACE TO START", centerX, optionY + spacing + 120);
    } else {
        // Instructions for start option
        context.font = `${smallFontSize}px 'Courier New', monospace`;
        context.fillStyle = "#cccccc";
        context.fillText("↑↓ CHANGE OPTION  SPACE TO START", centerX, optionY + spacing + 80);
    }
    
    context.textAlign = "left";
}

function handleLevelSelectInput(key) {
    switch (key) {
        case 'ArrowUp':
            levelSelectOption = levelSelectOption === 'choose' ? 'start' : 'choose';
            break;
        case 'ArrowDown':
            levelSelectOption = levelSelectOption === 'start' ? 'choose' : 'start';
            break;
        case 'ArrowLeft':
            if (levelSelectOption === 'choose') {
                handleLevelSelectLeft();
            }
            break;
        case 'ArrowRight':
            if (levelSelectOption === 'choose') {
                handleLevelSelectRight();
            }
            break;
        case ' ':
            startSelectedLevel();
            break;
        case 'Escape':
            currentGameState = GAME_STATES.TITLE;
            break;
    }
}

function handleLevelSelectLeft() {
    // Cycle through sets or decrease level
    const setNames = Object.keys(SOKOBAN_LEVELS);
    const currentSetIndex = setNames.indexOf(selectedSet);
    
    if (currentSetIndex > 0) {
        selectedSet = setNames[currentSetIndex - 1];
        selectedLevel = 1; // Reset to level 1 when changing sets
    } else {
        // Decrease level if we're at the first set
        if (selectedLevel > 1) {
            selectedLevel--;
        }
    }
}

function handleLevelSelectRight() {
    // Cycle through sets or increase level
    const setNames = Object.keys(SOKOBAN_LEVELS);
    const currentSetIndex = setNames.indexOf(selectedSet);
    const maxLevel = getLevelCount(selectedSet);
    
    if (selectedLevel < maxLevel) {
        selectedLevel++;
    } else if (currentSetIndex < setNames.length - 1) {
        selectedSet = setNames[currentSetIndex + 1];
        selectedLevel = 1; // Reset to level 1 when changing sets
    }
}

function handleLevelSelectClick(x, y) {
    const centerX = canvas.width / 2;
    const optionY = 150;
    const spacing = 80;
    
    // Check if clicking on "Start from beginning"
    if (y >= optionY - 20 && y <= optionY + 20) {
        levelSelectOption = 'start';
        startSelectedLevel();
        return;
    }
    
    // Check if clicking on "Choose level"
    if (y >= optionY + spacing - 20 && y <= optionY + spacing + 20) {
        if (levelSelectOption === 'choose') {
            startSelectedLevel();
        } else {
            levelSelectOption = 'choose';
        }
        return;
    }
    
    // If in choose mode, handle clicks on set/level areas
    if (levelSelectOption === 'choose') {
        // Set area click
        if (y >= optionY + spacing + 20 && y <= optionY + spacing + 60) {
            if (x < centerX) {
                handleLevelSelectLeft();
            } else {
                handleLevelSelectRight();
            }
        }
        // Level area click
        else if (y >= optionY + spacing + 50 && y <= optionY + spacing + 90) {
            if (x < centerX) {
                if (selectedLevel > 1) selectedLevel--;
            } else {
                const maxLevel = getLevelCount(selectedSet);
                if (selectedLevel < maxLevel) selectedLevel++;
            }
        }
    }
}

function startSelectedLevel() {
    if (levelSelectOption === 'start') {
        // Start from beginning - reset to first level
        currentSet = 'Microban';
        currentLevelNumber = 1;
    } else {
        // Start from selected level
        currentSet = selectedSet;
        currentLevelNumber = selectedLevel;
    }
    
    // Load the selected level and start the game
    loadLevel(currentSet, currentLevelNumber);
    currentGameState = GAME_STATES.PLAYING;
    lastInputType = "Game Started!";
    lastInputTime = Date.now();
    inputFadeTimer = 2000;
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
    
    // Recalculate panning detection and camera positioning
    const levelPixelWidth = currentLevel.width * tileSize;
    const levelPixelHeight = currentLevel.height * tileSize;
    levelNeedsPanning = levelPixelWidth > canvas.width || levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT);
    
    if (levelNeedsPanning) {
        const halfScreenWidth = canvas.width / 2;
        const halfScreenHeight = (canvas.height - STATUS_BAR_HEIGHT) / 2;
        
        // Handle X axis (horizontal)
        if (levelPixelWidth > canvas.width) {
            // Level is wider than screen - use camera panning
            cameraX = Math.round(Math.max(0, Math.min(
                levelPixelWidth - canvas.width,
                playerPos.x * tileSize + tileSize / 2 - halfScreenWidth
            )));
        } else {
            // Level fits horizontally - center it
            cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
        }
        
        // Handle Y axis (vertical)
        if (levelPixelHeight > (canvas.height - STATUS_BAR_HEIGHT)) {
            // Level is taller than screen - use camera panning
            cameraY = Math.round(Math.max(0, Math.min(
                levelPixelHeight - (canvas.height - STATUS_BAR_HEIGHT),
                playerPos.y * tileSize + tileSize / 2 - halfScreenHeight
            ))) + STATUS_BAR_HEIGHT;
        } else {
            // Level fits vertically - center it
            cameraY = Math.round(-((canvas.height - STATUS_BAR_HEIGHT) - levelPixelHeight) / 2) + STATUS_BAR_HEIGHT;
        }
    } else {
        // No panning needed, reset camera and use level centering
        cameraX = 0;
        cameraY = 0;
        
        // Recalculate level centering offsets for smaller levels
        levelOffsetX = Math.floor((canvas.width - currentLevel.width * tileSize) / 2);
        levelOffsetY = Math.floor((canvas.height - STATUS_BAR_HEIGHT - currentLevel.height * tileSize) / 2) + STATUS_BAR_HEIGHT;
    }
    
    console.log(`Screen resized - New tile size: ${tileSize}px, Panning: ${levelNeedsPanning}, Camera: (${cameraX}, ${cameraY})`);
}
function getMouseClickPosition(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    mouseX = Math.round(x / scale);
    mouseY = Math.round(y / scale);
}
// #endregion
