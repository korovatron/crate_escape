// DEBUG VERSION 9.9.2025-C - GREEN UPDATES
console.log("LOADED: Main.js with GREEN updates - Sept 9 2025");
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
    
    // Handle level try again with R key
    if ((e.key === 'r' || e.key === 'R') && currentGameState === GAME_STATES.PLAYING) {
        restartCurrentLevel();
        return;
    }
    
    // Handle exit with Escape key (back button behavior)
    if (e.key === 'Escape' && currentGameState === GAME_STATES.PLAYING) {
        currentGameState = GAME_STATES.LEVEL_SELECT;
        initializeLevelSelect();
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
    if (currentGameState === GAME_STATES.PLAYING && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape', 'r', 'R'].includes(e.key)) {
        let keyName = e.key;
        if (e.key === ' ') keyName = 'Space';
        if (e.key === 'Escape') keyName = 'Escape (Exit)';
        if (e.key === 'r' || e.key === 'R') keyName = 'R (Try Again)';
        
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
let isUsingTouch = false; // Flag to prevent mouse event conflicts on touch devices
let lastTouchMoveTime = 0;
let touchMoveDirection = { x: 0, y: 0 };
let touchMoveTimer = null;
const touchMoveThreshold = 20; // Minimum movement to trigger continuous movement
const touchMoveCooldown = 200; // Milliseconds between continuous moves

function setupCanvasEventListeners() {
    // Mouse events
    document.addEventListener("mousedown", function (e) {
        // Prevent mouse events if we're using touch
        if (isUsingTouch) {
            return;
        }
        
        // Get click position
        getMouseClickPosition(canvas, e);
        
        // Check for button clicks during gameplay
        if (currentGameState === GAME_STATES.PLAYING) {
            if (isClickOnOverviewButton(mouseX, mouseY)) {
                toggleOverviewMode();
                return;
            }
            if (isClickOnTryAgainButton(mouseX, mouseY)) {
                restartCurrentLevel();
                return;
            }
            if (isClickOnExitButton(mouseX, mouseY)) {
                currentGameState = GAME_STATES.LEVEL_SELECT;
                initializeLevelSelect();
                return;
            }
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
        isUsingTouch = true; // Mark that we're using touch
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
                
                // Check for button taps during gameplay
                if (currentGameState === GAME_STATES.PLAYING) {
                    if (isClickOnOverviewButton(canvasPos.x, canvasPos.y)) {
                        toggleOverviewMode();
                        return;
                    }
                    if (isClickOnTryAgainButton(canvasPos.x, canvasPos.y)) {
                        restartCurrentLevel();
                        return;
                    }
                    if (isClickOnExitButton(canvasPos.x, canvasPos.y)) {
                        currentGameState = GAME_STATES.LEVEL_SELECT;
                        initializeLevelSelect();
                        return;
                    }
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
let selectedSet = Object.keys(SOKOBAN_LEVELS)[0];
let selectedLevel = 0; // No level selected initially

// Grid-based level selection variables
let currentLevelPage = 0;
let levelsPerPage = 1; // Will be calculated based on screen size
let pageCalculatedForLastPlayed = false; // Flag to track if we've calculated page for last played level
let hasLastPlayedLevel = false; // Flag to indicate if we loaded a last played level
let gridColumns = 1; // Will be calculated based on screen size
let gridRows = 1; // Will be calculated based on screen size

// Progress tracking with IndexedDB
let progressDB = null;
let levelProgress = new Map(); // Cache for level progress: key = "setName_levelNumber", value = {attempted: boolean, completed: boolean}

// Level progression variables
let currentSetName = Object.keys(SOKOBAN_LEVELS)[0];
let isGameComplete = false;
let levelCompletionStartTime = 0;

// Level progression order: automatically generated from levels.js order
// Level counts are automatically calculated from SOKOBAN_LEVELS
const LEVEL_PROGRESSION = Object.keys(SOKOBAN_LEVELS).map(setName => ({ setName }));

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
let currentSet = Object.keys(SOKOBAN_LEVELS)[0]; // Start with first set from levels.js
let currentLevelNumber = 1; // Start with level 1
let tileSize = 32; // Size of each tile in pixels - will be calculated dynamically
let levelOffsetX = 0; // Offset for centering the level
let levelOffsetY = 0;

// Camera variables for panning large levels
let cameraX = 0; // Camera position in world coordinates
let cameraY = 0;
let levelNeedsPanning = false; // Whether level is larger than screen

// Overview mode variables
let overviewMode = false; // Current overview mode state
let overviewScale = 1;
let overviewOffsetX = 0;
let overviewOffsetY = 0;

// Status bar configuration
const STATUS_BAR_HEIGHT = 60;
let moveCount = 0;
let pushCount = 0; // Track successful box pushes
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

const spriteSheet = new Image();
const footprintLogo = new Image();
const pushLogo = new Image();
const cartoonLogo = new Image();
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
    const numberImages = 4; // spriteSheet, footprintLogo, pushLogo, cartoonLogo
    
    spriteSheet.src = "assets/images/spriteSheet.png";
    spriteSheet.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    footprintLogo.src = "assets/images/footprintLogo.png";
    footprintLogo.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    pushLogo.src = "assets/images/pushLogo.png";
    pushLogo.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    cartoonLogo.src = "assets/images/cartoonLogo.png";
    cartoonLogo.onload = function () {
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
    setupBackgroundAppHandler(); // Handle PWA background/foreground transitions
    resizeCanvas();
    
    // Initialize progress tracking database
    initProgressDatabase().then(async () => {
        console.log('Database initialization completed');
        
        if (progressDB) {
            await loadLevelProgress();
            console.log('Level progress loaded');
            
            // Load last played level to set initial level selector position
            const lastPlayed = await loadLastPlayedLevel();
            console.log('Last played query result:', lastPlayed);
            
            if (lastPlayed) {
                // If player has played before, set the level selector to their last played level
                currentSet = lastPlayed.setName;
                currentLevelNumber = lastPlayed.levelNumber;
                selectedSet = lastPlayed.setName;
                hasLastPlayedLevel = true;
                
                console.log(`Set level selector to last played: ${currentSet} level ${currentLevelNumber}`);
            } else {
                // First time player - ensure we start with the first set from levels.js
                const firstSetName = Object.keys(SOKOBAN_LEVELS)[0];
                currentSet = firstSetName;
                currentLevelNumber = 1;
                selectedSet = firstSetName;
                currentLevelPage = 0;
                
                console.log(`New player - starting with first set: ${currentSet}`);
            }
        } else {
            console.log('Database not available, using defaults');
        }
        
        // Keep the original game flow - start at title screen
        // The level selector initialization will be used when entering level select mode
        console.log('Database initialization complete, keeping title screen start');
    });
    
    window.requestAnimationFrame(gameLoop);
}

// Handle PWA background/foreground transitions to fix stuck input
function setupBackgroundAppHandler() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // App returned to foreground - clear all stuck input states
            pressedKeys.clear();
            
            // Reset touch state
            isTouchActive = false;
            touchMoveDirection.x = 0;
            touchMoveDirection.y = 0;
            swipeProcessed = false;
            
            // Clear any ongoing touch timer
            if (touchMoveTimer) {
                clearInterval(touchMoveTimer);
                touchMoveTimer = null;
            }
        }
    });
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
    pushCount = 0;
    
    // Only reset attempt count for new levels, not restarts
    if (!isRestart) {
        attemptCount = 1;
        // Mark level as attempted when first loaded (not on restart)
        markLevelAttempted(setName, levelNumber);
        // Save as last played level
        saveLastPlayedLevel(setName, levelNumber);
    }
    
    // Reset overview mode for new levels (not restarts)
    if (!isRestart) {
        overviewMode = false; // Ensure we start in normal mode
    }
    
    // Calculate optimal tile size for this level and screen
    tileSize = calculateOptimalTileSize();
    
    // Check if level needs panning (level is larger than screen with minimum tile size)
    const levelPixelWidth = currentLevel.width * tileSize;
    const levelPixelHeight = currentLevel.height * tileSize;
    levelNeedsPanning = levelPixelWidth > canvas.width || levelPixelHeight > canvas.height;
    
    // Initialize player position from level data
    playerPos = {
        x: currentLevel.playerStart.x,
        y: currentLevel.playerStart.y
    };
    
    // Initialize camera position
    if (levelNeedsPanning) {
        const halfScreenWidth = canvas.width / 2;
        const playableHeight = canvas.height - STATUS_BAR_HEIGHT;
        const halfPlayableHeight = playableHeight / 2;
        
        // Handle X axis (horizontal)
        if (levelPixelWidth > canvas.width) {
            // Level is wider than screen - center player in middle of screen
            const desiredCameraX = playerPos.x * tileSize + tileSize / 2 - halfScreenWidth;
            cameraX = Math.round(Math.max(0, Math.min(levelPixelWidth - canvas.width, desiredCameraX)));
        } else {
            // Level fits horizontally - center it (use negative offset for centering)
            cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
        }
        
        // Handle Y axis (vertical) - account for status bar
        if (levelPixelHeight > playableHeight) {
            // Level is taller than playable area - center player in middle of visible game area
            const desiredCameraY = playerPos.y * tileSize + tileSize / 2 - halfPlayableHeight - STATUS_BAR_HEIGHT;
            cameraY = Math.round(Math.max(-STATUS_BAR_HEIGHT, Math.min(
                levelPixelHeight - canvas.height,
                desiredCameraY
            )));
        } else {
            // Level fits vertically - center it in playfield (match offset mode positioning)
            cameraY = Math.round(-((playableHeight - levelPixelHeight) / 2 + STATUS_BAR_HEIGHT));
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
    // Block player movement when in overview mode
    if (overviewMode) {
        return false;
    }
    
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
    
    // Increment push count if pushing a box
    if (boxIndex !== null) {
        pushCount++;
    }
    
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
        const playableHeight = canvas.height - STATUS_BAR_HEIGHT;
        const halfPlayableHeight = playableHeight / 2;
        
        // Handle X axis (horizontal)
        if (levelPixelWidth > canvas.width) {
            // Level is wider than screen - follow player
            const desiredCameraX = currentPlayerX * tileSize + tileSize / 2 - halfScreenWidth;
            cameraX = Math.round(Math.max(0, Math.min(levelPixelWidth - canvas.width, desiredCameraX)));
        } else {
            // Level fits horizontally - keep centered
            cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
        }
        
        // Handle Y axis (vertical) - account for status bar
        if (levelPixelHeight > playableHeight) {
            // Level is taller than playable area - follow player
            const desiredCameraY = currentPlayerY * tileSize + tileSize / 2 - halfPlayableHeight - STATUS_BAR_HEIGHT;
            cameraY = Math.round(Math.max(-STATUS_BAR_HEIGHT, Math.min(levelPixelHeight - canvas.height, desiredCameraY)));
        } else {
            // Level fits vertically - keep centered in playable area (match offset mode behavior)
            cameraY = Math.round(-((playableHeight - levelPixelHeight) / 2 + STATUS_BAR_HEIGHT));
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
        // For panning levels, player position with camera offset
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
        
        // Mark level as completed for progress tracking
        markLevelCompleted(currentSet, currentLevelNumber);
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

function isClickOnOverviewButton(x, y) {
    const showOverviewButton = levelNeedsPanning || overviewMode; // Show when needed OR when active
    if (!showOverviewButton) return false;
    
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45; // Match drawStatusBar sizing
    const rightMargin = 10;
    
    // Use same position calculation as drawStatusBar (aligned with exit button)
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const overviewButtonX = exitButtonX; // Align horizontally with exit button
    
    // Center vertically on the green overlay (same calculation as drawStatusBar)
    const titleHeight = isMobile ? 24 : 36;
    const subtitleHeight = isMobile ? 14 : 18;
    const textSpacing = 10;
    const verticalPadding = 15;
    const overlayHeight = titleHeight + subtitleHeight + textSpacing + (verticalPadding * 2);
    const overlayY = STATUS_BAR_HEIGHT + 10;
    const overviewButtonY = overlayY + (overlayHeight / 2) - (buttonSize / 2); // Center on green overlay
    
    return x >= overviewButtonX && x <= overviewButtonX + buttonSize &&
           y >= overviewButtonY && y <= overviewButtonY + buttonSize;
}

function toggleOverviewMode() {
    overviewMode = !overviewMode;
    
    // Clear any pending input states when switching modes
    pressedKeys.clear();
    lastKeyTime.clear();
    
    // Reset input tracking
    lastInputType = overviewMode ? "Overview On" : "Overview Off";
    lastInputTime = Date.now();
    inputFadeTimer = 2000;
}

function isClickOnTryAgainButton(x, y) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45; // Match drawStatusBar sizing
    const restartButtonWidth = isMobile ? 75 : 90; // Wider restart button to fit 3-digit attempt counts
    const buttonSpacing = 8;
    const rightMargin = 10;
    
    // Use same calculations as drawStatusBar
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    const restartButtonX = exitButtonX - restartButtonWidth - buttonSpacing;
    const restartButtonY = exitButtonY;
    
    return x >= restartButtonX && x <= restartButtonX + restartButtonWidth &&
           y >= restartButtonY && y <= restartButtonY + buttonSize;
}

function isClickOnExitButton(x, y) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45; // Match drawStatusBar sizing
    const rightMargin = 10;
    
    // Use same calculations as drawStatusBar
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    
    return x >= exitButtonX && x <= exitButtonX + buttonSize &&
           y >= exitButtonY && y <= exitButtonY + buttonSize;
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
    
    // Calculate desired camera position to center player in playable area
    const halfScreenWidth = canvas.width / 2;
    const playableHeight = canvas.height - STATUS_BAR_HEIGHT;
    const halfPlayableHeight = playableHeight / 2;
    
    // Handle X axis (horizontal)
    if (levelPixelWidth > canvas.width) {
        // Level is wider than screen - follow player
        const desiredCameraX = playerPos.x * tileSize + tileSize / 2 - halfScreenWidth;
        cameraX = Math.round(Math.max(0, Math.min(levelPixelWidth - canvas.width, desiredCameraX)));
    } else {
        // Level fits horizontally - keep centered
        cameraX = Math.round(-(canvas.width - levelPixelWidth) / 2);
    }
    
    // Handle Y axis (vertical) - account for status bar
    if (levelPixelHeight > playableHeight) {
        // Level is taller than playable area - follow player
        const desiredCameraY = playerPos.y * tileSize + tileSize / 2 - halfPlayableHeight - STATUS_BAR_HEIGHT;
        cameraY = Math.round(Math.max(-STATUS_BAR_HEIGHT, Math.min(levelPixelHeight - canvas.height, desiredCameraY)));
    } else {
        // Level fits vertically - keep centered in playable area (match offset mode behavior)
        cameraY = Math.round(-((playableHeight - levelPixelHeight) / 2 + STATUS_BAR_HEIGHT));
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
    
    // Draw industrial-style text title
    context.save();
    context.textAlign = "center";
    
    // Detect device orientation and adjust sizing accordingly
    const isMobilePortrait = canvas.height > canvas.width && canvas.width < 768;
    const isMobileLandscape = canvas.width > canvas.height && canvas.height < 600;
    const aspectRatio = canvas.height / canvas.width;
    
    // Calculate responsive font sizes with different scaling for each mode
    let baseSize;
    if (isMobilePortrait) {
        // More moderate size increase for mobile portrait
        baseSize = Math.min(canvas.width / 10, canvas.height / 25);
    } else if (isMobileLandscape) {
        // Balanced sizing for mobile landscape - fits everything while using more space
        baseSize = Math.min(canvas.width / 18, canvas.height / 16); // More conservative than /12
    } else {
        // Desktop/large screen sizing
        baseSize = Math.min(canvas.width, canvas.height) / 15;
    }
    
    const smallSize = baseSize * 0.7;
    const largeSize = baseSize * 1.3;
    
    // Starting Y position - more responsive to screen height
    let yPos;
    if (isMobileLandscape) {
        yPos = Math.min(canvas.height * 0.05, 20); // Very close to top for landscape, but not less than 20px
    } else if (isMobilePortrait) {
        yPos = Math.min(canvas.height * 0.06, 30); // Closer to top for portrait, ensuring content fits
    } else {
        yPos = Math.min(canvas.height * 0.08, 40); // Desktop - closer to top to allow more content below
    }
    
    // Draw cartoon logo image instead of text title
    const logoMaxWidth = isMobileLandscape ? canvas.width * 0.6 : canvas.width * 0.7;
    const logoMaxHeight = isMobileLandscape ? canvas.height * 0.25 : canvas.height * 0.3;
    
    // Calculate logo size maintaining aspect ratio
    const logoAspectRatio = cartoonLogo.width / cartoonLogo.height;
    let logoWidth, logoHeight;
    
    if (logoMaxWidth / logoAspectRatio <= logoMaxHeight) {
        logoWidth = logoMaxWidth;
        logoHeight = logoMaxWidth / logoAspectRatio;
    } else {
        logoHeight = logoMaxHeight;
        logoWidth = logoMaxHeight * logoAspectRatio;
    }
    
    // Center the logo
    const logoX = (canvas.width - logoWidth) / 2;
    const logoY = yPos;
    
    // Apply same high-quality rendering settings as push/move icons
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(cartoonLogo, logoX, logoY, logoWidth, logoHeight);
    context.restore();
    
    // Update yPos to be after the logo
    yPos = logoY + logoHeight;
    
    // Add spacing after logo - more responsive to screen height
    const availableHeight = canvas.height - (logoY + logoHeight);
    const spacingRatio = Math.min(0.15, availableHeight / (canvas.height * 8)); // Adaptive spacing
    
    if (isMobileLandscape) {
        yPos += logoHeight * Math.max(0.08, spacingRatio); // Tighter spacing for landscape
    } else {
        yPos += logoHeight * Math.max(0.12, spacingRatio * 1.5); // Normal spacing but responsive
    }
    
    // Instructions and info text - adjust size for mobile landscape
    let textSize;
    if (isMobilePortrait) {
        textSize = baseSize * 0.5;
    } else if (isMobileLandscape) {
        textSize = baseSize * 0.5; // Balanced size for landscape
    } else {
        textSize = baseSize * 0.4; // Original size for desktop/landscape
    }
    const lineHeight = textSize * 1.3; // Slightly tighter but not too compressed
    
    // Main instruction - larger and responsive with wrapping
    yPos += lineHeight * (isMobileLandscape ? 1.2 : 1.5); // Slightly reduced spacing for landscape
    let mainInstructionSize;
    if (isMobilePortrait) {
        mainInstructionSize = textSize * 1.3;
    } else if (isMobileLandscape) {
        mainInstructionSize = textSize * 1.25; // Moderate increase for landscape
    } else {
        mainInstructionSize = textSize * 1.3; // Original size for desktop
    }
    context.font = `400 ${mainInstructionSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#DDDDDD";
    const maxTextWidth = logoWidth; // Match the cartoon logo width exactly
    const mainInstructionLineHeight = mainInstructionSize * 1.4;
    yPos = drawWrappedText(context, "Complete your shift by pushing all the crates into their designated positions before escaping to the pub!", canvas.width / 2, yPos, maxTextWidth, mainInstructionLineHeight);

    // Demo level preview - positioned after main instruction with responsive spacing
    const remainingHeight = canvas.height - yPos;
    const demoSpacingRatio = Math.min(2, remainingHeight / (canvas.height * 2)); // Adaptive spacing
    yPos += lineHeight * (isMobileLandscape ? Math.max(1.2, demoSpacingRatio * 0.8) : Math.max(1.5, demoSpacingRatio));
    
    // Calculate demo tile size with pixel-perfect scaling to avoid artifacts
    let baseDemoTileSize;
    if (isMobilePortrait) {
        baseDemoTileSize = Math.min(canvas.width / 15, 40);
    } else if (isMobileLandscape) {
        baseDemoTileSize = Math.min(canvas.width / 20, 28); // Moderate size for landscape
    } else {
        baseDemoTileSize = Math.min(canvas.width / 20, 32); // Original size for desktop
    }
    
    // Ensure tile size is an integer for pixel-perfect rendering
    const demoTileSize = Math.floor(baseDemoTileSize);
    
    const demoWidth = 7; // 7 tiles wide
    const demoHeight = 3; // 3 tiles high
    
    // Pixel-align the demo level position
    const demoStartX = Math.floor((canvas.width - (demoWidth * demoTileSize)) / 2);
    const demoStartY = Math.floor(yPos);
    
    // Draw demo level tiles with pixel-perfect positioning
    for (let y = 0; y < demoHeight; y++) {
        for (let x = 0; x < demoWidth; x++) {
            // Ensure pixel-aligned tile positions
            const tileX = Math.floor(demoStartX + x * demoTileSize);
            const tileY = Math.floor(demoStartY + y * demoTileSize);
            
            if (y === 0 || y === 2 || x === 0 || x === 6) {
                // Wall tiles - same as main game
                const sprite = textureAtlas.frames["block_05.png"];
                context.drawImage(
                    spriteSheet,
                    sprite.x, sprite.y, sprite.width, sprite.height,
                    tileX, tileY, demoTileSize, demoTileSize
                );
            } else if (y === 1) {
                // Floor corridor - same as main game
                const sprite = textureAtlas.frames["ground_05.png"];
                context.drawImage(
                    spriteSheet,
                    sprite.x, sprite.y, sprite.width, sprite.height,
                    tileX, tileY, demoTileSize, demoTileSize
                );
                
                // Add game elements
                if (x === 1) {
                    // Player - use default player sprite (same as main game fallback)
                    const playerSprite = textureAtlas.frames["player_03.png"];
                    context.drawImage(
                        spriteSheet,
                        playerSprite.x, playerSprite.y, playerSprite.width, playerSprite.height,
                        tileX, tileY, demoTileSize, demoTileSize
                    );
                } else if (x === 3) {
                    // Crate - use normal crate sprite (same as main game)
                    const crateSprite = textureAtlas.frames["crate_11.png"];
                    context.drawImage(
                        spriteSheet,
                        crateSprite.x, crateSprite.y, crateSprite.width, crateSprite.height,
                        tileX, tileY, demoTileSize, demoTileSize
                    );
                } else if (x === 5) {
                    // Goal tile - same as main game (floor + goal sprite with margin)
                    const goalSprite = textureAtlas.frames["environment_06.png"];
                    const goalMargin = Math.max(1, Math.floor(demoTileSize / 8)); // Scale margin with tile size
                    const goalSize = Math.floor(demoTileSize - (goalMargin * 2)); // Ensure integer size
                    const goalX = Math.floor(tileX + goalMargin); // Pixel-align goal position
                    const goalY = Math.floor(tileY + goalMargin);
                    context.drawImage(
                        spriteSheet,
                        goalSprite.x, goalSprite.y, goalSprite.width, goalSprite.height,
                        goalX, goalY, goalSize, goalSize
                    );
                }
                
                // Add movement arrows on empty tiles with dramatic manual glow effect
                if (x === 2 || x === 4) {
                    // Draw arrow with bright blue glow for maximum contrast against brown ground
                    const arrowSize = Math.floor(demoTileSize * 0.4);
                    const arrowX = Math.floor(tileX + demoTileSize / 2);
                    const arrowY = Math.floor(tileY + demoTileSize / 2);
                    
                    // Calculate pulsating intensity
                    const time = Date.now() * 0.005;
                    const glowIntensity = 0.5 + 0.5 * Math.sin(time); // 0.5 to 1.0 for brighter baseline
                    
                    // Save context
                    context.save();
                    
                    // Create manual glow effect with bright blue colors for contrast against brown ground
                    const arrowThird = Math.floor(arrowSize / 3);
                    
                    // Draw multiple glow layers from largest to smallest
                    for (let layer = 6; layer >= 0; layer--) {
                        const layerSize = arrowSize + layer * 4; // Each layer 4px larger for bigger glow
                        const layerThird = Math.floor(layerSize / 3);
                        const baseOpacity = glowIntensity * 0.4; // Much higher base opacity
                        
                        if (layer > 4) {
                            // Outer bright blue glow layers - perfect contrast against brown
                            context.fillStyle = `rgba(0, 150, 255, ${baseOpacity / (layer - 2)})`; // Bright blue
                        } else if (layer > 2) {
                            // Middle cyan-blue glow layers - bright and prominent
                            context.fillStyle = `rgba(100, 200, 255, ${baseOpacity / (layer - 1)})`; // Light blue
                        } else if (layer > 0) {
                            // Inner bright cyan layers
                            context.fillStyle = `rgba(200, 230, 255, ${baseOpacity * 1.5})`; // Very light blue
                        } else {
                            // Core very bright white arrow
                            context.fillStyle = `rgba(255, 255, 255, ${0.9 + glowIntensity * 0.1})`; // Almost always bright white
                        }
                        
                        // Draw complete arrow with head and tail
                        const tailWidth = Math.floor(layerThird * 0.6); // Tail is narrower than head
                        const tailLength = Math.floor(layerThird * 1.2); // Tail extends behind
                        
                        context.beginPath();
                        // Arrow head (pointing right)
                        context.moveTo(arrowX - layerThird, arrowY - layerThird); // Top left of head
                        context.lineTo(arrowX + layerThird, arrowY); // Arrow tip
                        context.lineTo(arrowX - layerThird, arrowY + layerThird); // Bottom left of head
                        // Connect to tail
                        context.lineTo(arrowX - layerThird, arrowY + tailWidth); // Top of tail notch
                        context.lineTo(arrowX - layerThird - tailLength, arrowY + tailWidth); // End of top tail
                        context.lineTo(arrowX - layerThird - tailLength, arrowY - tailWidth); // End of bottom tail
                        context.lineTo(arrowX - layerThird, arrowY - tailWidth); // Bottom of tail notch
                        context.closePath();
                        context.fill();
                    }
                    
                    // Restore context
                    context.restore();
                }
            }
        }
    }
    
    // Control instructions - larger and responsive with wrapping
    yPos = demoStartY + (demoHeight * demoTileSize) + lineHeight * (isMobileLandscape ? 1.5 : 2); // Moderate spacing for landscape
    let controlInstructionSize;
    if (isMobilePortrait) {
        controlInstructionSize = textSize * 1.2;
    } else if (isMobileLandscape) {
        controlInstructionSize = textSize * 1.1; // Moderate increase for landscape
    } else {
        controlInstructionSize = textSize * 1.1; // Original size for desktop
    }
    context.font = `400 ${controlInstructionSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#CCCCCC";
    const controlInstructionLineHeight = controlInstructionSize * 1.3;
    
    // Start instruction - positioned after controls with pulsating effect like level complete
    yPos += lineHeight * (isMobileLandscape ? 1.2 : 1.5); // Moderate spacing for landscape
    
    // Instructions with pulsing effect (same as level complete overlay)
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
    const instructColor = `rgba(136, 204, 136, ${pulse})`; // Green with pulsing alpha
    
    let startInstructionSize;
    if (isMobilePortrait) {
        startInstructionSize = textSize * 1.1;
    } else if (isMobileLandscape) {
        startInstructionSize = textSize * 1.05; // Moderate increase for landscape
    } else {
        startInstructionSize = textSize; // Original size for desktop
    }
    
    // Apply pulsating effect with shadow
    context.font = `700 ${startInstructionSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.shadowColor = "#88CC88"; // Green shadow
    context.shadowBlur = 10 * pulse;
    context.fillStyle = instructColor;
    
    // Check if instruction text fits
    let instructText = "SPACE OR TAP TO START";
    let instructWidth = context.measureText(instructText).width;
    if (instructWidth > canvas.width * 0.9) {
        instructText = "TAP TO START";
    }
    
    context.fillText(instructText, canvas.width / 2, yPos);
    context.shadowBlur = 0;
    
    // Author credit - positioned after start instruction with moderate spacing
    yPos += lineHeight * (isMobileLandscape ? 1.8 : 3); // Moderate spacing for landscape
    let authorSize = startInstructionSize; // Same size as start instruction
    if (isMobileLandscape) {
        authorSize = startInstructionSize * 0.95; // Slightly smaller for landscape to ensure it fits
    }
    context.font = `400 ${authorSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#FFCC00"; // Yellow color
    context.fillText("a javascript game by Neil Kendall 2025", canvas.width / 2, yPos);
    
    context.restore();
}

// Helper function to draw text with automatic wrapping
function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lines = [];
    
    // First pass: determine how many lines we need
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
            lines.push(line.trim());
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    
    // Second pass: draw the lines
    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, currentY);
        currentY += lineHeight;
    }
    
    // Return the final Y position for continued layout
    return currentY - lineHeight + (lineHeight * 0.3); // Adjust spacing after text block
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
    
    if (overviewMode) {
        drawOverviewMode();
    } else {
        drawNormalGameplay();
    }
}

function drawOverviewMode() {
    // Save the context state
    context.save();
    
    // Disable image smoothing to prevent scaling artifacts
    context.imageSmoothingEnabled = false;
    
    // Clip the drawing area to exclude the status bar
    context.beginPath();
    context.rect(0, STATUS_BAR_HEIGHT, canvas.width, canvas.height - STATUS_BAR_HEIGHT);
    context.clip();
    
    // Calculate safe tile size for overview to avoid scaling artifacts
    const playableWidth = canvas.width;
    const playableHeight = canvas.height - STATUS_BAR_HEIGHT;
    
    // Define safe tile sizes that avoid scaling artifacts
    const safeTileSizes = [4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
    
    // Calculate max tile size that fits the overview area with padding
    const padding = 20; // Small padding for overview
    const availableWidth = playableWidth - padding;
    const availableHeight = playableHeight - padding;
    
    const maxTileWidth = Math.floor(availableWidth / currentLevel.width);
    const maxTileHeight = Math.floor(availableHeight / currentLevel.height);
    const maxPossibleTileSize = Math.min(maxTileWidth, maxTileHeight);
    
    // Find the largest safe tile size for overview
    let overviewTileSize = 4; // Minimum safe size
    for (let size of safeTileSizes) {
        if (size <= maxPossibleTileSize) {
            overviewTileSize = size;
        } else {
            break;
        }
    }
    
    // Calculate level dimensions with safe tile size
    const levelPixelWidth = currentLevel.width * overviewTileSize;
    const levelPixelHeight = currentLevel.height * overviewTileSize;
    
    // Center the overview (no scaling needed now)
    const overviewOffsetX = Math.round((playableWidth - levelPixelWidth) / 2);
    const overviewOffsetY = Math.round(STATUS_BAR_HEIGHT + (playableHeight - levelPixelHeight) / 2);
    
    // Apply translation only (no scaling)
    context.translate(overviewOffsetX, overviewOffsetY);
    
    // Draw the level grid with the safe overview tile size
    for (let y = 0; y < currentLevel.height; y++) {
        for (let x = 0; x < currentLevel.width; x++) {
            const tileX = x * overviewTileSize;
            const tileY = y * overviewTileSize;
            
            const char = currentLevel.grid[y][x];
            
            // Temporarily set tileSize for drawing functions
            const originalTileSize = tileSize;
            tileSize = overviewTileSize;
            
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
                // Skip drawing static crates and player from grid - we'll draw current positions below
                case '$': // Original crate position (skip)
                case '@': // Original player position (skip)
                case '*': // Original crate on goal (just draw goal)
                case '+': // Original player on goal (just draw goal)
                    if (char === '*' || char === '+') {
                        drawGoalTile(tileX, tileY);
                    }
                    break;
            }
            
            // Restore original tileSize
            tileSize = originalTileSize;
        }
    }
    
    // Temporarily set tileSize for dynamic elements
    const originalTileSize = tileSize;
    tileSize = overviewTileSize;
    
    // Draw boxes at current positions
    currentLevel.boxes.forEach((box, index) => {
        const boxX = box.x * overviewTileSize;
        const boxY = box.y * overviewTileSize;
        const isOnGoal = isBoxOnGoal(index);
        drawBoxTile(boxX, boxY, isOnGoal);
    });
    
    // Draw player at current position  
    const playerX = playerPos.x * overviewTileSize;
    const playerY = playerPos.y * overviewTileSize;
    drawPlayerTile(playerX, playerY);
    
    // Restore original tileSize
    tileSize = originalTileSize;
    
    // Restore the context state
    context.restore();
    
    // Add overview mode visual indicators on top of everything
    // Calculate text dimensions for compact overlay
    context.save();
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? "bold 24px 'Courier New', monospace" : "bold 36px 'Courier New', monospace";
    const subtitleFont = isMobile ? "bold 14px 'Courier New', monospace" : "bold 18px 'Courier New', monospace";
    
    // Measure text to calculate overlay height
    context.font = fontSize;
    const titleMetrics = context.measureText("OVERVIEW MODE");
    context.font = subtitleFont;
    const subtitleMetrics = context.measureText("Click or tap ⊙ to return to game");
    
    const titleHeight = isMobile ? 24 : 36;
    const subtitleHeight = isMobile ? 14 : 18;
    const textSpacing = 10;
    const verticalPadding = 15;
    
    // Calculate compact overlay dimensions
    const overlayHeight = titleHeight + subtitleHeight + textSpacing + (verticalPadding * 2);
    const overlayY = STATUS_BAR_HEIGHT + 10; // Small gap below status bar
    
    // Semi-transparent green overlay - compact size
    context.fillStyle = "rgba(0, 255, 0, 0.15)"; // 15% green tint
    context.fillRect(0, overlayY, canvas.width, overlayHeight);
    
    // Large "OVERVIEW MODE" watermark
    context.font = fontSize;
    context.textAlign = "center";
    context.globalAlpha = 0.7; // Semi-transparent
    
    // Position text in the center of the compact overlay
    const centerX = canvas.width / 2;
    const textCenterY = overlayY + verticalPadding + titleHeight / 2;
    
    // Draw text with green neon effect to match button
    context.shadowColor = "#00ff00";
    context.shadowBlur = 15;
    context.fillStyle = "#00ff00";
    context.fillText("OVERVIEW MODE", centerX, textCenterY);
    
    // Add subtitle
    context.font = subtitleFont;
    context.shadowBlur = 10;
    context.fillText("Click or tap ⊙ to return to game", centerX, textCenterY + titleHeight/2 + textSpacing + subtitleHeight/2);
    
    context.restore();
    
    // Draw status bar on top of everything
    drawStatusBar();
}

function drawNormalGameplay() {
    
    // Save the context state
    context.save();
    
    // Clip the drawing area to exclude the status bar
    context.beginPath();
    context.rect(0, STATUS_BAR_HEIGHT, canvas.width, canvas.height - STATUS_BAR_HEIGHT);
    context.clip();
    
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
    
    // Restore the context state (removes clipping)
    context.restore();
    
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

// Helper function to draw neon text (global scope)
function drawNeonText(text, x, y, color = "#00ffff", glowColor = "#00ffff") {
    // Draw text without glow - just the color
    context.shadowBlur = 0;
    context.fillStyle = color;
    context.fillText(text, x, y);
}

function drawStatusBar() {
    // Draw dark background with subtle gradient
    const gradient = context.createLinearGradient(0, 0, 0, STATUS_BAR_HEIGHT);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.95)");
    gradient.addColorStop(1, "rgba(20, 20, 40, 0.95)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, STATUS_BAR_HEIGHT);
    
    // Draw neon border at bottom of status bar (more subtle)
    context.shadowColor = "#e6cc00";
    context.shadowBlur = 8;
    context.fillStyle = "#e6cc00";
    context.fillRect(0, STATUS_BAR_HEIGHT - 3, canvas.width, 3);
    context.shadowBlur = 0;
    
    // Responsive layout based on screen width
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? "bold 14px 'Courier New', monospace" : "bold 18px 'Courier New', monospace";
    
    // Set text properties
    context.font = fontSize;
    context.textAlign = "left";
    
    // Draw buttons (EXIT, RESTART with attempt count, and optionally OVERVIEW)
    const buttonSize = isMobile ? 35 : 45; // Square buttons for exit and overview
    const restartButtonWidth = isMobile ? 75 : 90; // Wider restart button to fit 3-digit attempt counts
    const buttonSpacing = 8; // Reduced spacing since buttons are smaller
    const rightMargin = 10;
    
    // Calculate number of buttons in status bar (overview button now on playfield)
    const showOverviewButton = levelNeedsPanning || overviewMode; // Show when needed OR when active
    const numButtons = 2; // Only exit and restart buttons in status bar

    // EXIT button (rightmost - primary action)
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    
    // RESTART button (left of EXIT button - secondary action) - wider to fit attempt count
    const restartButtonX = exitButtonX - restartButtonWidth - buttonSpacing;
    const restartButtonY = exitButtonY;
    
    // OVERVIEW button (positioned on playfield overlay, aligned with exit button)
    const overviewButtonX = exitButtonX; // Align horizontally with exit button
    
    // Center vertically on the green overlay when in overview mode
    const titleHeight = isMobile ? 24 : 36;
    const subtitleHeight = isMobile ? 14 : 18;
    const textSpacing = 10;
    const verticalPadding = 15;
    const overlayHeight = titleHeight + subtitleHeight + textSpacing + (verticalPadding * 2);
    const overlayY = STATUS_BAR_HEIGHT + 10;
    const overviewButtonY = overlayY + (overlayHeight / 2) - (buttonSize / 2); // Center on green overlay
    
    const reservedButtonSpace = (buttonSize * 2) + restartButtonWidth + (buttonSpacing * 1) + rightMargin + 20; // Exit + restart buttons only
    
    // Available space for text (excluding button area)
    const availableTextWidth = canvas.width - 30 - reservedButtonSpace; // 15px left + 15px right padding
    
    // New layout: Set name and level number on separate lines, moves/pushes centered with icons
    const setNameText = currentSet;
    const levelNumberText = `Level ${currentLevelNumber}`;
    
    // Use bright yellow for both set name and level number
    const setDisplayText = setNameText; // Remove overview indicator
    const setColor = "#ffff00"; // Bright yellow
    const levelColor = "#ffff00"; // Bright yellow
    
    // Left side: Set name (top) and level number (bottom)
    drawNeonText(setDisplayText, 15, 25, setColor, setColor);
    drawNeonText(levelNumberText, 15, 45, levelColor, levelColor);
    
    // Center area: [move count] [footprint icon] [box icon] [push count]
    // Use true canvas center, not adjusted for button area
    const canvasCenterX = canvas.width / 2;
    
    const iconSize = isMobile ? 30 : 40; // Larger icons to take advantage of status bar height
    const iconSpacing = 8; // Small gap between the two icons
    
    // Detect mobile portrait mode for space optimization
    const isPortrait = canvas.height > canvas.width;
    const isMobilePortrait = isMobile && isPortrait;
    
    // Adjust spacing and font size for mobile portrait to save space
    const numberPadding = isMobilePortrait ? 4 : 12; // Even closer to icons in portrait
    
    // Use smaller font for push/move counts in mobile portrait (match attempt count size)
    const originalFont = context.font;
    if (isMobilePortrait) {
        context.font = "bold 16px 'Courier New', monospace"; // Match attempt count font
    } else {
        context.font = isMobile ? "bold 24px 'Courier New', monospace" : "bold 30px 'Courier New', monospace";
    }
    context.textAlign = "center";
    
    // Measure text widths for perfect positioning
    const moveText = moveCount.toString();
    const pushText = pushCount.toString();
    const moveTextWidth = context.measureText(moveText).width;
    const pushTextWidth = context.measureText(pushText).width;
    
    // Position icons so the center point is between them at canvas center
    const footprintIconX = canvasCenterX - iconSize - iconSpacing / 2;
    const boxIconX = canvasCenterX + iconSpacing / 2;
    const iconY = 30; // Vertically centered in 60px status bar
    
    // Position numbers relative to the icons
    const moveCountX = footprintIconX - numberPadding - moveTextWidth / 2;
    const pushCountX = boxIconX + iconSize + numberPadding + pushTextWidth / 2;
    
    // Draw move count
    drawNeonText(moveText, moveCountX, iconY + 6, "#00aaff", "#00aaff"); // Blue for moves
    
    // Draw push count
    drawNeonText(pushText, pushCountX, iconY + 6, "#00ff00", "#00ff00"); // Green for pushes
    
    // Draw icons at calculated positions with smooth scaling
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(footprintLogo, footprintIconX, iconY - iconSize / 2, iconSize, iconSize);
    context.drawImage(pushLogo, boxIconX, iconY - iconSize / 2, iconSize, iconSize);
    context.restore();
    
    // Restore original font and text alignment
    context.font = originalFont;
    context.textAlign = "left";
    
    // Draw EXIT button (rightmost)
    // Button neon glow background (cyan/blue color)
    context.shadowColor = "#00ccff";
    context.shadowBlur = 12;
    context.fillStyle = "rgba(0, 204, 255, 0.2)";
    context.fillRect(exitButtonX - 5, exitButtonY - 5, buttonSize + 10, buttonSize + 10);
    
    // Button background
    context.shadowBlur = 0;
    context.fillStyle = "rgba(30, 30, 30, 0.9)";
    context.fillRect(exitButtonX, exitButtonY, buttonSize, buttonSize);
    
    // Button neon border
    context.shadowColor = "#00ccff";
    context.shadowBlur = 8;
    context.strokeStyle = "#00ccff";
    context.lineWidth = 2;
    context.strokeRect(exitButtonX, exitButtonY, buttonSize, buttonSize);
    context.shadowBlur = 0;
    
    // Button text with cyan neon - back arrow instead of cross
    context.font = isMobile ? "bold 16px 'Courier New', monospace" : "bold 20px 'Courier New', monospace";
    context.textAlign = "center";
    drawNeonText("◀", exitButtonX + buttonSize / 2, exitButtonY + buttonSize / 2 + 5, "#00ccff", "#00ccff");
    
    // Draw RESTART button (middle)
    // Button neon glow background (orange color)
    context.shadowColor = "#ff6600";
    context.shadowBlur = 12;
    context.fillStyle = "rgba(255, 102, 0, 0.2)";
    context.fillRect(restartButtonX - 5, restartButtonY - 5, restartButtonWidth + 10, buttonSize + 10);
    
    // Button background
    context.shadowBlur = 0;
    context.fillStyle = "rgba(30, 30, 30, 0.9)";
    context.fillRect(restartButtonX, restartButtonY, restartButtonWidth, buttonSize);
    
    // Button neon border
    context.shadowColor = "#ff6600";
    context.shadowBlur = 8;
    context.strokeStyle = "#ff6600";
    context.lineWidth = 2;
    context.strokeRect(restartButtonX, restartButtonY, restartButtonWidth, buttonSize);
    context.shadowBlur = 0;
    
    // Button text with orange neon - restart symbol and attempt count
    context.font = isMobile ? "bold 16px 'Courier New', monospace" : "bold 20px 'Courier New', monospace";
    context.textAlign = "center";
    drawNeonText(`↻ ${attemptCount}`, restartButtonX + restartButtonWidth / 2, restartButtonY + buttonSize / 2 + 5, "#ff6600", "#ff6600");
    
    // Draw OVERVIEW button (leftmost when shown)
    if (showOverviewButton) {
        // Different appearance based on overview mode state (semi-transparent overlay)
        const isActive = overviewMode;
        const glowColor = isActive ? "#00ff00" : "#ff00ff"; // Green when active, magenta when inactive
        const backgroundColor = isActive ? "rgba(0, 255, 0, 0.2)" : "rgba(255, 0, 255, 0.15)"; // More transparent for overlay
        
        // Button neon glow background
        context.shadowColor = glowColor;
        context.shadowBlur = 12;
        context.fillStyle = backgroundColor;
        context.fillRect(overviewButtonX - 5, overviewButtonY - 5, buttonSize + 10, buttonSize + 10);
        
        // Button background (more transparent for overlay)
        context.shadowBlur = 0;
        context.fillStyle = isActive ? "rgba(20, 40, 20, 0.7)" : "rgba(30, 30, 30, 0.7)";
        context.fillRect(overviewButtonX, overviewButtonY, buttonSize, buttonSize);
        
        // Button neon border
        context.shadowColor = glowColor;
        context.shadowBlur = 8;
        context.strokeStyle = glowColor;
        context.lineWidth = 2;
        context.strokeRect(overviewButtonX, overviewButtonY, buttonSize, buttonSize);
        context.shadowBlur = 0;
        
        // Button text with appropriate neon color
        context.font = isMobile ? "bold 16px 'Courier New', monospace" : "bold 20px 'Courier New', monospace";
        context.textAlign = "center";
        drawNeonText("⊙", overviewButtonX + buttonSize / 2, overviewButtonY + buttonSize / 2 + 5, glowColor, glowColor);
    }
    
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
    const statsText = `COMPLETED IN ${moveCount} MOVES, ${pushCount} PUSHES (ATTEMPT ${attemptCount})`;
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

async function exitToLevelSelect() {
    await loadLevelProgress(); // Refresh progress data first
    currentGameState = GAME_STATES.LEVEL_SELECT; // Then change state
    
    // Debug: Check the specific level that was just played
    const currentLevelKey = `${currentSet}_${currentLevelNumber}`;
    const currentProgress = levelProgress.get(currentLevelKey);
    console.log(`DEBUG: Exited from ${currentLevelKey}, progress:`, currentProgress);
}
// #endregion

// #region Level Selection System
function initializeLevelSelect() {
    // Get the first set name from levels.js instead of hardcoding
    const setNames = Object.keys(SOKOBAN_LEVELS);
    
    // Only reset to first set if we don't have a last played level
    if (!hasLastPlayedLevel) {
        selectedSet = setNames[0]; // First set in the data
        currentLevelPage = 0;
    }
    // If we have a last played level, selectedSet is already set correctly
    
    selectedLevel = 0; // No level selected initially
    calculateGridLayout();
}

function calculateGridLayout() {
    const isMobile = canvas.width < 600;
    const isTablet = canvas.width >= 600 && canvas.width < 1024;
    const isDesktop = canvas.width >= 1024;
    
    const buttonSize = isMobile ? 35 : 45; // Same size as exit button
    const buttonSpacing = 8;
    
    // Available area for the grid (leave space for header, set selector, and navigation)
    const headerHeight = canvas.height * 0.35; // Top 35% for title and set selector
    const footerHeight = canvas.height * 0.15; // Bottom 15% for navigation and instructions
    const availableHeight = canvas.height - headerHeight - footerHeight;
    const availableWidth = canvas.width - 40; // 20px margin on each side
    
    // Calculate how many buttons could fit horizontally
    const maxPossibleColumns = Math.floor(availableWidth / (buttonSize + buttonSpacing));
    
    // Set reasonable column limits based on screen size
    let maxColumns;
    if (isMobile) {
        maxColumns = maxPossibleColumns; // Use all available space on mobile
    } else if (isTablet) {
        maxColumns = Math.min(maxPossibleColumns, 12); // Max 12 columns on tablet
    } else { // Desktop
        maxColumns = Math.min(maxPossibleColumns, 10); // Max 10 columns on desktop for better UX
    }
    
    // Calculate rows
    gridColumns = Math.max(1, maxColumns);
    gridRows = Math.max(1, Math.floor(availableHeight / (buttonSize + buttonSpacing)));
    
    levelsPerPage = gridColumns * gridRows;
    
    // Adjust current page if it's out of bounds
    const maxLevel = getLevelCount(selectedSet);
    const maxPages = Math.ceil(maxLevel / levelsPerPage);
    currentLevelPage = Math.min(currentLevelPage, maxPages - 1);
}

function drawLevelSelectScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate grid layout first
    calculateGridLayout();
    
    // If this is the first time showing the level selector and we have a last played level,
    // calculate the correct page to show that level
    if (!pageCalculatedForLastPlayed && hasLastPlayedLevel && selectedSet === currentSet) {
        currentLevelPage = Math.floor((currentLevelNumber - 1) / levelsPerPage);
        pageCalculatedForLastPlayed = true;
        console.log(`Calculated page ${currentLevelPage} for last played level ${currentLevelNumber} in set ${selectedSet}`);
    }
    
    const centerX = canvas.width / 2;
    const isMobile = canvas.width < 600;
    const titleFontSize = isMobile ? 28 : 36;
    const fontSize = isMobile ? 16 : 20;
    
    // Calculate layout areas
    const headerHeight = canvas.height * 0.18; // Reduced even further for tighter layout
    const footerHeight = canvas.height * 0.15;
    const gridAreaHeight = canvas.height - headerHeight - footerHeight;
    
    // Title - moved slightly lower to avoid conflict with back button
    context.font = `bold ${titleFontSize}px 'Courier New', monospace`;
    context.fillStyle = "#00ffff";
    context.textAlign = "center";
    context.fillText("SELECT LEVEL", centerX, headerHeight * 0.35);
    
    // Set selector - moved further down to avoid overlap with title on landscape screens
    const setY = headerHeight * 0.85;
    const buttonWidth = isMobile ? 30 : 35; // Match page navigation button size
    const buttonHeight = isMobile ? 30 : 35; // Match page navigation button size
    const indicatorWidth = isMobile ? 200 : 250;
    const indicatorHeight = isMobile ? 40 : 50;
    
    drawSelector("", selectedSet, centerX, setY, buttonWidth, buttonHeight, indicatorWidth, indicatorHeight, 'set', fontSize);
    
    // Draw level grid
    drawLevelGrid(headerHeight, gridAreaHeight);
    
    // Draw page navigation if needed
    const maxLevel = getLevelCount(selectedSet);
    const maxPages = Math.ceil(maxLevel / levelsPerPage);
    if (maxPages > 1) {
        drawPageNavigation(headerHeight + gridAreaHeight + 20, maxPages);
    }

    // Draw back button (same as exit button in gameplay)
    const buttonSize = isMobile ? 35 : 45; // Same size as gameplay exit button
    const exitButtonX = canvas.width - buttonSize - 10;
    const exitButtonY = isMobile ? 15 : 10; // Match gameplay positioning exactly
    
    // Button neon glow background (cyan/blue color)
    context.shadowColor = "#00ccff";
    context.shadowBlur = 12;
    context.fillStyle = "rgba(0, 204, 255, 0.2)";
    context.fillRect(exitButtonX - 5, exitButtonY - 5, buttonSize + 10, buttonSize + 10);
    
    // Button background
    context.shadowBlur = 0;
    context.fillStyle = "rgba(30, 30, 30, 0.9)";
    context.fillRect(exitButtonX, exitButtonY, buttonSize, buttonSize);
    
    // Button neon border
    context.shadowColor = "#00ccff";
    context.shadowBlur = 8;
    context.strokeStyle = "#00ccff";
    context.lineWidth = 2;
    context.strokeRect(exitButtonX, exitButtonY, buttonSize, buttonSize);
    context.shadowBlur = 0;
    
    // Button text with cyan neon - back arrow
    context.font = isMobile ? "bold 16px 'Courier New', monospace" : "bold 20px 'Courier New', monospace";
    context.textAlign = "center";
    drawNeonText("◀", exitButtonX + buttonSize / 2, exitButtonY + buttonSize / 2 + 5, "#00ccff", "#00ccff");

    context.textAlign = "left";
}

function drawLevelGrid(gridStartY, gridAreaHeight) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45;
    const buttonSpacing = 8;
    const fontSize = isMobile ? 14 : 16;
    
    const maxLevel = getLevelCount(selectedSet);
    const startLevel = currentLevelPage * levelsPerPage + 1;
    const endLevel = Math.min(startLevel + levelsPerPage - 1, maxLevel);
    
    // Center the grid in the available area
    const gridWidth = gridColumns * (buttonSize + buttonSpacing) - buttonSpacing;
    const gridHeight = gridRows * (buttonSize + buttonSpacing) - buttonSpacing;
    const gridStartX = (canvas.width - gridWidth) / 2;
    const centeredGridStartY = gridStartY + (gridAreaHeight - gridHeight) / 2;
    
    let levelNumber = startLevel;
    
    for (let row = 0; row < gridRows && levelNumber <= endLevel; row++) {
        for (let col = 0; col < gridColumns && levelNumber <= endLevel; col++) {
            const x = gridStartX + col * (buttonSize + buttonSpacing);
            const y = centeredGridStartY + row * (buttonSize + buttonSpacing);
            
            drawLevelButton(x, y, buttonSize, levelNumber, fontSize);
            levelNumber++;
        }
    }
}

function drawLevelButton(x, y, size, levelNumber, fontSize) {
    const progressStatus = getLevelProgressStatus(selectedSet, levelNumber);
    
    // Determine colors based on progress status only
    let backgroundColor, borderColor, textColor;
    
    switch (progressStatus) {
        case 'completed':
            // Green for completed levels
            backgroundColor = "rgba(0, 255, 0, 0.2)";
            borderColor = "#00ff00";
            textColor = "#00ff00";
            break;
        case 'attempted':
            // Amber for attempted but not completed
            backgroundColor = "rgba(255, 191, 0, 0.2)";
            borderColor = "#ffbf00";
            textColor = "#ffbf00";
            break;
        case 'never_played':
        default:
            // Blue for never played (default)
            backgroundColor = "rgba(0, 204, 255, 0.2)";
            borderColor = "#00ccff";
            textColor = "#00ccff";
            break;
    }
    
    // Button background
    context.fillStyle = backgroundColor;
    context.fillRect(x, y, size, size);
    
    // Button border
    context.strokeStyle = borderColor;
    context.lineWidth = 2;
    context.strokeRect(x, y, size, size);
    
    // Button text (level number)
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = textColor;
    context.textAlign = "center";
    context.fillText(levelNumber.toString(), x + size / 2, y + size / 2 + fontSize / 3);
}

function drawPageNavigation(navY, maxPages) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 30 : 35;
    const fontSize = isMobile ? 16 : 20; // Use same font size as main UI elements
    const centerX = canvas.width / 2;
    
    // Page info text
    context.font = `${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText(`Page ${currentLevelPage + 1} of ${maxPages}`, centerX, navY);
    
    // Calculate button positions on same line as text
    const buttonY = navY - buttonSize / 2 - fontSize / 3; // Align with text baseline
    const spacing = 80; // Increased distance from center to buttons
    
    // Previous page button (left of text)
    if (currentLevelPage > 0) {
        const prevX = centerX - spacing - buttonSize;
        context.fillStyle = "rgba(255, 255, 255, 0.2)";
        context.fillRect(prevX, buttonY, buttonSize, buttonSize);
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.strokeRect(prevX, buttonY, buttonSize, buttonSize);
        context.fillStyle = "#ffffff";
        context.font = `bold ${fontSize}px 'Courier New', monospace`;
        context.textAlign = "center";
        context.fillText("◀", prevX + buttonSize / 2, buttonY + buttonSize / 2 + fontSize / 3);
    }
    
    // Next page button (right of text)
    if (currentLevelPage < maxPages - 1) {
        const nextX = centerX + spacing;
        context.fillStyle = "rgba(255, 255, 255, 0.2)";
        context.fillRect(nextX, buttonY, buttonSize, buttonSize);
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.strokeRect(nextX, buttonY, buttonSize, buttonSize);
        context.fillStyle = "#ffffff";
        context.font = `bold ${fontSize}px 'Courier New', monospace`;
        context.textAlign = "center";
        context.fillText("▶", nextX + buttonSize / 2, buttonY + buttonSize / 2 + fontSize / 3);
    }
}

function drawSelector(label, value, centerX, y, buttonWidth, buttonHeight, indicatorWidth, indicatorHeight, type, fontSize) {
    // Label - positioned above the indicator box with more spacing
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText(label, centerX, y - 35);
    
    // Indicator box position
    const indicatorY = y - indicatorHeight / 2;
    
    // Button Y position - centered with the indicator box
    const buttonY = indicatorY + (indicatorHeight - buttonHeight) / 2;
    
    // Left arrow button - updated to match page navigation style
    const leftButtonX = centerX - indicatorWidth / 2 - buttonWidth - 10;
    
    // Left button background
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.fillRect(leftButtonX, buttonY, buttonWidth, buttonHeight);
    
    // Left button border
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(leftButtonX, buttonY, buttonWidth, buttonHeight);
    
    // Left arrow text - centered in button
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText("◀", leftButtonX + buttonWidth / 2, buttonY + buttonHeight / 2 + fontSize / 3);
    
    // Right arrow button - updated to match page navigation style
    const rightButtonX = centerX + indicatorWidth / 2 + 10;
    
    // Right button background
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.fillRect(rightButtonX, buttonY, buttonWidth, buttonHeight);
    
    // Right button border
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.strokeRect(rightButtonX, buttonY, buttonWidth, buttonHeight);
    
    // Right arrow text - centered in button
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText("▶", rightButtonX + buttonWidth / 2, buttonY + buttonHeight / 2 + fontSize / 3);
    
    // Value indicator background
    const indicatorX = centerX - indicatorWidth / 2;
    context.fillStyle = "rgba(255, 221, 0, 0.2)";
    context.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);
    
    // Value indicator border
    context.strokeStyle = "#ffdd00";
    context.lineWidth = 2;
    context.strokeRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);
    
    // Value text - centered in indicator box
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffdd00";
    context.fillText(value, centerX, indicatorY + indicatorHeight / 2 + 6);
    
    // Store button positions for click detection
    if (!window.levelSelectButtons) window.levelSelectButtons = {};
    window.levelSelectButtons[type] = {
        left: { x: leftButtonX, y: buttonY, width: buttonWidth, height: buttonHeight },
        right: { x: rightButtonX, y: buttonY, width: buttonWidth, height: buttonHeight }
    };
    
    // Store start button position
    if (type === 'level') { // Only store once
        const isMobile = canvas.width < 600;
        const isLandscape = canvas.width > canvas.height;
        const availableHeight = canvas.height;
        const startButtonY = isLandscape && isMobile ? availableHeight * 0.60 : availableHeight * 0.72;
        const startButtonWidth = isMobile ? 200 : 250;
        const startButtonHeight = isMobile ? 50 : 60;
        const startButtonX = canvas.width / 2 - startButtonWidth / 2;
        
        window.levelSelectButtons.start = {
            x: startButtonX, y: startButtonY, width: startButtonWidth, height: startButtonHeight
        };
    }
}

function handleLevelSelectInput(key) {
    switch (key) {
        case 'ArrowLeft':
            // Change to previous set
            handleLevelSelectLeft();
            break;
        case 'ArrowRight':
            // Change to next set
            handleLevelSelectRight();
            break;
        case 'ArrowUp':
            // Previous page
            if (currentLevelPage > 0) {
                currentLevelPage--;
            }
            break;
        case 'ArrowDown':
            // Next page
            const maxLevel = getLevelCount(selectedSet);
            const maxPages = Math.ceil(maxLevel / levelsPerPage);
            if (currentLevelPage < maxPages - 1) {
                currentLevelPage++;
            }
            break;
        case ' ':
            // Start level 1 if no level is selected, otherwise start selected level
            const levelToStart = selectedLevel > 0 ? selectedLevel : 1;
            currentSet = selectedSet;
            currentLevelNumber = levelToStart;
            loadLevel(currentSet, currentLevelNumber);
            currentGameState = GAME_STATES.PLAYING;
            lastInputType = "Game Started!";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            break;
        case 'Escape':
            // Back button behavior: level select goes to title
            currentGameState = GAME_STATES.TITLE;
            break;
    }
}

function handleLevelSelectLeft() {
    // Always cycle through sets when using left/right arrows on keyboard
    // or when tapping on the set line
    const setNames = Object.keys(SOKOBAN_LEVELS);
    const currentSetIndex = setNames.indexOf(selectedSet);
    
    if (currentSetIndex > 0) {
        selectedSet = setNames[currentSetIndex - 1];
        selectedLevel = 0; // No level selected when changing sets
    } else {
        // Wrap around to last set
        selectedSet = setNames[setNames.length - 1];
        selectedLevel = 0;
    }
    currentLevelPage = 0; // Reset to first page
    calculateGridLayout(); // Recalculate for new set
}

function handleLevelSelectRight() {
    // Always cycle through sets when using left/right arrows on keyboard
    // or when tapping on the set line  
    const setNames = Object.keys(SOKOBAN_LEVELS);
    const currentSetIndex = setNames.indexOf(selectedSet);
    
    if (currentSetIndex < setNames.length - 1) {
        selectedSet = setNames[currentSetIndex + 1];
        selectedLevel = 0; // No level selected when changing sets
    } else {
        // Wrap around to first set
        selectedSet = setNames[0];
        selectedLevel = 0;
    }
    currentLevelPage = 0; // Reset to first page
    calculateGridLayout(); // Recalculate for new set
}

function handleLevelSelectUp() {
    if (selectedLevel > 1) {
        selectedLevel--;
    } else {
        // Wrap to max level
        const maxLevel = getLevelCount(selectedSet);
        selectedLevel = maxLevel;
    }
}

function handleLevelSelectDown() {
    const maxLevel = getLevelCount(selectedSet);
    if (selectedLevel < maxLevel) {
        selectedLevel++;
    } else {
        // Wrap to level 1
        selectedLevel = 1;
    }
}

function handleLevelSelectClick(x, y) {
    // Check back button click (same position as exit button in gameplay)
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45;
    const exitButtonX = canvas.width - buttonSize - 10;
    const exitButtonY = 10;
    
    if (x >= exitButtonX && x <= exitButtonX + buttonSize &&
        y >= exitButtonY && y <= exitButtonY + buttonSize) {
        // Go back to title screen
        currentGameState = GAME_STATES.TITLE;
        return;
    }

    // Check set navigation buttons (if they exist from the old system)
    if (window.levelSelectButtons && window.levelSelectButtons.set) {
        const leftBtn = window.levelSelectButtons.set.left;
        const rightBtn = window.levelSelectButtons.set.right;
        
        // Left set button
        if (x >= leftBtn.x && x <= leftBtn.x + leftBtn.width &&
            y >= leftBtn.y && y <= leftBtn.y + leftBtn.height) {
            const sets = Object.keys(SOKOBAN_LEVELS);
            const currentIndex = sets.indexOf(selectedSet);
            selectedSet = sets[(currentIndex - 1 + sets.length) % sets.length];
            selectedLevel = 0; // No level selected when changing sets
            currentLevelPage = 0; // Reset to first page
            calculateGridLayout(); // Recalculate for new set
            return;
        }
        
        // Right set button
        if (x >= rightBtn.x && x <= rightBtn.x + rightBtn.width &&
            y >= rightBtn.y && y <= rightBtn.y + rightBtn.height) {
            const sets = Object.keys(SOKOBAN_LEVELS);
            const currentIndex = sets.indexOf(selectedSet);
            selectedSet = sets[(currentIndex + 1) % sets.length];
            selectedLevel = 0; // No level selected when changing sets
            currentLevelPage = 0; // Reset to first page
            calculateGridLayout(); // Recalculate for new set
            return;
        }
    }
    
    // Check level grid buttons
    if (isClickOnLevelGrid(x, y)) {
        return;
    }
    
    // Check page navigation buttons
    if (isClickOnPageNavigation(x, y)) {
        return;
    }
}

function isClickOnLevelGrid(x, y) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45;
    const buttonSpacing = 8;
    
    const headerHeight = canvas.height * 0.18; // Updated to match current layout
    const footerHeight = canvas.height * 0.15;
    const gridAreaHeight = canvas.height - headerHeight - footerHeight;
    
    const maxLevel = getLevelCount(selectedSet);
    const startLevel = currentLevelPage * levelsPerPage + 1;
    const endLevel = Math.min(startLevel + levelsPerPage - 1, maxLevel);
    
    // Center the grid in the available area
    const gridWidth = gridColumns * (buttonSize + buttonSpacing) - buttonSpacing;
    const gridHeight = gridRows * (buttonSize + buttonSpacing) - buttonSpacing;
    const gridStartX = (canvas.width - gridWidth) / 2;
    const centeredGridStartY = headerHeight + (gridAreaHeight - gridHeight) / 2;
    
    let levelNumber = startLevel;
    
    for (let row = 0; row < gridRows && levelNumber <= endLevel; row++) {
        for (let col = 0; col < gridColumns && levelNumber <= endLevel; col++) {
            const buttonX = gridStartX + col * (buttonSize + buttonSpacing);
            const buttonY = centeredGridStartY + row * (buttonSize + buttonSpacing);
            
            // Check if click is on this button
            if (x >= buttonX && x <= buttonX + buttonSize &&
                y >= buttonY && y <= buttonY + buttonSize) {
                // Start the clicked level
                selectedLevel = levelNumber;
                currentSet = selectedSet;
                currentLevelNumber = selectedLevel;
                loadLevel(currentSet, currentLevelNumber);
                currentGameState = GAME_STATES.PLAYING;
                lastInputType = "Game Started!";
                lastInputTime = Date.now();
                inputFadeTimer = 2000;
                return true;
            }
            levelNumber++;
        }
    }
    return false;
}

function isClickOnPageNavigation(x, y) {
    const maxLevel = getLevelCount(selectedSet);
    const maxPages = Math.ceil(maxLevel / levelsPerPage);
    
    if (maxPages <= 1) return false; // No pagination needed
    
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 30 : 35;
    const fontSize = isMobile ? 16 : 20;
    const headerHeight = canvas.height * 0.18; // Updated to match current layout
    const footerHeight = canvas.height * 0.15;
    const gridAreaHeight = canvas.height - headerHeight - footerHeight;
    const navY = headerHeight + gridAreaHeight + 20;
    const centerX = canvas.width / 2;
    
    // Calculate button positions matching drawPageNavigation
    const buttonY = navY - buttonSize / 2 - fontSize / 3;
    const spacing = 80; // Same as in drawPageNavigation
    
    // Previous page button (left of text)
    if (currentLevelPage > 0) {
        const prevX = centerX - spacing - buttonSize;
        if (x >= prevX && x <= prevX + buttonSize &&
            y >= buttonY && y <= buttonY + buttonSize) {
            currentLevelPage--;
            return true;
        }
    }
    
    // Next page button (right of text)
    if (currentLevelPage < maxPages - 1) {
        const nextX = centerX + spacing;
        if (x >= nextX && x <= nextX + buttonSize &&
            y >= buttonY && y <= buttonY + buttonSize) {
            currentLevelPage++;
            return true;
        }
    }
    
    return false;
}

function startSelectedLevel() {
    if (levelSelectOption === 'start') {
        // Start from beginning - reset to first level
        currentSet = Object.keys(SOKOBAN_LEVELS)[0];
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
    
    // Recalculate grid layout if in level select mode
    if (currentGameState === GAME_STATES.LEVEL_SELECT) {
        calculateGridLayout();
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
    levelNeedsPanning = levelPixelWidth > canvas.width || levelPixelHeight > canvas.height;
    
    if (levelNeedsPanning) {
        const halfScreenWidth = canvas.width / 2;
        const playableHeight = canvas.height - STATUS_BAR_HEIGHT;
        const halfPlayableHeight = playableHeight / 2;
        
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
        
        // Handle Y axis (vertical) - account for status bar
        if (levelPixelHeight > playableHeight) {
            console.log(`Level is taller than playable area: levelPixelHeight=${levelPixelHeight}, playableHeight=${playableHeight}`);
            // Level is taller than playable area - center player in visible game area
            const desiredCameraY = playerPos.y * tileSize + tileSize / 2 - halfPlayableHeight - STATUS_BAR_HEIGHT;
            cameraY = Math.round(Math.max(-STATUS_BAR_HEIGHT, Math.min(
                levelPixelHeight - canvas.height,
                desiredCameraY
            )));
        } else {
            console.log(`Level fits vertically: levelPixelHeight=${levelPixelHeight}, playableHeight=${playableHeight}`);
            // Level fits vertically - center it in playable area (match offset mode behavior)
            // Offset mode: levelOffsetY = (playableHeight - levelPixelHeight) / 2 + STATUS_BAR_HEIGHT
            // Camera mode: need to negate this since camera position is subtracted from render positions
            cameraY = Math.round(-((playableHeight - levelPixelHeight) / 2 + STATUS_BAR_HEIGHT));
            console.log(`recalculateLevelLayout: Camera mode vertical centering: cameraY=${cameraY}, playableHeight=${playableHeight}, levelPixelHeight=${levelPixelHeight}`);
        }
    } else {
        // No panning needed, reset camera and use level centering
        cameraX = 0;
        cameraY = 0;
        
        // Recalculate level centering offsets for smaller levels
        levelOffsetX = Math.floor((canvas.width - currentLevel.width * tileSize) / 2);
        levelOffsetY = Math.floor((canvas.height - STATUS_BAR_HEIGHT - currentLevel.height * tileSize) / 2) + STATUS_BAR_HEIGHT;
    }
    
    console.log(`DEBUG-B: Screen resized - New tile size: ${tileSize}px, Panning: ${levelNeedsPanning}, Camera: (${cameraX}, ${cameraY})`);
}
function getMouseClickPosition(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    mouseX = Math.round(x / scale);
    mouseY = Math.round(y / scale);
}

// #region Progress Tracking with IndexedDB

async function initProgressDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CrateEscapeProgress', 3); // Increment version for enhanced progress tracking
        
        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            resolve(null); // Continue without progress tracking if DB fails
        };
        
        request.onsuccess = () => {
            progressDB = request.result;
            console.log('Progress database initialized');
            resolve(progressDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store for level progress
            if (!db.objectStoreNames.contains('levelProgress')) {
                const store = db.createObjectStore('levelProgress', { keyPath: 'id' });
                store.createIndex('setName', 'setName', { unique: false });
                store.createIndex('levelNumber', 'levelNumber', { unique: false });
            }
            
            // Create object store for last played level
            if (!db.objectStoreNames.contains('lastPlayed')) {
                const lastPlayedStore = db.createObjectStore('lastPlayed', { keyPath: 'id' });
            }
        };
    });
}

async function loadLevelProgress() {
    if (!progressDB) return;
    
    try {
        const transaction = progressDB.transaction(['levelProgress'], 'readonly');
        const store = transaction.objectStore('levelProgress');
        const request = store.getAll();
        
        request.onsuccess = () => {
            levelProgress.clear();
            request.result.forEach(record => {
                const key = `${record.setName}_${record.levelNumber}`;
                levelProgress.set(key, {
                    attempted: record.attempted,
                    completed: record.completed
                });
            });
            console.log(`Loaded progress for ${levelProgress.size} levels`);
        };
    } catch (error) {
        console.error('Error loading level progress:', error);
    }
}

async function saveLevelProgress(setName, levelNumber, attempted, completed, moves = null, pushes = null) {
    if (!progressDB) return;
    
    const key = `${setName}_${levelNumber}`;
    const id = key; // Use the key as the ID for IndexedDB
    
    try {
        const transaction = progressDB.transaction(['levelProgress'], 'readwrite');
        const store = transaction.objectStore('levelProgress');
        
        // Get existing record to preserve best scores
        const existingRequest = store.get(id);
        const existing = await new Promise((resolve) => {
            existingRequest.onsuccess = () => resolve(existingRequest.result);
            existingRequest.onerror = () => resolve(null);
        });
        
        // Calculate best scores
        let bestMoves = existing?.bestMoves || null;
        let bestPushes = existing?.bestPushes || null;
        let completionCount = existing?.completionCount || 0;
        
        // If completing the level, update best scores and increment completion count
        if (completed && moves !== null && pushes !== null) {
            // Update best moves if this is better (or first completion)
            if (bestMoves === null || moves < bestMoves) {
                bestMoves = moves;
            }
            
            // Update best pushes if this is better (or first completion)
            if (bestPushes === null || pushes < bestPushes) {
                bestPushes = pushes;
            }
            
            // Increment completion count
            completionCount++;
        }
        
        const record = {
            id: id,
            setName: setName,
            levelNumber: levelNumber,
            attempted: attempted,
            completed: completed,
            bestMoves: bestMoves,
            bestPushes: bestPushes,
            completionCount: completionCount,
            lastPlayed: new Date().toISOString(),
            lastCompletionDate: completed ? new Date().toISOString() : (existing?.lastCompletionDate || null)
        };
        
        await store.put(record);
        
        // Update local cache with enhanced data
        levelProgress.set(key, { 
            attempted, 
            completed, 
            bestMoves, 
            bestPushes, 
            completionCount 
        });
        
        if (completed && moves !== null && pushes !== null) {
            console.log(`Level completed: ${setName} Level ${levelNumber} - Moves: ${moves}, Pushes: ${pushes} (Best: ${bestMoves}/${bestPushes})`);
        } else {
            console.log(`Saved progress: ${setName} Level ${levelNumber} - Attempted: ${attempted}, Completed: ${completed}`);
        }
    } catch (error) {
        console.error('Error saving level progress:', error);
    }
}

function getLevelProgressStatus(setName, levelNumber) {
    const key = `${setName}_${levelNumber}`;
    const progress = levelProgress.get(key);
    
    if (!progress || !progress.attempted) {
        return 'never_played'; // Blue
    } else if (progress.completed) {
        return 'completed'; // Green
    } else {
        return 'attempted'; // Amber
    }
}

async function markLevelAttempted(setName, levelNumber) {
    const key = `${setName}_${levelNumber}`;
    const current = levelProgress.get(key) || { attempted: false, completed: false };
    
    if (!current.attempted) {
        await saveLevelProgress(setName, levelNumber, true, current.completed);
    }
}

async function markLevelCompleted(setName, levelNumber) {
    await saveLevelProgress(setName, levelNumber, true, true, moveCount, pushCount);
}

// Save the last played level to IndexedDB
async function saveLastPlayedLevel(setName, levelNumber) {
    if (!progressDB) return;
    
    try {
        const transaction = progressDB.transaction(['lastPlayed'], 'readwrite');
        const store = transaction.objectStore('lastPlayed');
        
        await store.put({
            id: 'lastPlayed',
            setName: setName,
            levelNumber: levelNumber,
            timestamp: Date.now()
        });
        
        console.log(`Saved last played: ${setName} level ${levelNumber}`);
    } catch (error) {
        console.error('Failed to save last played level:', error);
    }
}

// Load the last played level from IndexedDB
async function loadLastPlayedLevel() {
    if (!progressDB) return null;
    
    try {
        const transaction = progressDB.transaction(['lastPlayed'], 'readonly');
        const store = transaction.objectStore('lastPlayed');
        const request = store.get('lastPlayed');
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log(`Loaded last played: ${result.setName} level ${result.levelNumber}`);
                    resolve({
                        setName: result.setName,
                        levelNumber: result.levelNumber
                    });
                } else {
                    console.log('No last played level found');
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('Failed to load last played level:', request.error);
                resolve(null);
            };
        });
    } catch (error) {
        console.error('Failed to load last played level:', error);
        return null;
    }
}

// #endregion

// #endregion
