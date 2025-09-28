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
            // Check for cloud sync updates when navigating to level select
            if (window.firebaseAuth && window.firebaseAuth.isAuthenticated && window.firebaseAuth.currentUser) {
                downloadGameProgress(true).catch(error => {
                    console.log('Background cloud sync failed (non-critical):', error);
                });
            }
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
    
    // Handle undo with U key
    if ((e.key === 'u' || e.key === 'U') && currentGameState === GAME_STATES.PLAYING) {
        undoLastMove();
        return;
    }
    
    // Handle exit with Escape key (back button behavior)
    if (e.key === 'Escape' && currentGameState === GAME_STATES.PLAYING) {
        // Check for cloud sync updates when navigating back to level select
        if (window.firebaseAuth && window.firebaseAuth.isAuthenticated && window.firebaseAuth.currentUser) {
            downloadGameProgress(true).catch(error => {
                console.log('Background cloud sync failed (non-critical):', error);
            });
        }
        currentGameState = GAME_STATES.LEVEL_SELECT;
        initializeLevelSelect();
        return;
    }
    
    // Handle previously solved overlay
    if (currentGameState === GAME_STATES.PREVIOUSLY_SOLVED) {
        if (e.key === 'Escape') {
            // Dismiss overlay and return to gameplay - reset level to starting state
            solutionCopiedState = false;
            // Preserve attempt counter when returning to gameplay
            const currentAttemptCount = attemptCount;
            restartCurrentLevel(); // Reset level to starting position
            attemptCount = currentAttemptCount; // Restore original count
            currentGameState = GAME_STATES.PLAYING;
        } else if (e.key === ' ') {
            // Space key = Dismiss overlay and play - reset level to starting state
            solutionCopiedState = false;
            // Preserve attempt counter when returning to gameplay
            const currentAttemptCount = attemptCount;
            restartCurrentLevel(); // Reset level to starting position
            attemptCount = currentAttemptCount; // Restore original count
            currentGameState = GAME_STATES.PLAYING;
        }
        return;
    }
    
    // Solution Replay state controls
    if (currentGameState === GAME_STATES.SOLUTION_REPLAY) {
        if (e.key === 'Escape') {
            exitSolutionReplay();
        } else if (e.key === ' ') {
            toggleSolutionReplayPlayback();
        } else if (e.key === 'ArrowRight') {
            stepSolutionReplayForward();
        } else if (e.key === 'ArrowLeft') {
            stepSolutionReplayBackward();
        }
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
    if (currentGameState === GAME_STATES.PLAYING && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape', 'r', 'R', 'u', 'U'].includes(e.key)) {
        let keyName = e.key;
        if (e.key === ' ') keyName = 'Space';
        if (e.key === 'Escape') keyName = 'Escape (Exit)';
        if (e.key === 'r' || e.key === 'R') keyName = 'R (Try Again)';
        if (e.key === 'u' || e.key === 'U') keyName = 'U (Undo)';
        
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
            // Check if click is on the solution button
            if (showSolutionButton && window.solutionButtonBounds && 
                mouseX >= window.solutionButtonBounds.x && 
                mouseX <= window.solutionButtonBounds.x + window.solutionButtonBounds.width &&
                mouseY >= window.solutionButtonBounds.y && 
                mouseY <= window.solutionButtonBounds.y + window.solutionButtonBounds.height) {
                
                // Show previously solved overlay
                currentGameState = GAME_STATES.PREVIOUSLY_SOLVED;
                return;
            }
            
            if (isClickOnOverviewButton(mouseX, mouseY)) {
                toggleOverviewMode();
                return;
            }
            if (isClickOnTryAgainButton(mouseX, mouseY)) {
                restartCurrentLevel();
                return;
            }
            if (isClickOnUndoButton(mouseX, mouseY)) {
                undoLastMove();
                return;
            }
            if (isClickOnExitButton(mouseX, mouseY)) {
                currentGameState = GAME_STATES.LEVEL_SELECT;
                downloadGameProgress(true); // Silent cloud sync on navigation
                initializeLevelSelect();
                return;
            }
        }
        
        // Handle game state transitions (same logic as space key)
        if (currentGameState === GAME_STATES.TITLE) {
            // Check for hamburger menu click
            if (isClickOnHamburgerMenu(mouseX, mouseY)) {
                isHamburgerMenuOpen = !isHamburgerMenuOpen;
                return;
            }
            
            // Check for menu option clicks when menu is open
            if (isHamburgerMenuOpen) {
                if (handleMenuOptionClick(mouseX, mouseY)) {
                    return;
                }
            }
            
            // Check for start button click from title screen (if menu not open)
            if (isClickOnStartButton(mouseX, mouseY)) {
                currentGameState = GAME_STATES.LEVEL_SELECT;
                downloadGameProgress(true); // Silent cloud sync on navigation
                initializeLevelSelect();
                lastInputType = "Level Select";
                lastInputTime = Date.now();
                inputFadeTimer = 2000;
                return;
            }
            return;
        } else if (currentGameState === GAME_STATES.LEVEL_SELECT) {
            handleLevelSelectClick(mouseX, mouseY);
            return;
        } else if (currentGameState === GAME_STATES.INSTRUCTIONS || 
                  currentGameState === GAME_STATES.CREDITS ||
                  currentGameState === GAME_STATES.CLOUD_SYNC) {
            // Check for hamburger menu click
            if (isClickOnHamburgerMenu(mouseX, mouseY)) {
                isHamburgerMenuOpen = !isHamburgerMenuOpen;
                return;
            }
            
            // Check for menu option clicks when menu is open
            if (isHamburgerMenuOpen) {
                if (handleMenuOptionClick(mouseX, mouseY)) {
                    return;
                }
            }
            
            // Check for cloud sync button clicks
            if (currentGameState === GAME_STATES.CLOUD_SYNC) {
                // Sign-in button (when not authenticated or in error state)
                if ((cloudSyncState === 'not_authenticated' || cloudSyncState === 'error') && isClickOnSignInButton(mouseX, mouseY)) {
                    startGoogleSignIn();
                    return;
                }
                
                // Sign-out button (when authenticated)
                if (isClickOnSignOutButton(mouseX, mouseY)) {
                    signOutFromCloud();
                    return;
                }
            }
            
            // Check for back button click
            if (isClickOnBackButton(mouseX, mouseY)) {
                currentGameState = GAME_STATES.TITLE;
                return;
            }
            
            // Check for iOS install specific buttons
            if (currentGameState === GAME_STATES.IOS_INSTALL) {
                if (isClickOnIOSInstallDismissButton(mouseX, mouseY)) {
                    // User dismissed the iOS install prompt
                    acknowledgeIOSInstallNotification();
                    currentGameState = GAME_STATES.TITLE;
                    return;
                }
            }
        } else if (currentGameState === GAME_STATES.SOLUTION_REPLAY) {
            // Handle solution replay control clicks
            if (window.solutionReplayBackButtonBounds && 
                mouseX >= window.solutionReplayBackButtonBounds.x && 
                mouseX <= window.solutionReplayBackButtonBounds.x + window.solutionReplayBackButtonBounds.width &&
                mouseY >= window.solutionReplayBackButtonBounds.y && 
                mouseY <= window.solutionReplayBackButtonBounds.y + window.solutionReplayBackButtonBounds.height) {
                exitSolutionReplay();
                return;
            }
            
            if (window.solutionReplayPlayPauseButtonBounds && 
                mouseX >= window.solutionReplayPlayPauseButtonBounds.x && 
                mouseX <= window.solutionReplayPlayPauseButtonBounds.x + window.solutionReplayPlayPauseButtonBounds.width &&
                mouseY >= window.solutionReplayPlayPauseButtonBounds.y && 
                mouseY <= window.solutionReplayPlayPauseButtonBounds.y + window.solutionReplayPlayPauseButtonBounds.height) {
                toggleSolutionReplayPlayback();
                return;
            }
            
            // Step backward button - only works when paused, not animating, and not at beginning
            if (!solutionReplayData.isPlaying && !isPlayerMoving && solutionReplayData.currentMoveIndex > 0 && 
                window.solutionReplayStepBackButtonBounds && 
                mouseX >= window.solutionReplayStepBackButtonBounds.x && 
                mouseX <= window.solutionReplayStepBackButtonBounds.x + window.solutionReplayStepBackButtonBounds.width &&
                mouseY >= window.solutionReplayStepBackButtonBounds.y && 
                mouseY <= window.solutionReplayStepBackButtonBounds.y + window.solutionReplayStepBackButtonBounds.height) {
                stepSolutionReplayBackward();
                return;
            }
            
            // Step forward button - only works when paused, not animating, and not at end
            if (!solutionReplayData.isPlaying && !isPlayerMoving && solutionReplayData.currentMoveIndex < solutionReplayData.solution.length && 
                window.solutionReplayStepForwardButtonBounds && 
                mouseX >= window.solutionReplayStepForwardButtonBounds.x && 
                mouseX <= window.solutionReplayStepForwardButtonBounds.x + window.solutionReplayStepForwardButtonBounds.width &&
                mouseY >= window.solutionReplayStepForwardButtonBounds.y && 
                mouseY <= window.solutionReplayStepForwardButtonBounds.y + window.solutionReplayStepForwardButtonBounds.height) {
                stepSolutionReplayForward();
                return;
            }
        } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
            // Check if click is on the copy solution button
            if (window.copySolutionButtonBounds && 
                mouseX >= window.copySolutionButtonBounds.x && 
                mouseX <= window.copySolutionButtonBounds.x + window.copySolutionButtonBounds.width &&
                mouseY >= window.copySolutionButtonBounds.y && 
                mouseY <= window.copySolutionButtonBounds.y + window.copySolutionButtonBounds.height) {
                
                // Copy solution to clipboard
                copySolutionToClipboard().then(success => {
                    if (success) {
                        // Set copy state and show success feedback
                        solutionCopied = true;
                        lastInputType = "Solution Copied!";
                        clickCoordinates = "";
                        lastInputTime = Date.now();
                        inputFadeTimer = 3000;
                    } else {
                        // Show error feedback
                        lastInputType = "Copy Failed";
                        clickCoordinates = "";
                        lastInputTime = Date.now();
                        inputFadeTimer = 3000;
                    }
                });
                return; // Only return after copy, don't advance level
            }
            
            // Otherwise advance to next level
            advanceToNextLevel();
            return;
        } else if (currentGameState === GAME_STATES.PREVIOUSLY_SOLVED) {
            
            // Check if click is on the copy saved solution button (only if it exists)
            if (window.copySavedSolutionButtonBounds && 
                mouseX >= window.copySavedSolutionButtonBounds.x && 
                mouseX <= window.copySavedSolutionButtonBounds.x + window.copySavedSolutionButtonBounds.width &&
                mouseY >= window.copySavedSolutionButtonBounds.y && 
                mouseY <= window.copySavedSolutionButtonBounds.y + window.copySavedSolutionButtonBounds.height) {
                
                // Copy saved solution to clipboard
                const levelKey = `${currentSet}_${currentLevelNumber}`;
                const levelProgressData = levelProgress.get(levelKey);
                if (levelProgressData && levelProgressData.solution) {
                    copySavedSolutionToClipboard(levelProgressData).then(success => {
                        if (success) {
                            lastInputType = "Solution Copied!";
                        } else {
                            lastInputType = "Copy Failed";
                        }
                        clickCoordinates = "";
                        lastInputTime = Date.now();
                        inputFadeTimer = 3000;
                    });
                }
                return;
            }
            
            // Check if click is on the replay solution button
            if (window.replaySolutionButtonBounds && 
                mouseX >= window.replaySolutionButtonBounds.x && 
                mouseX <= window.replaySolutionButtonBounds.x + window.replaySolutionButtonBounds.width &&
                mouseY >= window.replaySolutionButtonBounds.y && 
                mouseY <= window.replaySolutionButtonBounds.y + window.replaySolutionButtonBounds.height) {
                
                // Start solution replay
                const levelKey = `${currentSet}_${currentLevelNumber}`;
                const levelProgressData = levelProgress.get(levelKey);
                if (levelProgressData && levelProgressData.solution) {
                    startSolutionReplay(levelProgressData.solution);
                }
                return;
            }
            
            // Check if click is on the back button
            if (window.backButtonBounds && 
                mouseX >= window.backButtonBounds.x && 
                mouseX <= window.backButtonBounds.x + window.backButtonBounds.width &&
                mouseY >= window.backButtonBounds.y && 
                mouseY <= window.backButtonBounds.y + window.backButtonBounds.height) {
                
                // Dismiss overlay and return to gameplay - reset to starting state
                solutionCopiedState = false; // Reset copied state
                // Preserve attempt counter when returning to gameplay
                const currentAttemptCount = attemptCount;
                restartCurrentLevel(); // Reset level to starting position
                attemptCount = currentAttemptCount; // Restore original count
                currentGameState = GAME_STATES.PLAYING;
                return;
            }
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
        // Aggressive iOS system gesture suppression for all game states
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
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
        // Always prevent default to stop iOS system gestures
        e.preventDefault();
        e.stopPropagation();
        
        if (e.touches.length === 1 && isTouchActive && currentGameState === GAME_STATES.PLAYING) {
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
        // Aggressive iOS system gesture suppression for all game states
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
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
                    // Check if tap is on the solution button
                    if (showSolutionButton && window.solutionButtonBounds && 
                        canvasPos.x >= window.solutionButtonBounds.x && 
                        canvasPos.x <= window.solutionButtonBounds.x + window.solutionButtonBounds.width &&
                        canvasPos.y >= window.solutionButtonBounds.y && 
                        canvasPos.y <= window.solutionButtonBounds.y + window.solutionButtonBounds.height) {
                        
                        // Show previously solved overlay
                        currentGameState = GAME_STATES.PREVIOUSLY_SOLVED;
                        return;
                    }
                    
                    if (isClickOnOverviewButton(canvasPos.x, canvasPos.y)) {
                        toggleOverviewMode();
                        return;
                    }
                    if (isClickOnTryAgainButton(canvasPos.x, canvasPos.y)) {
                        restartCurrentLevel();
                        return;
                    }
                    if (isClickOnUndoButton(canvasPos.x, canvasPos.y)) {
                        undoLastMove();
                        return;
                    }
                    if (isClickOnExitButton(canvasPos.x, canvasPos.y)) {
                        currentGameState = GAME_STATES.LEVEL_SELECT;
                        downloadGameProgress(true); // Silent cloud sync on navigation
                        initializeLevelSelect();
                        return;
                    }
                }
                
                // Tap detected
                if (currentGameState === GAME_STATES.TITLE) {
                    // Check for hamburger menu click
                    if (isClickOnHamburgerMenu(canvasPos.x, canvasPos.y)) {
                        isHamburgerMenuOpen = !isHamburgerMenuOpen;
                        return;
                    }
                    
                    // Check for menu option clicks when menu is open
                    if (isHamburgerMenuOpen) {
                        if (handleMenuOptionClick(canvasPos.x, canvasPos.y)) {
                            return;
                        }
                    }
                    
                    // Check for start button tap from title screen (if menu not open)
                    if (isClickOnStartButton(canvasPos.x, canvasPos.y)) {
                        currentGameState = GAME_STATES.LEVEL_SELECT;
                        downloadGameProgress(true); // Silent cloud sync on navigation
                        initializeLevelSelect();
                        lastInputType = "Level Select";
                        lastInputTime = Date.now();
                        inputFadeTimer = 2000;
                    }
                } else if (currentGameState === GAME_STATES.LEVEL_SELECT) {
                    handleLevelSelectClick(canvasPos.x, canvasPos.y);
                } else if (currentGameState === GAME_STATES.INSTRUCTIONS || 
                          currentGameState === GAME_STATES.CREDITS ||
                          currentGameState === GAME_STATES.CLOUD_SYNC ||
                          currentGameState === GAME_STATES.IOS_INSTALL) {
                    // Check for hamburger menu click
                    if (isClickOnHamburgerMenu(canvasPos.x, canvasPos.y)) {
                        isHamburgerMenuOpen = !isHamburgerMenuOpen;
                        return;
                    }
                    
                    // Check for menu option clicks when menu is open
                    if (isHamburgerMenuOpen) {
                        if (handleMenuOptionClick(canvasPos.x, canvasPos.y)) {
                            return;
                        }
                    }
                    
                    // Check for back button click
                    if (isClickOnBackButton(canvasPos.x, canvasPos.y)) {
                        currentGameState = GAME_STATES.TITLE;
                        return;
                    }
                    
                    // Check for iOS install screen dismiss button
                    if (currentGameState === GAME_STATES.IOS_INSTALL && isClickOnIOSInstallDismissButton(canvasPos.x, canvasPos.y)) {
                        acknowledgeIOSInstallNotification();
                        currentGameState = GAME_STATES.TITLE;
                        return;
                    }
                    
                    // Check for cloud sync button clicks
                    if (currentGameState === GAME_STATES.CLOUD_SYNC) {
                        // Sign-in button (when not authenticated or in error state)
                        if ((cloudSyncState === 'not_authenticated' || cloudSyncState === 'error') && isClickOnSignInButton(canvasPos.x, canvasPos.y)) {
                            startGoogleSignIn();
                            return;
                        }
                        
                        // Sign-out button (when authenticated)
                        if (isClickOnSignOutButton(canvasPos.x, canvasPos.y)) {
                            signOutFromCloud();
                            return;
                        }
                    }
                } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
                    // Check if tap is on the copy solution button
                    if (window.copySolutionButtonBounds && 
                        canvasPos.x >= window.copySolutionButtonBounds.x && 
                        canvasPos.x <= window.copySolutionButtonBounds.x + window.copySolutionButtonBounds.width &&
                        canvasPos.y >= window.copySolutionButtonBounds.y && 
                        canvasPos.y <= window.copySolutionButtonBounds.y + window.copySolutionButtonBounds.height) {
                        
                        // Copy solution to clipboard
                        copySolutionToClipboard().then(success => {
                            if (success) {
                                // Set copy state and show success feedback
                                solutionCopied = true;
                                lastInputType = "Solution Copied!";
                                clickCoordinates = "";
                                lastInputTime = Date.now();
                                inputFadeTimer = 3000;
                            } else {
                                // Show error feedback
                                lastInputType = "Copy Failed";
                                clickCoordinates = "";
                                lastInputTime = Date.now();
                                inputFadeTimer = 3000;
                            }
                        });
                        return; // Only return after copy, don't advance level
                    }
                    
                    // Otherwise advance to next level
                    advanceToNextLevel();
                } else if (currentGameState === GAME_STATES.PREVIOUSLY_SOLVED) {
                    // Check if tap is on the play again button
                    if (window.playAgainButtonBounds && 
                        canvasPos.x >= window.playAgainButtonBounds.x && 
                        canvasPos.x <= window.playAgainButtonBounds.x + window.playAgainButtonBounds.width &&
                        canvasPos.y >= window.playAgainButtonBounds.y && 
                        canvasPos.y <= window.playAgainButtonBounds.y + window.playAgainButtonBounds.height) {
                        
                        // Play again - start the level - reset to starting state
                        // Preserve attempt counter when returning to gameplay
                        const currentAttemptCount = attemptCount;
                        restartCurrentLevel(); // Reset level to starting position
                        attemptCount = currentAttemptCount; // Restore original count
                        currentGameState = GAME_STATES.PLAYING;
                        return;
                    }
                    
                    // Check if tap is on the copy saved solution button (only if it exists)
                    if (window.copySavedSolutionButtonBounds && 
                        canvasPos.x >= window.copySavedSolutionButtonBounds.x && 
                        canvasPos.x <= window.copySavedSolutionButtonBounds.x + window.copySavedSolutionButtonBounds.width &&
                        canvasPos.y >= window.copySavedSolutionButtonBounds.y && 
                        canvasPos.y <= window.copySavedSolutionButtonBounds.y + window.copySavedSolutionButtonBounds.height) {
                        
                        // Copy saved solution to clipboard
                        const levelKey = `${currentSet}_${currentLevelNumber}`;
                        const levelProgressData = levelProgress.get(levelKey);
                        if (levelProgressData && levelProgressData.solution) {
                            copySavedSolutionToClipboard(levelProgressData).then(success => {
                                if (success) {
                                    lastInputType = "Solution Copied!";
                                } else {
                                    lastInputType = "Copy Failed";
                                }
                                clickCoordinates = "";
                                lastInputTime = Date.now();
                                inputFadeTimer = 3000;
                            });
                        }
                        return;
                    }
                    
                    // Check if tap is on the replay solution button
                    if (window.replaySolutionButtonBounds && 
                        canvasPos.x >= window.replaySolutionButtonBounds.x && 
                        canvasPos.x <= window.replaySolutionButtonBounds.x + window.replaySolutionButtonBounds.width &&
                        canvasPos.y >= window.replaySolutionButtonBounds.y && 
                        canvasPos.y <= window.replaySolutionButtonBounds.y + window.replaySolutionButtonBounds.height) {
                        
                        // Start solution replay
                        const levelKey = `${currentSet}_${currentLevelNumber}`;
                        const levelProgressData = levelProgress.get(levelKey);
                        if (levelProgressData && levelProgressData.solution) {
                            startSolutionReplay(levelProgressData.solution);
                        }
                        return;
                    }
                    
                    // Check if tap is on the back button
                    if (window.backButtonBounds && 
                        canvasPos.x >= window.backButtonBounds.x && 
                        canvasPos.x <= window.backButtonBounds.x + window.backButtonBounds.width &&
                        canvasPos.y >= window.backButtonBounds.y && 
                        canvasPos.y <= window.backButtonBounds.y + window.backButtonBounds.height) {
                        
                        // Dismiss overlay and return to gameplay - reset to starting state
                        solutionCopiedState = false; // Reset copied state
                        // Preserve attempt counter when returning to gameplay
                        const currentAttemptCount = attemptCount;
                        restartCurrentLevel(); // Reset level to starting position
                        attemptCount = currentAttemptCount; // Restore original count
                        currentGameState = GAME_STATES.PLAYING;
                        return;
                    }
                } else if (currentGameState === GAME_STATES.SOLUTION_REPLAY) {
                    // Handle solution replay control taps
                    if (window.solutionReplayBackButtonBounds && 
                        canvasPos.x >= window.solutionReplayBackButtonBounds.x && 
                        canvasPos.x <= window.solutionReplayBackButtonBounds.x + window.solutionReplayBackButtonBounds.width &&
                        canvasPos.y >= window.solutionReplayBackButtonBounds.y && 
                        canvasPos.y <= window.solutionReplayBackButtonBounds.y + window.solutionReplayBackButtonBounds.height) {
                        exitSolutionReplay();
                        return;
                    }
                    
                    if (window.solutionReplayPlayPauseButtonBounds && 
                        canvasPos.x >= window.solutionReplayPlayPauseButtonBounds.x && 
                        canvasPos.x <= window.solutionReplayPlayPauseButtonBounds.x + window.solutionReplayPlayPauseButtonBounds.width &&
                        canvasPos.y >= window.solutionReplayPlayPauseButtonBounds.y && 
                        canvasPos.y <= window.solutionReplayPlayPauseButtonBounds.y + window.solutionReplayPlayPauseButtonBounds.height) {
                        toggleSolutionReplayPlayback();
                        return;
                    }
                    
                    // Step backward button - only works when paused, not animating, and not at beginning
                    if (!solutionReplayData.isPlaying && !isPlayerMoving && solutionReplayData.currentMoveIndex > 0 && 
                        window.solutionReplayStepBackButtonBounds && 
                        canvasPos.x >= window.solutionReplayStepBackButtonBounds.x && 
                        canvasPos.x <= window.solutionReplayStepBackButtonBounds.x + window.solutionReplayStepBackButtonBounds.width &&
                        canvasPos.y >= window.solutionReplayStepBackButtonBounds.y && 
                        canvasPos.y <= window.solutionReplayStepBackButtonBounds.y + window.solutionReplayStepBackButtonBounds.height) {
                        stepSolutionReplayBackward();
                        return;
                    }
                    
                    // Step forward button - only works when paused, not animating, and not at end
                    if (!solutionReplayData.isPlaying && !isPlayerMoving && solutionReplayData.currentMoveIndex < solutionReplayData.solution.length && 
                        window.solutionReplayStepForwardButtonBounds && 
                        canvasPos.x >= window.solutionReplayStepForwardButtonBounds.x && 
                        canvasPos.x <= window.solutionReplayStepForwardButtonBounds.x + window.solutionReplayStepForwardButtonBounds.width &&
                        canvasPos.y >= window.solutionReplayStepForwardButtonBounds.y && 
                        canvasPos.y <= window.solutionReplayStepForwardButtonBounds.y + window.solutionReplayStepForwardButtonBounds.height) {
                        stepSolutionReplayForward();
                        return;
                    }
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
    LEVEL_COMPLETE: 'level_complete',
    PREVIOUSLY_SOLVED: 'previously_solved',
    SOLUTION_REPLAY: 'solution_replay',
    INSTRUCTIONS: 'instructions',
    CREDITS: 'credits',
    CLOUD_SYNC: 'cloud_sync',
    IOS_INSTALL: 'ios_install'
};
let currentGameState = GAME_STATES.TITLE;
let solutionCopiedState = false; // Track if solution was just copied
let showSolutionButton = false; // Track if solution button should be shown during gameplay

// Solution replay variables
let solutionReplayData = {
    isActive: false,
    isPlaying: false,
    currentMoveIndex: 0, // Index into the solution string
    solution: '',
    intervalId: null,
    moveDelay: 500, // milliseconds between moves (increased for better visibility)
    simulatedContinuousDirection: null, // Track simulated continuous input for smooth animation
    shouldClearContinuousAfterMove: false // Flag to defer clearing continuous direction until move completes
};

// Hamburger menu variables
let isHamburgerMenuOpen = false;
let hasAcknowledgedIOSInstall = true; // Start as true to prevent flash, will be updated from IndexedDB

// F11 fullscreen hint variables (Windows only, session-based)
let hasShownF11Hint = false; // Session flag - shows once per app session
let f11HintStartTime = null; // When hint first appeared
const F11_HINT_DURATION = 8000; // 8 seconds fade duration

// Font loading overlay variables
let showFontLoadingOverlay = true; // Start with overlay visible
let fontLoadingOverlayOpacity = 1.0; // Full opacity initially
let fontLoadingStartTime = Date.now(); // Track when loading started
const FONT_LOADING_MIN_DURATION = 200; // Minimum 200ms to feel intentional
const FONT_LOADING_MAX_DURATION = 3000; // Maximum 3 seconds timeout
const FONT_LOADING_FADE_DURATION = 300; // 300ms fade out

// iOS PWA detection and notification management
function isIOSSafariNotInstalled() {
    // Check if it's iOS (including modern iPad detection)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // Modern iPad detection
    
    // Check if it's Safari (not Chrome, Firefox, etc. on iOS)
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    
    // Check if NOT running as installed PWA
    const isNotInstalled = !window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches;
    
    return isIOS && isSafari && isNotInstalled;
}

// Windows platform detection for F11 fullscreen hint
function isWindowsPlatform() {
    return navigator.platform.includes('Win') || navigator.userAgent.includes('Windows');
}

// Font loading management
function initializeFontLoadingOverlay() {
    // Wait for fonts to be ready with timeout and minimum duration
    const fontReadyPromise = document.fonts.ready.catch(() => {
        console.log('Font loading failed, continuing anyway');
        return Promise.resolve();
    });
    
    const minDurationPromise = new Promise(resolve => {
        setTimeout(resolve, FONT_LOADING_MIN_DURATION);
    });
    
    const maxTimeoutPromise = new Promise(resolve => {
        setTimeout(resolve, FONT_LOADING_MAX_DURATION);
    });
    
    // Wait for fonts AND minimum duration, but respect maximum timeout
    Promise.race([
        Promise.all([fontReadyPromise, minDurationPromise]),
        maxTimeoutPromise
    ]).then(() => {
        // Start fade out
        fadeOutFontLoadingOverlay();
    });
}

function fadeOutFontLoadingOverlay() {
    const fadeStartTime = Date.now();
    
    function updateFade() {
        const elapsed = Date.now() - fadeStartTime;
        const fadeProgress = Math.min(elapsed / FONT_LOADING_FADE_DURATION, 1);
        
        fontLoadingOverlayOpacity = 1.0 - fadeProgress;
        
        if (fadeProgress < 1) {
            requestAnimationFrame(updateFade);
        } else {
            // Fade complete
            showFontLoadingOverlay = false;
        }
    }
    
    requestAnimationFrame(updateFade);
}

// Check if iOS install notification should be shown (for badge count only)
function shouldShowIOSInstallNotification() {
    return isIOSSafariNotInstalled() && !hasAcknowledgedIOSInstall;
}

// Check if iOS install menu item should be shown (always on iOS Safari, even after dismissal)
function shouldShowIOSInstallMenuItem() {
    return isIOSSafariNotInstalled(); // Show menu item on iOS Safari regardless of dismissal
}

// Check if cloud sync notification should be shown
function shouldShowCloudSyncNotification() {
    return cloudSyncState === 'not_authenticated';
}

// Get total notification count for hamburger menu badge
function getNotificationCount() {
    let count = 0;
    
    if (shouldShowCloudSyncNotification()) count++;
    if (shouldShowIOSInstallNotification()) count++;
    
    return count;
}

// Helper function to acknowledge iOS install notification and persist it
function acknowledgeIOSInstallNotification() {
    hasAcknowledgedIOSInstall = true; // Update UI state immediately
    
    // Save to IndexedDB in background (don't block UI)
    saveSetting('hasAcknowledgedIOSInstall', true).catch(error => {
        console.error('Failed to save iOS install notification state:', error);
    });
}

// Cloud Sync authentication variables
let cloudSyncState = 'checking'; // 'checking', 'not_authenticated', 'signing_in', 'authenticated', 'error'

// Expose cloudSyncState globally so Firebase config can update it
window.cloudSyncState = cloudSyncState;

// Helper function to update cloudSyncState and keep it in sync
function updateCloudSyncState(newState) {
    cloudSyncState = newState;
    window.cloudSyncState = newState;
}

// Expose the helper function globally
window.updateCloudSyncState = updateCloudSyncState;

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
let solutionCopied = false; // Track if solution has been copied for current level

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

// Undo system variables
let moveHistory = []; // Array to store game state snapshots
let pendingUndoState = null; // State to apply after undo animation completes
let isReverseAnimation = false; // Flag to indicate reverse animation for undo

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
const backIcon = new Image();
const restartIcon = new Image();
const undoIcon = new Image();
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

// #region Theme System
// Theme configuration - 12 themes that cycle based on level number
const themes = [
    { ground: 4, wall: 5, crate: 7, crateOnGoal: 42 },   // Theme 1
    { ground: 4, wall: 5, crate: 9, crateOnGoal: 44 },   // Theme 2
    { ground: 4, wall: 5, crate: 10, crateOnGoal: 45 },  // Theme 3
    { ground: 4, wall: 6, crate: 7, crateOnGoal: 42 },   // Theme 4
    { ground: 4, wall: 6, crate: 9, crateOnGoal: 44 },   // Theme 5
    { ground: 4, wall: 6, crate: 10, crateOnGoal: 45 },  // Theme 6
    { ground: 5, wall: 5, crate: 11, crateOnGoal: 1 },   // Theme 7
    { ground: 5, wall: 5, crate: 9, crateOnGoal: 44 },   // Theme 8
    { ground: 5, wall: 5, crate: 10, crateOnGoal: 45 },  // Theme 9
    { ground: 5, wall: 6, crate: 11, crateOnGoal: 1 },   // Theme 10
    { ground: 5, wall: 6, crate: 9, crateOnGoal: 44 },   // Theme 11
    { ground: 5, wall: 6, crate: 10, crateOnGoal: 45 }   // Theme 12
];

// Get theme for current level
function getCurrentTheme() {
    // Safety check for themes array
    if (!themes || themes.length === 0) {
        console.warn('Themes array not available in getCurrentTheme');
        return null;
    }
    
    // Fallback to level 1 if currentLevel is not defined yet
    const level = currentLevel || 1;
    const themeIndex = (level - 1) % 12; // 0-based index, cycles through 12 themes
    const theme = themes[themeIndex];
    
    // Debug logging
    if (!theme) {
        console.error('Theme is undefined!', { level, themeIndex, themesLength: themes.length });
    }
    
    return theme;
}

// Get sprite names for current theme
function getThemeSprites() {
    // Define themes directly in function to avoid scoping issues
    const themeData = [
        { ground: 4, wall: 5, crate: 7, crateOnGoal: 42 },   // Theme 1
        { ground: 4, wall: 5, crate: 10, crateOnGoal: 45 },  // Theme 2 (was Theme 3)
        { ground: 4, wall: 6, crate: 7, crateOnGoal: 42 },   // Theme 3 (was Theme 4)
        { ground: 4, wall: 6, crate: 10, crateOnGoal: 45 },  // Theme 4 (was Theme 6)
        { ground: 5, wall: 5, crate: 11, crateOnGoal: 1 },   // Theme 5 (was Theme 7)
        { ground: 5, wall: 5, crate: 9, crateOnGoal: 44 },   // Theme 6 (was Theme 8)
        { ground: 5, wall: 6, crate: 11, crateOnGoal: 1 },   // Theme 7 (was Theme 10)
        { ground: 5, wall: 6, crate: 9, crateOnGoal: 44 }    // Theme 8 (was Theme 11)
    ];
    
    // Get current level number - use currentLevelNumber, not currentLevel!
    const level = (typeof currentLevelNumber === 'number' && currentLevelNumber > 0) ? currentLevelNumber : 1;
    
    const themeIndex = (level - 1) % 8;
    const theme = themeData[themeIndex];
    
    // Absolute fallback if anything is wrong
    if (!theme || typeof theme.ground === 'undefined') {
        return {
            ground: 'ground_04.png',
            wall: 'block_05.png',
            crate: 'crate_07.png',
            crateOnGoal: 'crate_42.png'
        };
    }
    
    return {
        ground: `ground_${theme.ground.toString().padStart(2, '0')}.png`,
        wall: `block_${theme.wall.toString().padStart(2, '0')}.png`,
        crate: `crate_${theme.crate.toString().padStart(2, '0')}.png`,
        crateOnGoal: `crate_${theme.crateOnGoal.toString().padStart(2, '0')}.png`
    };
}
// #endregion
// #endregion

// #region Initialization & Asset Loading
window.onload = init;
function init() {
    let imagesLoaded = 0;
    const numberImages = 7; // spriteSheet, footprintLogo, pushLogo, cartoonLogo, backIcon, restartIcon, undoIcon
    
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
    
    backIcon.src = "assets/images/backIcon.png";
    backIcon.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    restartIcon.src = "assets/images/restartIcon.png";
    restartIcon.onload = function () {
        imagesLoaded++;
        if (imagesLoaded == numberImages) {
            createCanvas();
        }
    }
    
    undoIcon.src = "assets/images/undoIcon.png";
    undoIcon.onload = function () {
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
    
    // Initialize font loading overlay to prevent font flicker
    initializeFontLoadingOverlay();
    
    // Initialize progress tracking database
    initProgressDatabase().then(async () => {
        console.log('Database initialization completed');
        
        if (progressDB) {
            await loadLevelProgress();
            console.log('Level progress loaded');
            
            // Load cloud sync notification state - no longer needed as notification shows when not authenticated
            // (Removed persistent dismissal to always show notification when cloud sync is off)
            
            // Load iOS install notification state
            const savedIOSInstallState = await loadSetting('hasAcknowledgedIOSInstall', false);
            hasAcknowledgedIOSInstall = savedIOSInstallState;
            console.log('iOS install notification state loaded:', hasAcknowledgedIOSInstall);
            
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
    
    // Reset undo system for level load/restart
    moveHistory = [];
    pendingUndoState = null;
    isReverseAnimation = false;
    
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
    
    // Upload progress to cloud if user is authenticated and this is a new level load (not restart)
    if (!isRestart && window.firebaseAuth && window.firebaseAuth.isAuthenticated) {
        // Don't await this to avoid blocking level loading
        uploadGameProgress().catch(error => {
            console.error('Failed to upload progress after level load:', error);
        });
    }
    
    return true;
}
// #endregion

// #region Update Game State
// Undo system functions
function saveGameState() {
    // Create a deep copy of the current game state
    const gameState = {
        playerPos: { x: playerPos.x, y: playerPos.y },
        boxes: currentLevel.boxes.map(box => ({ x: box.x, y: box.y })),
        moveCount: moveCount,
        pushCount: pushCount
    };
    
    // Add to history (unlimited undo)
    moveHistory.push(gameState);
}

function undoLastMove() {
    // Check if undo is available
    if (moveHistory.length === 0 || isPlayerMoving) {
        return; // No history or player is currently moving
    }
    
    // Get the most recent saved state
    const previousState = moveHistory.pop();
    
    // Calculate what needs to be animated in reverse
    const currentPlayerPos = { x: playerPos.x, y: playerPos.y };
    const targetPlayerPos = { x: previousState.playerPos.x, y: previousState.playerPos.y };
    
    // Find any box that moved (compare current vs previous box positions)
    let movedBoxIndex = null;
    let currentBoxPos = null;
    let targetBoxPos = null;
    
    for (let i = 0; i < currentLevel.boxes.length; i++) {
        const currentBox = currentLevel.boxes[i];
        const previousBox = previousState.boxes[i];
        
        if (currentBox.x !== previousBox.x || currentBox.y !== previousBox.y) {
            movedBoxIndex = i;
            currentBoxPos = { x: currentBox.x, y: currentBox.y };
            targetBoxPos = { x: previousBox.x, y: previousBox.y };
            break; // Only one box moves per move
        }
    }
    
    // Start reverse animation
    isPlayerMoving = true;
    moveAnimationProgress = 0;
    isReverseAnimation = true; // Enable reverse animation mode
    
    // Set up reverse movement animation
    moveStartPos = { x: currentPlayerPos.x, y: currentPlayerPos.y };
    moveTargetPos = { x: targetPlayerPos.x, y: targetPlayerPos.y };
    
    // Calculate ORIGINAL movement direction (what direction they moved to get here)
    const originalDirection = {
        x: currentPlayerPos.x - targetPlayerPos.x,
        y: currentPlayerPos.y - targetPlayerPos.y
    };
    
    // Set animation state based on ORIGINAL direction (for true rewind effect)
    let originalAnimationState = 'idle';
    if (originalDirection.x > 0) {
        originalAnimationState = 'moving-right'; // They moved right originally
    } else if (originalDirection.x < 0) {
        originalAnimationState = 'moving-left'; // They moved left originally
    } else if (originalDirection.y > 0) {
        originalAnimationState = 'moving-down'; // They moved down originally
    } else if (originalDirection.y < 0) {
        originalAnimationState = 'moving-up'; // They moved up originally
    }
    
    // Set animation state and start from the end of the sequence for reverse playback
    playerAnimationState = originalAnimationState;
    const frameSequence = playerAnimations[playerAnimationState];
    if (frameSequence && frameSequence.length > 1) {
        playerAnimationFrame = frameSequence.length - 1; // Start from last frame
    } else {
        playerAnimationFrame = 0;
    }
    playerAnimationTimer = 0;
    
    // Set up reverse box animation if a box was moved
    if (movedBoxIndex !== null) {
        movingBox = {
            index: movedBoxIndex,
            startPos: { x: currentBoxPos.x, y: currentBoxPos.y },
            targetPos: { x: targetBoxPos.x, y: targetBoxPos.y }
        };
    } else {
        movingBox = null;
    }
    
    // Store the previous state to apply after animation
    pendingUndoState = previousState;
    
    // Visual feedback
    lastInputType = "Undo";
    lastInputTime = Date.now();
    inputFadeTimer = 2000;
}

// Solution generation function
function generateSolutionString() {
    if (moveHistory.length === 0) return "";
    
    // Create current game state to complete the move sequence
    const currentState = {
        playerPos: { x: playerPos.x, y: playerPos.y },
        boxes: currentLevel.boxes.map(box => ({ x: box.x, y: box.y })),
        moveCount: moveCount,
        pushCount: pushCount
    };
    
    // Create the full move sequence by adding current state to history
    const fullHistory = [...moveHistory, currentState];
    let solutionMoves = "";
    
    for (let i = 1; i < fullHistory.length; i++) {
        const prevPos = fullHistory[i-1].playerPos;
        const currPos = fullHistory[i].playerPos;
        const dx = currPos.x - prevPos.x;
        const dy = currPos.y - prevPos.y;
        
        if (dx === -1) solutionMoves += 'l';
        else if (dx === 1) solutionMoves += 'r';
        else if (dy === -1) solutionMoves += 'u';
        else if (dy === 1) solutionMoves += 'd';
    }
    
    return solutionMoves;
}

// Clipboard copy function for solutions
async function copySolutionToClipboard() {
    try {
        const solutionMoves = generateSolutionString();
        if (!solutionMoves) {
            console.warn("No solution moves to copy");
            return false;
        }
        
        // Format the solution output
        const solutionText = `Crate Escape Solution
Set: ${currentSet}
Level: ${currentLevelNumber}
Moves: ${moveCount} | Pushes: ${pushCount}
Solution: ${solutionMoves}`;
        
        // Copy to clipboard using modern API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(solutionText);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = solutionText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const result = document.execCommand('copy');
            document.body.removeChild(textArea);
            return result;
        }
    } catch (error) {
        console.error("Failed to copy solution to clipboard:", error);
        return false;
    }
}

async function copySavedSolutionToClipboard(levelProgressData) {
    try {
        if (!levelProgressData || !levelProgressData.solution) {
            console.warn("No saved solution to copy");
            return false;
        }
        
        // Format the saved solution output
        const solutionText = `Crate Escape Solution
Set: ${currentSet}
Level: ${currentLevelNumber}
Best: ${levelProgressData.bestMoves || '?'} Moves | ${levelProgressData.bestPushes || '?'} Pushes
Solution: ${levelProgressData.solution}`;
        
        // Copy to clipboard using modern API
        let success = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(solutionText);
            success = true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = solutionText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            success = document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        
        // Set copied state (remains until user leaves overlay)
        if (success) {
            solutionCopiedState = true;
        }
        
        return success;
    } catch (error) {
        console.error("Failed to copy saved solution to clipboard:", error);
        return false;
    }
}

// Player movement functions
function attemptPlayerMove(direction) {
    // Hide solution button when player attempts to move
    showSolutionButton = false;
    
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
        
        // Save game state before making the move
        saveGameState();
        
        // Start movement with box pushing
        startPlayerMove(newX, newY, boxIndex, boxNewX, boxNewY, direction);
    } else {
        // Save game state before making the move
        saveGameState();
        
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
    
    // During solution replay, check if next move is in same direction for continuous animation
    if (currentGameState === GAME_STATES.SOLUTION_REPLAY && solutionReplayData.isActive) {
        const nextMoveIndex = solutionReplayData.currentMoveIndex + 1;
        if (nextMoveIndex < solutionReplayData.solution.length) {
            const nextChar = solutionReplayData.solution[nextMoveIndex];
            const nextDirection = getDirectionFromChar(nextChar);
            
            if (nextDirection && 
                direction.x === nextDirection.x && 
                direction.y === nextDirection.y) {
                // Next move is in same direction - set up continuous animation
                solutionReplayData.simulatedContinuousDirection = direction;
                solutionReplayData.shouldClearContinuousAfterMove = false;
            } else {
                // Next move is different direction - defer clearing continuous animation until move completes
                solutionReplayData.shouldClearContinuousAfterMove = true;
            }
        } else {
            // This is the final move - check if we should continue continuous animation
            if (solutionReplayData.currentMoveIndex > 0) {
                // Check if previous move was in same direction
                const previousChar = solutionReplayData.solution[solutionReplayData.currentMoveIndex - 1];
                const previousDirection = getDirectionFromChar(previousChar);
                
                if (previousDirection && 
                    direction.x === previousDirection.x && 
                    direction.y === previousDirection.y) {
                    // Final move is same direction as previous - keep continuous animation active
                    solutionReplayData.simulatedContinuousDirection = direction;
                    solutionReplayData.shouldClearContinuousAfterMove = false;
                } else {
                    // Final move is different direction - defer clearing continuous animation until move completes
                    solutionReplayData.shouldClearContinuousAfterMove = true;
                }
            } else {
                // This is the first and only move - no continuous animation
                solutionReplayData.simulatedContinuousDirection = null;
                solutionReplayData.shouldClearContinuousAfterMove = false;
            }
        }
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
        
        // Check if this was an undo animation
        if (pendingUndoState) {
            // Apply the undo state after reverse animation completes
            playerPos.x = pendingUndoState.playerPos.x;
            playerPos.y = pendingUndoState.playerPos.y;
            
            // Restore box positions
            for (let i = 0; i < currentLevel.boxes.length; i++) {
                currentLevel.boxes[i].x = pendingUndoState.boxes[i].x;
                currentLevel.boxes[i].y = pendingUndoState.boxes[i].y;
            }
            
            // Restore move and push counts
            moveCount = pendingUndoState.moveCount;
            pushCount = pendingUndoState.pushCount;
            
            // Clear pending undo state and reset reverse animation flag
            pendingUndoState = null;
            isReverseAnimation = false;
        } else {
            // Normal movement completion - update final positions
            playerPos.x = moveTargetPos.x;
            playerPos.y = moveTargetPos.y;
        }
        
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
            
            // Clear continuous direction if flagged to do so during solution replay
            if (currentGameState === GAME_STATES.SOLUTION_REPLAY && 
                solutionReplayData.isActive && 
                solutionReplayData.shouldClearContinuousAfterMove) {
                solutionReplayData.simulatedContinuousDirection = null;
                solutionReplayData.shouldClearContinuousAfterMove = false;
            }
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
            if (isReverseAnimation) {
                // Reverse animation: go backwards through frames
                playerAnimationFrame--;
                if (playerAnimationFrame < 0) {
                    playerAnimationFrame = frameSequence.length - 1; // Wrap to end
                }
            } else {
                // Normal animation: advance to next frame in sequence
                playerAnimationFrame = (playerAnimationFrame + 1) % frameSequence.length;
            }
        } else {
            // Single frame animations (like idle) stay at frame 0
            playerAnimationFrame = 0;
        }
    }
}

function isContinuousInputActive() {
    // During solution replay, check for simulated continuous direction
    if (currentGameState === GAME_STATES.SOLUTION_REPLAY && solutionReplayData.simulatedContinuousDirection) {
        return true;
    }
    
    // Check if any movement keys are currently pressed
    const keyPressed = isKeyDown('ArrowLeft') || isKeyDown('ArrowRight') || 
                      isKeyDown('ArrowUp') || isKeyDown('ArrowDown') ||
                      (isTouchActive && (touchMoveDirection.x !== 0 || touchMoveDirection.y !== 0));
    
    return keyPressed;
}

function checkForContinuedInput() {
    // Only process continued input during normal gameplay, not during solution replay
    if (currentGameState !== GAME_STATES.PLAYING) {
        // However, during solution replay, check for continued replay moves
        if (currentGameState === GAME_STATES.SOLUTION_REPLAY) {
            checkForContinuedReplayMove();
        }
        return;
    }
    
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

function checkForContinuedReplayMove() {
    // Only continue if replay is active and playing
    if (!solutionReplayData.isActive || !solutionReplayData.isPlaying) {
        return;
    }
    
    // Check if there are more moves to execute
    if (solutionReplayData.currentMoveIndex >= solutionReplayData.solution.length) {
        // Solution complete - but don't clear simulated continuous direction here
        // It will be cleared in completeSolutionReplay()
        completeSolutionReplay();
        return;
    }
    
    // Get the current move direction
    const currentChar = solutionReplayData.solution[solutionReplayData.currentMoveIndex];
    const currentDirection = getDirectionFromChar(currentChar);
    
    if (!currentDirection) return;
    
    // Check if this move should continue immediately (same direction as previous)
    // or if we should respect the interval delay
    let shouldContinueImmediately = false;
    
    if (solutionReplayData.currentMoveIndex > 0) {
        const previousChar = solutionReplayData.solution[solutionReplayData.currentMoveIndex - 1];
        const previousDirection = getDirectionFromChar(previousChar);
        
        if (previousDirection && 
            currentDirection.x === previousDirection.x && 
            currentDirection.y === previousDirection.y) {
            shouldContinueImmediately = true;
        }
    }
    
    if (shouldContinueImmediately) {
        // Continue immediately for fluid multi-tile movement
        executeNextReplayMove();
    }
    // If not continuing immediately, let the interval timer handle the next move
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
    // Only check completion during normal PLAYING state (not during solution replay)
    if (currentGameState === GAME_STATES.PLAYING && isLevelComplete()) {
        currentGameState = GAME_STATES.LEVEL_COMPLETE;
        levelCompletionStartTime = Date.now();
        solutionCopied = false; // Reset copy state for new completion
        
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
        // Check if this level has been previously solved
        const levelKey = `${currentSet}_${currentLevelNumber}`;
        const levelProgressData = levelProgress.get(levelKey);
        
        if (levelProgressData && levelProgressData.completed) {
            // Level was previously completed - show solution button during gameplay
            solutionCopiedState = false; // Reset copied state
            showSolutionButton = true; // Show solution button instead of overlay
            currentGameState = GAME_STATES.PLAYING;
        } else {
            // New or unsolved level - go straight to playing
            showSolutionButton = false; // No solution button for unsolved levels
            currentGameState = GAME_STATES.PLAYING;
        }
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
    const buttonSpacing = 8;
    const rightMargin = 10;
    
    // Use same calculations as drawStatusBar
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    const restartButtonX = exitButtonX - buttonSize - buttonSpacing;
    const restartButtonY = exitButtonY;
    
    return x >= restartButtonX && x <= restartButtonX + buttonSize &&
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

function isClickOnUndoButton(x, y) {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45; // Match drawStatusBar sizing
    
    // Use same calculations as drawStatusBar - UNDO button is centered between the original icons
    const canvasCenterX = canvas.width / 2;
    const undoButtonX = canvasCenterX - buttonSize / 2;
    const undoButtonY = isMobile ? 15 : 10; // Same as exit button
    
    // Standard button click area
    return x >= undoButtonX && x <= undoButtonX + buttonSize &&
           y >= undoButtonY && y <= undoButtonY + buttonSize;
}

function isClickOnHamburgerMenu(x, y) {
    // Hamburger menu is in top-left corner of title screen
    const menuSize = 40;
    const margin = 15;
    
    return x >= margin && x <= margin + menuSize &&
           y >= margin && y <= margin + menuSize;
}

function isClickOnStartButton(x, y) {
    // Check if start button bounds are defined and click is within bounds
    if (!window.startButtonBounds) return false;
    
    const bounds = window.startButtonBounds;
    return x >= bounds.x && x <= bounds.x + bounds.width &&
           y >= bounds.y && y <= bounds.y + bounds.height;
}

function isClickOnMenuOption(x, y, optionIndex) {
    // Menu options appear below hamburger menu when open
    const menuX = 15;
    const menuY = 70; // Below hamburger menu
    const optionHeight = 40;
    const optionWidth = 150;
    
    const optionY = menuY + (optionIndex * optionHeight);
    
    return x >= menuX && x <= menuX + optionWidth &&
           y >= optionY && y <= optionY + optionHeight;
}

// Helper function to get current menu configuration
function getCurrentMenuConfig() {
    const baseOptions = ["Home", "Instructions", "Cloud Sync"];
    const baseGameStates = [GAME_STATES.TITLE, GAME_STATES.INSTRUCTIONS, GAME_STATES.CLOUD_SYNC];
    
    // Add iOS Install option if user is on iOS Safari (regardless of dismissal)
    if (shouldShowIOSInstallMenuItem()) {
        baseOptions.splice(2, 0, "📱 Install App"); // Insert before Cloud Sync
        baseGameStates.splice(2, 0, GAME_STATES.IOS_INSTALL);
    }
    
    // Add Credits at the end
    baseOptions.push("Credits");
    baseGameStates.push(GAME_STATES.CREDITS);
    
    return { options: baseOptions, gameStates: baseGameStates };
}

// Helper function to handle menu option clicks dynamically
function handleMenuOptionClick(mouseX, mouseY) {
    const menuConfig = getCurrentMenuConfig();
    
    for (let i = 0; i < menuConfig.options.length; i++) {
        if (isClickOnMenuOption(mouseX, mouseY, i)) {
            const targetState = menuConfig.gameStates[i];
            
            // Handle special cases
            if (targetState === GAME_STATES.TITLE) {
                // Home - always go to title screen
                currentGameState = GAME_STATES.TITLE;
                isHamburgerMenuOpen = false;
                return true;
            } else if (targetState === GAME_STATES.CLOUD_SYNC) {
                // Cloud Sync
                currentGameState = GAME_STATES.CLOUD_SYNC;
                isHamburgerMenuOpen = false;
                return true;
            } else if (targetState === GAME_STATES.IOS_INSTALL) {
                // iOS Install - go to install screen (don't auto-dismiss notification)
                currentGameState = GAME_STATES.IOS_INSTALL;
                isHamburgerMenuOpen = false;
                return true;
            } else {
                // Regular navigation (Instructions, Credits)
                currentGameState = targetState;
                isHamburgerMenuOpen = false;
                return true;
            }
        }
    }
    
    // No menu option was clicked - close menu
    isHamburgerMenuOpen = false;
    return true;
}

function isClickOnBackButton(x, y) {
    // Same positioning as game/level select back button
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45;
    const rightMargin = 10;
    
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    
    return x >= exitButtonX && x <= exitButtonX + buttonSize &&
           y >= exitButtonY && y <= exitButtonY + buttonSize;
}

// Helper function to check if click is on iOS install dismiss button
function isClickOnIOSInstallDismissButton(x, y) {
    if (!window.iosInstallDismissButton) return false;
    
    const button = window.iosInstallDismissButton;
    return x >= button.x && x <= button.x + button.width &&
           y >= button.y && y <= button.y + button.height;
}

function isClickOnSignInButton(x, y) {
    // Check if we're on cloud sync screen and in the right state
    if (currentGameState !== GAME_STATES.CLOUD_SYNC) return false;
    if (window.firebaseAuth && window.firebaseAuth.isAuthenticated) return false;
    
    // Only show button in not_authenticated or error states
    if (cloudSyncState !== 'not_authenticated' && cloudSyncState !== 'error') return false;
    
    // Button dimensions (matching the drawing in drawCloudSyncScreen)
    const buttonWidth = 220; // Updated for Google Sign-In button
    const buttonHeight = 50;
    const buttonX = (canvas.width - buttonWidth) / 2;
    
    // Calculate button Y position (should match drawCloudSyncScreen logic)
    const isMobile = canvas.width < 600;
    const textSize = isMobile ? 16 : 20;
    const lineHeight = textSize * 1.5;
    let buttonY;
    
    if (cloudSyncState === 'not_authenticated') {
        buttonY = 140 + lineHeight * 6; // Base position + spacing for normal text content
    } else if (cloudSyncState === 'error') {
        buttonY = 140 + lineHeight * 5; // Base position + spacing for error text content
    }
    
    return x >= buttonX && x <= buttonX + buttonWidth &&
           y >= buttonY && y <= buttonY + buttonHeight;
}

// Helper function to open links appropriately based on PWA status
function isClickOnSignOutButton(x, y) {
    // Check if we're on cloud sync screen and authenticated
    if (currentGameState !== GAME_STATES.CLOUD_SYNC) return false;
    if (!window.firebaseAuth || !window.firebaseAuth.isAuthenticated) return false;
    
    // Button dimensions (matching the drawing in drawCloudSyncScreen)
    const signOutButtonWidth = 150;
    const signOutButtonHeight = 40;
    const signOutButtonX = (canvas.width - signOutButtonWidth) / 2;
    
    // Calculate button Y position (should match drawCloudSyncScreen logic)
    const isMobile = canvas.width < 600;
    const textSize = isMobile ? 16 : 20;
    const lineHeight = textSize * 1.5;
    const signOutButtonY = 140 + lineHeight * 5; // Base position + spacing for authenticated user content
    
    return x >= signOutButtonX && x <= signOutButtonX + signOutButtonWidth &&
           y >= signOutButtonY && y <= signOutButtonY + signOutButtonHeight;
}

// Cloud sync authentication functions
async function startGoogleSignIn() {
    try {
        console.log('Starting Google Sign-In...');
        
        // Check if Firebase is available
        if (!window.firebaseAuth || !window.firebaseAuth.auth) {
            console.error('Firebase Auth not available');
            cloudSyncState = 'error';
            return;
        }
        
        cloudSyncState = 'signing_in';
        
        // Import Google Sign-In functions
        const { signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js');
        
        // Create Google Auth Provider
        const provider = new GoogleAuthProvider();
        
        // Add scopes if needed (optional)
        provider.addScope('profile');
        provider.addScope('email');
        
        console.log('Opening Google Sign-In popup...');
        
        // Sign in with popup
        const result = await signInWithPopup(window.firebaseAuth.auth, provider);
        
        console.log('Google Sign-In successful:', result.user);
        console.log('User displayName:', result.user.displayName);
        console.log('User email:', result.user.email);
        console.log('User photoURL:', result.user.photoURL);
        updateCloudSyncState('authenticated');
        
        // Update global auth state
        window.firebaseAuth.isAuthenticated = true;
        window.firebaseAuth.currentUser = result.user;
        // No need to acknowledge notification - it will automatically disappear when authenticated
        
        // First, try to download existing progress (stay on cloud sync page)
        const hasCloudData = await downloadGameProgress(false, false);
        
        // If no cloud data was found or download was cancelled, upload current progress
        if (!hasCloudData) {
            await uploadGameProgress();
        }
        
    } catch (error) {
        console.error('Error with Google Sign-In:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle specific error cases
        if (error.code === 'auth/popup-closed-by-user') {
            console.log('User cancelled sign-in');
            cloudSyncState = 'not_authenticated';
        } else if (error.code === 'auth/popup-blocked') {
            console.log('Popup was blocked by browser');
            cloudSyncState = 'error';
            // Show user a message about enabling popups
        } else if (error.code === 'auth/unauthorized-domain') {
            console.log('Domain not authorized in Firebase Console');
            cloudSyncState = 'error';
        } else if (error.code === 'auth/operation-not-allowed') {
            console.log('Google Sign-In not enabled in Firebase Console');
            cloudSyncState = 'error';
        } else {
            console.log('Other authentication error:', error.code);
            cloudSyncState = 'error';
        }
    }
}

// Cloud data sync functions
async function uploadGameProgress() {
    try {
        // Check if user is authenticated
        if (!window.firebaseAuth || !window.firebaseAuth.isAuthenticated || !window.firebaseAuth.currentUser) {
            console.log('Cannot upload progress: user not authenticated');
            return false;
        }
        
        console.log('Uploading game progress to cloud...');
        
        // Import Firestore functions
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js');
        
        // Get all detailed level data from IndexedDB
        let detailedLevelData = {};
        let lastPlayedData = null;
        if (progressDB) {
            try {
                // Get level progress data
                const levelTransaction = progressDB.transaction(['levelProgress'], 'readonly');
                const levelStore = levelTransaction.objectStore('levelProgress');
                const allRecords = await new Promise((resolve, reject) => {
                    const request = levelStore.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                // Convert array to object for easier cloud storage
                detailedLevelData = {};
                allRecords.forEach(record => {
                    const levelData = {
                        setName: record.setName,
                        levelNumber: record.levelNumber,
                        attempted: record.attempted,
                        completed: record.completed,
                        bestMoves: record.bestMoves,
                        bestPushes: record.bestPushes,
                        completionCount: record.completionCount,
                        lastPlayed: record.lastPlayed,
                        lastCompletionDate: record.lastCompletionDate
                    };
                    
                    // Only include solution if it exists (not undefined)
                    if (record.solution !== undefined) {
                        levelData.solution = record.solution;
                    }
                    
                    detailedLevelData[record.id] = levelData;
                });
                console.log(`Collected ${allRecords.length} level records for cloud sync`);
                
                // Get last played data
                const lastPlayedTransaction = progressDB.transaction(['lastPlayed'], 'readonly');
                const lastPlayedStore = lastPlayedTransaction.objectStore('lastPlayed');
                lastPlayedData = await new Promise((resolve, reject) => {
                    const request = lastPlayedStore.get('lastPlayed');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                if (lastPlayedData) {
                    console.log(`Collected last played: ${lastPlayedData.setName} level ${lastPlayedData.levelNumber}`);
                }
                
            } catch (error) {
                console.error('Error reading data from IndexedDB:', error);
                // Fall back to basic Map data if IndexedDB fails
                detailedLevelData = Object.fromEntries(levelProgress);
            }
        } else {
            // Fall back to basic Map data if no IndexedDB
            detailedLevelData = Object.fromEntries(levelProgress);
        }
        
        // Prepare game progress data
        const progressData = {
            // Player progress
            currentLevelSet: currentSet,
            currentLevelNumber: currentLevelNumber,
            
            // Detailed level progress data from IndexedDB
            detailedLevelProgress: detailedLevelData,
            
            // Last played level data from IndexedDB
            lastPlayedLevel: lastPlayedData,
            
            // Current game state (if in a level)
            currentGameState: currentGameState,
            
            // Metadata
            lastUpdated: serverTimestamp(),
            gameVersion: "1.0",
            deviceInfo: navigator.userAgent.substring(0, 100), // Truncated user agent
            
            // User identification (for admin purposes)
            userInfo: {
                uid: window.firebaseAuth.currentUser.uid,
                email: window.firebaseAuth.currentUser.email,
                displayName: window.firebaseAuth.currentUser.displayName || 'Anonymous',
                photoURL: window.firebaseAuth.currentUser.photoURL || null,
                lastSync: new Date().toISOString()
            }
        };
        
        // Create document reference for the user's progress
        const userId = window.firebaseAuth.currentUser.uid;
        const progressRef = doc(window.firebaseFirestore, 'gameProgress', userId);
        
        // Upload the data
        await setDoc(progressRef, progressData, { merge: true });
        
        console.log('Game progress uploaded successfully');
        
        // Show brief success message
        lastInputType = "Progress Saved";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return true;
        
    } catch (error) {
        console.error('Error uploading game progress:', error);
        
        // Show brief error message
        lastInputType = "Save Error";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return false;
    }
}

async function downloadGameProgress(silent = false, redirectToLevelSelect = true) {
    try {
        // Check if user is authenticated
        if (!window.firebaseAuth || !window.firebaseAuth.isAuthenticated || !window.firebaseAuth.currentUser) {
            if (!silent) console.log('Cannot download progress: user not authenticated');
            return false;
        }
        
        if (!silent) console.log('Downloading game progress from cloud...');
        
        // Import Firestore functions
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js');
        
        // Create document reference for the user's progress
        const userId = window.firebaseAuth.currentUser.uid;
        const progressRef = doc(window.firebaseFirestore, 'gameProgress', userId);
        
        // Download the data
        const docSnap = await getDoc(progressRef);
        
        if (!docSnap.exists()) {
            console.log('No cloud progress found for this user');
            
            // Show brief message
            lastInputType = "No Cloud Data";
            lastInputTime = Date.now();
            inputFadeTimer = 2000;
            
            return false;
        }
        
        const progressData = docSnap.data();
        console.log('Downloaded game progress:', progressData);
        
        // Automatically merge cloud and local progress data without prompting
        console.log('Automatically merging cloud progress with local progress...');
        
        // Restore game progress
        currentSet = progressData.currentLevelSet || 'Classic';
        currentLevelNumber = progressData.currentLevelNumber || 1;
        
        // Intelligent merge of cloud and local progress data
        if (progressData.detailedLevelProgress && progressDB) {
            try {
                const transaction = progressDB.transaction(['levelProgress'], 'readwrite');
                const store = transaction.objectStore('levelProgress');
                
                // Get all existing local records first
                const existingRecords = await new Promise((resolve, reject) => {
                    const request = store.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                // Create a map of existing local data
                const localData = {};
                existingRecords.forEach(record => {
                    localData[record.id] = record;
                });
                
                // Merge cloud data with local data
                const mergedRecords = {};
                let mergeStats = { 
                    cloudOnly: 0, 
                    localOnly: 0, 
                    merged: 0, 
                    scoresImproved: 0,
                    completionUpgraded: 0
                };
                
                // Process all cloud records
                Object.entries(progressData.detailedLevelProgress).forEach(([id, cloudRecord]) => {
                    const localRecord = localData[id];
                    
                    if (!localRecord) {
                        // Cloud-only record - add it directly
                        mergedRecords[id] = { id, ...cloudRecord };
                        mergeStats.cloudOnly++;
                    } else {
                        // Merge local and cloud records intelligently
                        const merged = {
                            id: id,
                            setName: cloudRecord.setName,
                            levelNumber: cloudRecord.levelNumber,
                            // Attempted if either source shows attempted
                            attempted: localRecord.attempted || cloudRecord.attempted,
                            // Completed if either source shows completed
                            completed: localRecord.completed || cloudRecord.completed,
                            // Best moves - take the lowest non-null value
                            bestMoves: getBestScore(localRecord.bestMoves, cloudRecord.bestMoves),
                            // Best pushes - take the lowest non-null value  
                            bestPushes: getBestScore(localRecord.bestPushes, cloudRecord.bestPushes),
                            // Completion count - take the higher value
                            completionCount: Math.max(localRecord.completionCount || 0, cloudRecord.completionCount || 0),
                            // Last played - take the more recent timestamp
                            lastPlayed: getMostRecent(localRecord.lastPlayed, cloudRecord.lastPlayed),
                            // Last completion - take the more recent timestamp
                            lastCompletionDate: getMostRecent(localRecord.lastCompletionDate, cloudRecord.lastCompletionDate),
                            // Solution - prefer cloud solution if it exists, otherwise keep local
                            solution: cloudRecord.solution || localRecord.solution
                        };
                        
                        mergedRecords[id] = merged;
                        mergeStats.merged++;
                        
                        // Track improvements
                        if (merged.bestMoves < (localRecord.bestMoves || Infinity) || 
                            merged.bestPushes < (localRecord.bestPushes || Infinity)) {
                            mergeStats.scoresImproved++;
                        }
                        if (merged.completed && !localRecord.completed) {
                            mergeStats.completionUpgraded++;
                        }
                    }
                });
                
                // Add any local-only records that weren't in the cloud
                existingRecords.forEach(localRecord => {
                    if (!progressData.detailedLevelProgress[localRecord.id]) {
                        mergedRecords[localRecord.id] = localRecord;
                        mergeStats.localOnly++;
                    }
                });
                
                // Clear the store and write all merged records
                await new Promise((resolve, reject) => {
                    const clearRequest = store.clear();
                    clearRequest.onsuccess = () => resolve();
                    clearRequest.onerror = () => reject(clearRequest.error);
                });
                
                // Write all merged records
                const writePromises = Object.values(mergedRecords).map(record => {
                    return new Promise((resolve, reject) => {
                        const putRequest = store.put(record);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    });
                });
                
                await Promise.all(writePromises);
                
                // Update the levelProgress Map cache
                levelProgress.clear();
                Object.values(mergedRecords).forEach(record => {
                    levelProgress.set(record.id, {
                        attempted: record.attempted,
                        completed: record.completed,
                        bestMoves: record.bestMoves,
                        bestPushes: record.bestPushes,
                        completionCount: record.completionCount,
                        solution: record.solution
                    });
                });
                
                console.log(`Merge completed: ${Object.keys(mergedRecords).length} total records`);
                console.log(`Cloud-only: ${mergeStats.cloudOnly}, Local-only: ${mergeStats.localOnly}, Merged: ${mergeStats.merged}`);
                console.log(`Scores improved: ${mergeStats.scoresImproved}, Completions upgraded: ${mergeStats.completionUpgraded}`);
                
                // After merging, upload the combined data back to cloud
                // This ensures cloud has the latest merged state
                setTimeout(() => {
                    uploadGameProgress().catch(error => {
                        console.error('Failed to upload merged progress to cloud:', error);
                    });
                }, 1000); // Small delay to avoid immediate re-upload
                
            } catch (error) {
                console.error('Error during intelligent merge:', error);
                // Fall back to basic restoration if merge fails
                if (progressData.levelProgress) {
                    levelProgress = new Map(Object.entries(progressData.levelProgress));
                }
            }
        } else if (progressData.levelProgress) {
            // Fall back to basic Map restoration for older cloud saves
            levelProgress = new Map(Object.entries(progressData.levelProgress));
        }
        
        // Helper function to get the best (lowest) score
        function getBestScore(score1, score2) {
            if (score1 === null || score1 === undefined) return score2;
            if (score2 === null || score2 === undefined) return score1;
            return Math.min(score1, score2);
        }
        
        // Helper function to get the most recent timestamp
        function getMostRecent(date1, date2) {
            if (!date1) return date2;
            if (!date2) return date1;
            return new Date(date1) > new Date(date2) ? date1 : date2;
        }
        
        // Merge last played level data
        if (progressData.lastPlayedLevel && progressDB) {
            try {
                const lastPlayedTransaction = progressDB.transaction(['lastPlayed'], 'readwrite');
                const lastPlayedStore = lastPlayedTransaction.objectStore('lastPlayed');
                
                // Get existing local last played data
                const existingLastPlayed = await new Promise((resolve, reject) => {
                    const request = lastPlayedStore.get('lastPlayed');
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                
                // Determine which last played is more recent
                let mergedLastPlayed = progressData.lastPlayedLevel;
                if (existingLastPlayed) {
                    const cloudTimestamp = progressData.lastPlayedLevel.timestamp || 0;
                    const localTimestamp = existingLastPlayed.timestamp || 0;
                    
                    if (localTimestamp > cloudTimestamp) {
                        mergedLastPlayed = existingLastPlayed;
                        console.log(`Keeping local last played (newer): ${existingLastPlayed.setName} level ${existingLastPlayed.levelNumber}`);
                    } else {
                        console.log(`Using cloud last played (newer): ${mergedLastPlayed.setName} level ${mergedLastPlayed.levelNumber}`);
                    }
                } else {
                    console.log(`Using cloud last played (no local data): ${mergedLastPlayed.setName} level ${mergedLastPlayed.levelNumber}`);
                }
                
                // Save the merged last played data
                await new Promise((resolve, reject) => {
                    const putRequest = lastPlayedStore.put({
                        id: 'lastPlayed',
                        setName: mergedLastPlayed.setName,
                        levelNumber: mergedLastPlayed.levelNumber,
                        timestamp: mergedLastPlayed.timestamp || Date.now()
                    });
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                });
                
            } catch (error) {
                console.error('Error merging last played level:', error);
            }
        }
        
        // Conditionally redirect to level select after restoring progress
        if (redirectToLevelSelect) {
            currentGameState = GAME_STATES.LEVEL_SELECT;
            initializeLevelSelect();
        }
        hasCloudSyncedThisSession = false; // Reset sync flag for new session
        
        console.log('Game progress restored successfully');
        
        // Show success message
        lastInputType = "Progress Restored";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return true;
        
    } catch (error) {
        console.error('Error downloading game progress:', error);
        
        // Show error message
        lastInputType = "Download Error";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return false;
    }
}

async function signOutFromCloud() {
    try {
        console.log('Signing out from cloud sync...');
        
        // Import signOut function
        const { signOut } = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js');
        
        // Sign out from Firebase
        await signOut(window.firebaseAuth.auth);
        
        // Update global auth state
        window.firebaseAuth.isAuthenticated = false;
        window.firebaseAuth.currentUser = null;
        
        // Reset cloud sync state
        updateCloudSyncState('not_authenticated');
        phoneNumber = null;
        verificationId = null;
        recaptchaVerifier = null;
        
        console.log('Successfully signed out');
        
        // Show success message
        lastInputType = "Signed Out";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return true;
        
    } catch (error) {
        console.error('Error signing out:', error);
        
        // Show error message
        lastInputType = "Sign Out Error";
        lastInputTime = Date.now();
        inputFadeTimer = 2000;
        
        return false;
    }
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
    if (currentGameState === GAME_STATES.PLAYING || currentGameState === GAME_STATES.SOLUTION_REPLAY) {
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
    } else if (currentGameState === GAME_STATES.PREVIOUSLY_SOLVED) {
        drawGameplay(); // Draw the level in background
        drawPreviouslySolvedOverlay();
    } else if (currentGameState === GAME_STATES.SOLUTION_REPLAY) {
        drawGameplay(); // Draw the level being replayed
        drawSolutionReplayControls();
    } else if (currentGameState === GAME_STATES.LEVEL_COMPLETE) {
        drawGameplay(); // Draw the completed level in background
        drawLevelCompleteOverlay();
    } else if (currentGameState === GAME_STATES.INSTRUCTIONS) {
        drawInstructionsScreen();
    } else if (currentGameState === GAME_STATES.CREDITS) {
        drawCreditsScreen();
    } else if (currentGameState === GAME_STATES.CLOUD_SYNC) {
        drawCloudSyncScreen();
    } else if (currentGameState === GAME_STATES.IOS_INSTALL) {
        drawIOSInstallScreen();
    }
    
    // Draw font loading overlay on top of everything if needed
    if (showFontLoadingOverlay) {
        drawFontLoadingOverlay();
    }
}

function drawFontLoadingOverlay() {
    // Draw black overlay covering entire canvas
    context.save();
    context.fillStyle = `rgba(0, 0, 0, ${fontLoadingOverlayOpacity})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
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
    yPos = drawWrappedText(context, "Complete your shift by pushing all crates into their designated positions before escaping to the pub!", canvas.width / 2, yPos, maxTextWidth, mainInstructionLineHeight);

    // MIDDLE CONTENT POSITIONING: Use available space between top content and bottom-anchored elements
    
    // Calculate the available space for middle content
    // Bottom boundary: where the start button begins (calculated ahead of time)
    let tempButtonTextSize;
    if (isMobilePortrait) {
        tempButtonTextSize = textSize * 1.2;
    } else if (isMobileLandscape) {
        tempButtonTextSize = textSize * 1.1;
    } else {
        tempButtonTextSize = textSize * 1.1;
    }
    
    let tempAuthorSize;
    if (isMobilePortrait) {
        tempAuthorSize = textSize * 1.2;
    } else if (isMobileLandscape) {
        tempAuthorSize = textSize * 0.95;
    } else {
        tempAuthorSize = textSize * 1.1;
    }
    
    const bottomCreditsY = canvas.height * 0.95;
    const tempButtonHeight = tempButtonTextSize * 1.8;
    const tempButtonSpacing = isMobileLandscape ? tempButtonHeight * 0.8 : tempButtonHeight * 1.2;
    const bottomBoundary = bottomCreditsY - tempAuthorSize - tempButtonSpacing - tempButtonHeight;
    
    // Calculate available space for demo level and determine optimal positioning
    const availableMiddleSpace = bottomBoundary - yPos;
    const demoHeight = 3; // tiles
    
    // Calculate demo tile size that fits well in available space
    let baseDemoTileSize;
    if (isMobilePortrait) {
        baseDemoTileSize = Math.min(canvas.width / 15, availableMiddleSpace / 8, 40);
    } else if (isMobileLandscape) {
        baseDemoTileSize = Math.min(canvas.width / 20, availableMiddleSpace / 6, 28);
    } else {
        baseDemoTileSize = Math.min(canvas.width / 20, availableMiddleSpace / 8, 32);
    }
    
    // Ensure tile size is an integer for pixel-perfect rendering
    const demoTileSize = Math.floor(baseDemoTileSize);
    
    const demoWidth = 7; // 7 tiles wide
    const totalDemoHeight = demoHeight * demoTileSize;
    
    // Center the demo level in the available middle space
    const middleSpaceCenter = yPos + (availableMiddleSpace / 2);
    const demoStartY = Math.floor(middleSpaceCenter - (totalDemoHeight / 2));
    
    // Pixel-align the demo level position
    const demoStartX = Math.floor((canvas.width - (demoWidth * demoTileSize)) / 2);
    
    // Draw demo level tiles with pixel-perfect positioning
    for (let y = 0; y < demoHeight; y++) {
        for (let x = 0; x < demoWidth; x++) {
            // Ensure pixel-aligned tile positions
            const tileX = Math.floor(demoStartX + x * demoTileSize);
            const tileY = Math.floor(demoStartY + y * demoTileSize);
            
            if (y === 0 || y === 2 || x === 0 || x === 6) {
                // Wall tiles - use current theme
                const sprites = getThemeSprites();
                const sprite = textureAtlas.frames[sprites.wall];
                context.drawImage(
                    spriteSheet,
                    sprite.x, sprite.y, sprite.width, sprite.height,
                    tileX, tileY, demoTileSize, demoTileSize
                );
            } else if (y === 1) {
                // Floor corridor - use current theme
                const sprites = getThemeSprites();
                const sprite = textureAtlas.frames[sprites.ground];
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
                    // Crate - use current theme crate sprite
                    const sprites = getThemeSprites();
                    const crateSprite = textureAtlas.frames[sprites.crate];
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
    
    // BOTTOM-ANCHORED POSITIONING: Position credits and start button from bottom edge
    
    // Author credit - anchored to bottom at 5% from bottom edge
    let authorSize;
    if (isMobilePortrait) {
        authorSize = textSize * 1.2;
    } else if (isMobileLandscape) {
        authorSize = textSize * 0.95; // Slightly smaller for landscape to ensure it fits
    } else {
        authorSize = textSize * 1.1; // Original size for desktop
    }
    
    const creditsY = canvas.height * 0.95; // Always 5% from bottom
    context.font = `400 ${authorSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#FFCC00"; // Yellow color
    context.fillText("Copyright © 2025 Neil Kendall", canvas.width / 2, creditsY);
    
    // Start button - positioned above credits with fixed spacing
    let buttonTextSize;
    if (isMobilePortrait) {
        buttonTextSize = textSize * 1.2;
    } else if (isMobileLandscape) {
        buttonTextSize = textSize * 1.1; // Moderate increase for landscape
    } else {
        buttonTextSize = textSize * 1.1; // Original size for desktop
    }
    
    // Button styling with pulsing effect (same as level complete overlay)
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
    
    // Button dimensions
    const buttonText = "START GAME";
    context.font = `700 ${buttonTextSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    const textMetrics = context.measureText(buttonText);
    const buttonPadding = buttonTextSize * 0.8;
    const buttonWidth = textMetrics.width + buttonPadding * 2;
    const buttonHeight = buttonTextSize * 1.8;
    const buttonX = (canvas.width - buttonWidth) / 2;
    
    // Position button above credits with responsive spacing
    const buttonSpacing = isMobileLandscape ? buttonHeight * 0.8 : buttonHeight * 1.2;
    const buttonY = creditsY - authorSize - buttonSpacing - buttonHeight / 2;
    
    // Store button bounds for click detection
    window.startButtonBounds = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // Draw button background with glow effect
    context.save();
    context.shadowColor = "#88CC88"; // Green shadow
    context.shadowBlur = 15 * pulse;
    context.fillStyle = `rgba(34, 139, 34, ${0.8 + pulse * 0.2})`; // Forest green with pulsing alpha
    context.beginPath();
    context.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
    context.fill();
    
    // Draw button border
    context.strokeStyle = `rgba(136, 204, 136, ${pulse})`;
    context.lineWidth = 2;
    context.stroke();
    
    // Draw button text
    context.shadowBlur = 8 * pulse;
    context.fillStyle = "#FFFFFF";
    context.textAlign = "center";
    context.textBaseline = "middle"; // Center text vertically
    const textCenterY = buttonY + buttonHeight / 2 + buttonTextSize * 0.1; // Slight adjustment for visual centering
    context.fillText(buttonText, canvas.width / 2, textCenterY);
    context.textBaseline = "alphabetic"; // Reset to default
    context.restore();
    
    // Draw F11 fullscreen hint for Windows (session-only, with fade)
    drawF11FullscreenHint();
    
    // Draw hamburger menu overlay (dims background) then menu on top
    drawHamburgerMenuOverlay();
    drawHamburgerMenu();
    
    context.restore();
}

function drawF11FullscreenHint() {
    // Only show on Windows platforms and only once per session
    if (!isWindowsPlatform() || hasShownF11Hint) {
        return;
    }
    
    // Initialize start time on first display
    if (f11HintStartTime === null) {
        f11HintStartTime = Date.now();
    }
    
    // Calculate elapsed time and opacity (fade over 5 seconds)
    const elapsed = Date.now() - f11HintStartTime;
    
    if (elapsed >= F11_HINT_DURATION) {
        // Fade complete, mark as shown and don't display again this session
        hasShownF11Hint = true;
        return;
    }
    
    // Calculate fade opacity (1.0 to 0.0 over 5 seconds)
    const fadeProgress = elapsed / F11_HINT_DURATION;
    const opacity = 1.0 - fadeProgress;
    
    // Position in top-right corner with responsive sizing
    const margin = 15;
    const fontSize = Math.min(canvas.width / 32, 16); // Slightly larger: 32 instead of 40, max 16 instead of 14
    
    context.save();
    context.font = `400 ${fontSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = `rgba(180, 180, 180, ${opacity})`; // Light gray with fade
    context.textAlign = "right";
    context.textBaseline = "top";
    
    // Add subtle shadow for better readability
    context.shadowColor = `rgba(0, 0, 0, ${opacity * 0.8})`;
    context.shadowBlur = 2;
    context.shadowOffsetX = 1;
    context.shadowOffsetY = 1;
    
    // Draw the hint text
    context.fillText("Press F11 to toggle fullscreen mode", canvas.width - margin, margin);
    
    context.restore();
}

function drawHamburgerMenuOverlay() {
    // Draw full-screen dim overlay if hamburger menu is open
    if (isHamburgerMenuOpen) {
        context.fillStyle = "rgba(0, 0, 0, 0.6)"; // Semi-transparent black overlay
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawHamburgerMenu() {
    const menuSize = 40;
    const margin = 15;
    const lineHeight = 4;
    const lineSpacing = 8;
    
    // Draw hamburger icon (three horizontal lines)
    context.fillStyle = "#FFFFFF";
    
    // Top line
    context.fillRect(margin + 8, margin + 8, menuSize - 16, lineHeight);
    // Middle line
    context.fillRect(margin + 8, margin + 8 + lineSpacing, menuSize - 16, lineHeight);
    // Bottom line
    context.fillRect(margin + 8, margin + 8 + lineSpacing * 2, menuSize - 16, lineHeight);
    
    // Draw notification badge if there are any pending notifications
    const notificationCount = getNotificationCount();
    if (notificationCount > 0) {
        const badgeSize = 16; // Increased from 8 to 16 for better mobile visibility
        const badgeX = margin + menuSize + 8; // Position to the right of hamburger menu
        const badgeY = margin + (menuSize / 2); // Center vertically with hamburger menu
        
        // Draw red notification dot with glow
        context.save();
        context.shadowColor = "#FF0000";
        context.shadowBlur = 8; // Slightly larger glow for bigger badge
        context.fillStyle = "#FF3333";
        context.beginPath();
        context.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
        context.fill();
        context.restore();
        
        // Draw count number for all notifications (including 1)
        if (notificationCount >= 1) {
            const countFontSize = 12; // Increased from 8 to 12 for better mobile readability
            context.font = `700 ${countFontSize}px 'Roboto Condensed', 'Arial', sans-serif`; // Slightly bolder
            context.fillStyle = "#FFFFFF";
            context.textAlign = "center";
            context.textBaseline = "middle";
            
            // Draw number on top of the red dot
            context.fillText(notificationCount.toString(), badgeX, badgeY);
            
            // Reset text alignment for other text drawing
            context.textAlign = "left";
            context.textBaseline = "alphabetic";
        }
    }
    
    // Draw menu options if menu is open
    if (isHamburgerMenuOpen) {
        const menuX = 15;
        const menuY = 70;
        const optionHeight = 40;
        const optionWidth = 150;
        
        // Use the same menu configuration as the click handler to ensure consistency
        const menuConfig = getCurrentMenuConfig();
        const options = menuConfig.options;
        const gameStates = menuConfig.gameStates;
        const totalOptions = options.length;
        
        // More opaque background for menu panel
        context.fillStyle = "rgba(0, 0, 0, 0.9)"; // Darker background for better contrast
        context.fillRect(menuX, menuY, optionWidth, optionHeight * totalOptions);
        
        // Add subtle border around menu for better definition
        context.strokeStyle = "rgba(255, 255, 255, 0.3)";
        context.lineWidth = 1;
        context.strokeRect(menuX, menuY, optionWidth, optionHeight * totalOptions);
        
        // Menu options
        const isMobile = canvas.width < 600;
        const fontSize = isMobile ? 16 : 18;
        context.font = `400 ${fontSize}px 'Roboto Condensed', 'Arial', sans-serif`;
        context.textAlign = "left";
        
        for (let i = 0; i < options.length; i++) {
            const textY = menuY + (i * optionHeight) + (optionHeight / 2) + 6;
            
            // Highlight current screen
            if (gameStates[i] === currentGameState) {
                // Highlight background for current screen
                context.fillStyle = "rgba(0, 255, 255, 0.3)"; // Brighter cyan highlight
                context.fillRect(menuX, menuY + (i * optionHeight), optionWidth, optionHeight);
                
                // Current screen text color
                context.fillStyle = "#00FFFF"; // Bright cyan
            } else {
                // Normal text color
                context.fillStyle = "#FFFFFF"; // White
            }
            
            context.fillText(options[i], menuX + 10, textY);
            
            // Add authentication status indicator for Cloud Sync option
            if (gameStates[i] === GAME_STATES.CLOUD_SYNC) { // Check by game state instead of index
                const isSignedIn = window.firebaseAuth && window.firebaseAuth.isAuthenticated && window.firebaseAuth.currentUser;
                const indicator = isSignedIn ? "✓" : "✗";
                const indicatorColor = isSignedIn ? "#00FF00" : "#FF0000"; // Green tick or red cross
                
                // Calculate position for indicator (right side of menu)
                const indicatorX = menuX + optionWidth - 25;
                
                // Save current fill style
                const savedFillStyle = context.fillStyle;
                
                // Draw the indicator
                context.fillStyle = indicatorColor;
                context.font = `400 ${fontSize + 2}px 'Roboto Condensed', 'Arial', sans-serif`; // Slightly larger
                context.fillText(indicator, indicatorX, textY);
                
                // Restore previous styles
                context.fillStyle = savedFillStyle;
                context.font = `400 ${fontSize}px 'Roboto Condensed', 'Arial', sans-serif`;
            }
        }
        
        context.textAlign = "center"; // Reset text alignment
    }
}

function drawInstructionsScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw back button (same style as level select screen)
    drawBackButton();
    
    // Title
    const isMobile = canvas.width < 600;
    const titleSize = isMobile ? 28 : 36;
    context.font = `700 ${titleSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#00FFFF";
    context.textAlign = "center";
    context.fillText("INSTRUCTIONS", canvas.width / 2, 80);
    
    // Instructions content
    const instructions = [
        "• Push all crates onto their goal positions",
        "• Use arrow keys or swipe to move",
        "• You can only push crates, not pull them",
        "• Use the undo button to reverse moves",
        "• Keyboard controls: Arrow keys (move), R (restart), U (undo), ESC (back)",
    ];
    
    // Calculate available space and adjust text size to fit
    const startY = 150;
    const endY = canvas.height - 100; // Leave space at bottom
    const availableHeight = endY - startY;
    
    // Calculate text sizing that fits within available height
    let textSize = isMobile ? 22 : 24;
    let lineHeight = textSize * 1.8;
    
    // Estimate total content height
    const textMargin = isMobile ? 40 : 80;
    const baseMaxWidth = canvas.width - (textMargin * 2);
    const maxContentWidth = isMobile ? 
        Math.min(baseMaxWidth, canvas.width * 0.85) : 
        Math.min(baseMaxWidth, 600);
    
    // Calculate approximate total height needed
    const estimatedLinesPerInstruction = 1.5; // Average lines per instruction
    const totalInstructions = instructions.length;
    const estimatedTotalHeight = (totalInstructions * estimatedLinesPerInstruction * lineHeight) + 
                                (totalInstructions * lineHeight * 0.8); // gaps between instructions
    
    // Scale down if content doesn't fit
    if (estimatedTotalHeight > availableHeight) {
        const scaleFactor = availableHeight / estimatedTotalHeight;
        textSize = Math.max(textSize * scaleFactor, isMobile ? 16 : 18); // Minimum readable size
        lineHeight = textSize * 1.6; // Slightly tighter spacing when scaled
    }
    
    context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#CCCCCC";
    
    let yPos = startY;
    for (const instruction of instructions) {
        yPos = drawWrappedText(context, instruction, canvas.width / 2, yPos, maxContentWidth, lineHeight);
        yPos += lineHeight * 0.8; // Gap between different bullet points
    }
    
    // Draw hamburger menu overlay (dims background) then menu on top
    drawHamburgerMenuOverlay();
    drawHamburgerMenu();
}

function drawCreditsScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw back button
    drawBackButton();
    
    // Title
    const isMobile = canvas.width < 600;
    const titleSize = isMobile ? 28 : 36;
    context.font = `700 ${titleSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#00FFFF";
    context.textAlign = "center";
    context.fillText("CREDITS", canvas.width / 2, 80);
    
    // Credits content
    const credits = [
        "Game Design & Programming: Neil Kendall",
        "Sokoban Puzzle Game Concept: Hiroyuki Imabayashi",
        "Spritesheet: Kenney",
        "Level Designs: David W Skinner & Ward De Langhe",
        "Built with HTML5 Canvas & JavaScript",
        "Created in 2025"
    ];
    
    // Calculate available space and adjust text size to fit
    const startY = 150;
    const endY = canvas.height - 100; // Leave space at bottom
    const availableHeight = endY - startY;
    
    // Calculate text sizing that fits within available height
    let textSize = isMobile ? 22 : 24;
    let largeTextSize = isMobile ? 26 : 28;
    let lineHeight = textSize * 1.8;
    let largeLineHeight = largeTextSize * 1.8;
    
    // Calculate text width constraints
    const textMargin = isMobile ? 40 : 80;
    const baseMaxWidth = canvas.width - (textMargin * 2);
    const maxContentWidth = isMobile ? 
        Math.min(baseMaxWidth, canvas.width * 0.85) : 
        Math.min(baseMaxWidth, 600);
    
    // Estimate total content height (first line larger, rest normal)
    const estimatedLinesPerCredit = 1.3; // Average lines per credit
    const totalCredits = credits.length;
    const estimatedTotalHeight = largeLineHeight + (largeLineHeight * 0.8) + // First line + gap
                                ((totalCredits - 1) * estimatedLinesPerCredit * lineHeight) + 
                                ((totalCredits - 1) * lineHeight * 0.6); // gaps between credits
    
    // Scale down if content doesn't fit
    if (estimatedTotalHeight > availableHeight) {
        const scaleFactor = availableHeight / estimatedTotalHeight;
        textSize = Math.max(textSize * scaleFactor, isMobile ? 16 : 18); // Minimum readable size
        largeTextSize = Math.max(largeTextSize * scaleFactor, isMobile ? 18 : 20);
        lineHeight = textSize * 1.6; // Slightly tighter spacing when scaled
        largeLineHeight = largeTextSize * 1.6;
    }
    
    let yPos = startY;
    for (let i = 0; i < credits.length; i++) {
        if (i === 0) {
            // First line - larger and bolder
            context.font = `600 ${largeTextSize}px 'Roboto Condensed', 'Arial', sans-serif`;
            context.fillStyle = "#FFFFFF"; // Brighter white for emphasis
            yPos = drawWrappedText(context, credits[i], canvas.width / 2, yPos, maxContentWidth, largeLineHeight);
            yPos += largeLineHeight * 0.8; // Gap after first line
        } else {
            // Rest of the credits - normal size
            context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
            context.fillStyle = "#CCCCCC";
            yPos = drawWrappedText(context, credits[i], canvas.width / 2, yPos, maxContentWidth, lineHeight);
            yPos += lineHeight * 0.6; // Smaller gap between regular credits
        }
    }
    
    // Draw hamburger menu overlay (dims background) then menu on top
    drawHamburgerMenuOverlay();
    drawHamburgerMenu();
}

function drawCloudSyncScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw back button
    drawBackButton();
    
    // Title
    const isMobile = canvas.width < 600;
    const titleSize = isMobile ? 28 : 36;
    context.font = `700 ${titleSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#00FFFF";
    context.textAlign = "center";
    context.fillText("CLOUD SYNC", canvas.width / 2, 80);
    
    // Cloud sync content
    const textSize = isMobile ? 16 : 20;
    const lineHeight = textSize * 1.5;
    context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#CCCCCC";
    
    let yPos = 140;
    
    // Check authentication status - be more forgiving with initialization
    if (window.firebaseAuth && window.firebaseAuth.isAuthenticated) {
        // User is signed in
        context.fillStyle = "#88CC88"; // Green
        context.fillText("✓ Signed in and syncing", canvas.width / 2, yPos);
        yPos += lineHeight;
        
        // Display user name if available
        if (window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.displayName) {
            context.fillStyle = "#AADDFF"; // Light blue
            context.fillText(`Welcome, ${window.firebaseAuth.currentUser.displayName}`, canvas.width / 2, yPos);
            yPos += lineHeight * 1.5;
        } else if (window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.email) {
            context.fillStyle = "#AADDFF"; // Light blue  
            context.fillText(`Welcome, ${window.firebaseAuth.currentUser.email}`, canvas.width / 2, yPos);
            yPos += lineHeight * 1.5;
        } else {
            yPos += lineHeight;
        }
        
        context.fillStyle = "#CCCCCC";
        context.fillText("Your progress is automatically", canvas.width / 2, yPos);
        yPos += lineHeight;
        context.fillText("backed up to the cloud", canvas.width / 2, yPos);
        yPos += lineHeight * 2;
        
        // Sign out button
        const signOutButtonWidth = 150;
        const signOutButtonHeight = 40;
        const signOutButtonX = (canvas.width - signOutButtonWidth) / 2;
        const signOutButtonY = yPos;
        
        // Button background
        context.fillStyle = "#CC4444";
        context.fillRect(signOutButtonX, signOutButtonY, signOutButtonWidth, signOutButtonHeight);
        
        // Button text
        context.fillStyle = "#FFFFFF";
        context.font = `600 ${textSize - 2}px 'Roboto Condensed', 'Arial', sans-serif`;
        context.fillText("SIGN OUT", canvas.width / 2, signOutButtonY + signOutButtonHeight/2 + 5);
    } else if (window.firebaseAuth === undefined) {
        // Firebase not loaded yet
        context.fillStyle = "#FF6666"; // Red
        context.fillText("🔄 Loading cloud services...", canvas.width / 2, yPos);
    } else {
        // User is not signed in - show different states based on authentication process
        switch (cloudSyncState) {
            case 'not_authenticated':
            default:
                context.fillStyle = "#FFCC00"; // Yellow
                context.fillText("� Sign in to sync your progress", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                context.fillStyle = "#CCCCCC";
                context.fillText("• Never lose your progress", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("• Play on multiple devices", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("• Automatic cloud backup", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                // Sign in button
                const buttonWidth = 220;
                const buttonHeight = 50;
                const buttonX = (canvas.width - buttonWidth) / 2;
                const buttonY = yPos;
                
                // Button background
                context.fillStyle = "#4285F4"; // Google Blue
                context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
                
                // Button text
                context.fillStyle = "#FFFFFF";
                context.font = `600 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
                context.fillText("SIGN IN WITH GOOGLE", canvas.width / 2, buttonY + buttonHeight/2 + 6);
                break;
                
            case 'signing_in':
                context.fillStyle = "#4285F4"; // Google Blue
                context.fillText("🔄 Signing in with Google...", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                context.fillStyle = "#CCCCCC";
                context.fillText("Please complete the sign-in process", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("in the popup window", canvas.width / 2, yPos);
                break;
                
            case 'authenticated':
                context.fillStyle = "#00FF00"; // Green
                context.fillText("✅ Sign-in successful!", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                context.fillStyle = "#CCCCCC";
                context.fillText("You are now signed in and", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("your progress will be synced", canvas.width / 2, yPos);
                break;
                
            case 'error':
                context.fillStyle = "#FF4444"; // Red
                context.fillText("❌ Sign-in failed", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                context.fillStyle = "#CCCCCC";
                context.fillText("This may be due to:", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("• Popup blocked by browser", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("• Domain not authorized in Firebase", canvas.width / 2, yPos);
                yPos += lineHeight;
                context.fillText("• Google Sign-In not enabled", canvas.width / 2, yPos);
                yPos += lineHeight * 2;
                
                // Retry button
                const retryButtonWidth = 220;
                const retryButtonHeight = 50;
                const retryButtonX = (canvas.width - retryButtonWidth) / 2;
                const retryButtonY = yPos;
                
                // Button background
                context.fillStyle = "#4285F4"; // Google Blue
                context.fillRect(retryButtonX, retryButtonY, retryButtonWidth, retryButtonHeight);
                
                // Button text
                context.fillStyle = "#FFFFFF";
                context.font = `600 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
                context.fillText("TRY AGAIN", canvas.width / 2, retryButtonY + retryButtonHeight/2 + 6);
                break;
        }
    }
    
    // Draw hamburger menu overlay (dims background) then menu on top
    drawHamburgerMenuOverlay();
    drawHamburgerMenu();
}

function drawIOSInstallScreen() {
    // Draw background
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw back button
    drawBackButton();
    
    // Title
    const isMobile = canvas.width < 600;
    const titleSize = isMobile ? 28 : 36;
    context.font = `700 ${titleSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#00FFFF";
    context.textAlign = "center";
    context.fillText("📱 INSTALL APP", canvas.width / 2, 80);
    
    // Content
    const textSize = isMobile ? 18 : 22; // Reduced from 22/24 to fit better on mobile
    const lineHeight = textSize * 1.5; // Reduced from 1.8 to 1.5 for tighter spacing
    context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillStyle = "#CCCCCC";
    
    let yPos = 150;
    
    // Calculate maximum text width with responsive constraints (same as instructions)
    const textMargin = isMobile ? 40 : 80;
    const baseMaxWidth = canvas.width - (textMargin * 2);
    const maxContentWidth = isMobile ? 
        Math.min(baseMaxWidth, canvas.width * 0.85) :  // Mobile: 85% of screen width or margin-constrained
        Math.min(baseMaxWidth, 600); // Desktop: 600px max width or margin-constrained
    
    // Benefits section
    context.fillStyle = "#FFFFFF"; // Brighter for emphasis
    context.font = `600 ${textSize + 2}px 'Roboto Condensed', 'Arial', sans-serif`;
    yPos = drawWrappedText(context, "Why install Crate Escape?", canvas.width / 2, yPos, maxContentWidth, lineHeight);
    yPos += lineHeight * 0.8;
    
    // Reset to normal style
    context.fillStyle = "#CCCCCC";
    context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    
    const benefits = [
        "• Full-screen experience without browser UI",
        "• Play offline anytime, anywhere",
        "• Faster loading and better performance", 
        "• Appears on your home screen like a native app",
        "• No address bar or browser controls"
    ];
    
    for (const benefit of benefits) {
        yPos = drawWrappedText(context, benefit, canvas.width / 2, yPos, maxContentWidth, lineHeight);
        yPos += lineHeight * 0.2; // Reduced from 0.4 for tighter spacing
    }
    
    yPos += lineHeight * 0.4; // Reduced from 0.6
    
    // Installation instructions
    context.fillStyle = "#FFFFFF"; // Brighter for emphasis
    context.font = `600 ${textSize + 2}px 'Roboto Condensed', 'Arial', sans-serif`;
    yPos = drawWrappedText(context, "How to install:", canvas.width / 2, yPos, maxContentWidth, lineHeight);
    yPos += lineHeight * 0.8;
    
    // Reset to normal style
    context.fillStyle = "#CCCCCC";
    context.font = `400 ${textSize}px 'Roboto Condensed', 'Arial', sans-serif`;
    
    const instructions = [
        "1. Tap the Share button (⬆️) in Safari",
        "2. Scroll down and tap 'Add to Home Screen'",
        "3. Tap 'Add' to confirm installation",
        "4. Find the app icon on your home screen!"
    ];
    
    for (const instruction of instructions) {
        yPos = drawWrappedText(context, instruction, canvas.width / 2, yPos, maxContentWidth, lineHeight);
        yPos += lineHeight * 0.2; // Reduced from 0.4 for tighter spacing
    }
    
    yPos += lineHeight * 0.8; // Reduced from 1.2
    
    // "Not Interested" button
    const buttonWidth = isMobile ? 180 : 200;
    const buttonHeight = 45;
    const buttonX = (canvas.width - buttonWidth) / 2;
    const buttonY = yPos;
    
    // Button background
    context.fillStyle = "#666666";
    context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button text
    context.fillStyle = "#FFFFFF";
    context.font = `600 ${textSize - 2}px 'Roboto Condensed', 'Arial', sans-serif`;
    context.fillText("NOT INTERESTED", canvas.width / 2, buttonY + buttonHeight/2 + 6);
    
    // Store button bounds for click detection
    window.iosInstallDismissButton = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // Draw hamburger menu overlay (dims background) then menu on top
    drawHamburgerMenuOverlay();
    drawHamburgerMenu();
}

function drawBackButton() {
    const isMobile = canvas.width < 600;
    const buttonSize = isMobile ? 35 : 45;
    const rightMargin = 10;
    
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    
    // Draw back icon with high-quality rendering (same as other PNG icons)
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(backIcon, exitButtonX, exitButtonY, buttonSize, buttonSize);
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
    
    // Second pass: draw the lines with tight internal spacing
    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, currentY);
        if (i < lines.length - 1) {
            // Tight spacing between wrapped lines within the same text block
            currentY += lineHeight * 0.9; // Closer spacing for wrapped lines
        } else {
            // Normal spacing after the last line
            currentY += lineHeight;
        }
    }
    
    // Return the final Y position for continued layout (no extra spacing added here)
    return currentY;
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
    
    // Dim the status bar when overlays have the only active controls
    if (currentGameState === GAME_STATES.SOLUTION_REPLAY || 
        currentGameState === GAME_STATES.LEVEL_COMPLETE || 
        currentGameState === GAME_STATES.PREVIOUSLY_SOLVED) {
        context.fillStyle = "rgba(0, 0, 0, 0.6)"; // Semi-transparent black overlay
        context.fillRect(0, 0, canvas.width, STATUS_BAR_HEIGHT);
    }
    
    // Draw solution button if this level was previously solved
    if (showSolutionButton && currentGameState === GAME_STATES.PLAYING) {
        drawSolutionButton();
    }
}

// Placeholder functions for drawing tiles - YOU CAN MODIFY THESE TO USE SPRITES
function drawFloorTile(x, y) {
    // Use current theme ground sprite
    const sprites = getThemeSprites();
    const sprite = textureAtlas.frames[sprites.ground];
    context.drawImage(
        spriteSheet,
        sprite.x, sprite.y, sprite.width, sprite.height,
        x, y, tileSize, tileSize
    );
}

function drawWallTile(x, y) {
    // Use current theme wall sprite
    const sprites = getThemeSprites();
    const sprite = textureAtlas.frames[sprites.wall];
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
    // Use current theme crate sprites
    const sprites = getThemeSprites();
    let spriteName;
    
    if (isOnGoal) {
        spriteName = sprites.crateOnGoal; // Theme-based sprite for boxes on goals
    } else {
        spriteName = sprites.crate; // Theme-based sprite for boxes not on goals
    }
    
    const sprite = textureAtlas.frames[spriteName];
    
    // Fallback to theme's crateOnGoal sprite if the specified sprite doesn't exist
    if (!sprite) {
        spriteName = sprites.crateOnGoal;
        const fallbackSprite = textureAtlas.frames[spriteName];
        console.log(`Sprite "${spriteName}" not found, using fallback theme crate`);
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
    
    // Third: Draw all UI elements on top of the black background
    
    // Responsive layout based on screen width
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? "bold 14px 'Courier New', monospace" : "bold 18px 'Courier New', monospace";
    
    // Set text properties
    context.font = fontSize;
    context.textAlign = "left";
    
    // Draw buttons (EXIT, RESTART) - removed UNDO from right side
    const buttonSize = isMobile ? 35 : 45; // Square buttons for all buttons
    const buttonSpacing = 8; // Reduced spacing since buttons are smaller
    const rightMargin = 10;
    
    // Calculate number of buttons in status bar (overview button now on playfield)
    const showOverviewButton = levelNeedsPanning || overviewMode; // Show when needed OR when active
    const numButtons = 2; // Exit and restart buttons in status bar (undo moved to center)

    // EXIT button (rightmost - primary action)
    const exitButtonX = canvas.width - buttonSize - rightMargin;
    const exitButtonY = isMobile ? 15 : 10;
    
    // RESTART button (left of EXIT button - secondary action)
    const restartButtonX = exitButtonX - buttonSize - buttonSpacing;
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
    
    const reservedButtonSpace = (buttonSize * 2) + (buttonSpacing * 1) + rightMargin + 20; // Exit + restart buttons only
    
    // Available space for text (excluding button area)
    const availableTextWidth = canvas.width - 30 - reservedButtonSpace; // 15px left + 15px right padding
    
    // New layout: Set name and level number on separate lines, moves/pushes with centered undo
    const setNameText = currentSet;
    const levelNumberText = `Level ${currentLevelNumber}`;
    
    // Use bright yellow for both set name and level number
    const setDisplayText = setNameText; // Remove overview indicator
    const setColor = "#ffff00"; // Bright yellow
    const levelColor = "#ffff00"; // Bright yellow
    
    // Left side: Set name (top) and level number (bottom)
    drawNeonText(setDisplayText, 15, 25, setColor, setColor);
    drawNeonText(levelNumberText, 15, 45, levelColor, levelColor);
    
    // Center area: Move count, UNDO button, Push count
    // Use true canvas center, not adjusted for button area
    const canvasCenterX = canvas.width / 2;
    
    const iconSize = isMobile ? 30 : 40; // Match original icon size
    const iconSpacing = 8; // Original small gap between the two icons
    
    // Detect mobile portrait mode for space optimization
    const isPortrait = canvas.height > canvas.width;
    const isMobilePortrait = isMobile && isPortrait;
    
    // Adjust spacing and font size for mobile portrait to save space
    const numberPadding = isMobilePortrait ? 4 : 12; // Original padding
    
    // Font for move/push counts - match original
    const originalFont = context.font;
    context.font = isMobilePortrait ? "bold 18px 'Courier New', monospace" : (isMobile ? "bold 20px 'Courier New', monospace" : "bold 24px 'Courier New', monospace");
    context.textAlign = "center";
    
    // Calculate text widths for proper positioning
    const moveText = moveCount.toString();
    const pushText = pushCount.toString();
    const moveTextWidth = context.measureText(moveText).width;
    const pushTextWidth = context.measureText(pushText).width;
    
    // Original layout but spread out to make room for undo button in center
    const undoButtonSpacing = buttonSize + 10; // Space needed for undo button plus padding
    
    // Position icons with undo button space in center
    const footprintIconX = canvasCenterX - undoButtonSpacing / 2 - iconSize - iconSpacing / 2;
    const boxIconX = canvasCenterX + undoButtonSpacing / 2 + iconSpacing / 2;
    const iconY = 30; // Original vertical position
    
    // Position numbers relative to the icons (original logic)
    const moveCountX = footprintIconX - numberPadding - moveTextWidth / 2;
    const pushCountX = boxIconX + iconSize + numberPadding + pushTextWidth / 2;
    
    // Position undo button in the center
    const undoButtonX = canvasCenterX - buttonSize / 2;
    const undoButtonY = exitButtonY; // Same vertical position as other buttons
    
    // Draw move count (original positioning)
    drawNeonText(moveText, moveCountX, iconY + 6, "#00aaff", "#00aaff"); // Blue for moves
    
    // Draw push count (original positioning)
    drawNeonText(pushText, pushCountX, iconY + 6, "#00ff00", "#00ff00"); // Green for pushes
    
    // Draw icons at original positions with undo button space
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(footprintLogo, footprintIconX, iconY - iconSize / 2, iconSize, iconSize);
    context.drawImage(pushLogo, boxIconX, iconY - iconSize / 2, iconSize, iconSize);
    context.restore();
    
    // Draw undo button in center
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(undoIcon, undoButtonX, undoButtonY, buttonSize, buttonSize);
    context.restore();
    
    // Restore original font and text alignment
    context.font = originalFont;
    context.textAlign = "left";
    
    // Draw EXIT button (rightmost) - PNG icon with smooth scaling
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(backIcon, exitButtonX, exitButtonY, buttonSize, buttonSize);
    context.restore();
    
    // Draw RESTART button (left of exit button) - PNG icon with smooth scaling
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(restartIcon, restartButtonX, restartButtonY, buttonSize, buttonSize);
    context.restore();
    
    // Draw attempt count in center of restart button
    context.save();
    context.font = isMobile ? "bold 12px 'Courier New', monospace" : "bold 16px 'Courier New', monospace";
    context.fillStyle = "#FF9E0A"; // Orange color
    context.textAlign = "center";
    context.textBaseline = "middle";
    const restartCenterX = restartButtonX + buttonSize / 2;
    const restartCenterY = restartButtonY + buttonSize / 2;
    context.fillText(attemptCount.toString(), restartCenterX, restartCenterY);
    context.restore();
    
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
    const overlayHeight = 260; // Increased height for copy button + 5 lines of text + padding
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
    drawResponsiveText("LEVEL COMPLETE!", centerX, centerY - 60, "#00ff00", 48);
    
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
    
    drawResponsiveText(subtitle, centerX, centerY - 20, subtitleColor, 24);
    
    // Show completion stats with gold neon
    const statsText = `COMPLETED IN ${moveCount} MOVES, ${pushCount} PUSHES (ATTEMPT ${attemptCount})`;
    drawResponsiveText(statsText, centerX, centerY + 20, "#ffdd00", 20);
    
    // Copy Solution button or confirmation message
    if (!solutionCopied) {
        // Show copy button
        const buttonWidth = isMobile ? 140 : 160;
        const buttonHeight = isMobile ? 30 : 35;
        const buttonX = centerX - buttonWidth / 2;
        const buttonY = centerY + 45;
        
        // Store button bounds for click detection (global variables)
        window.copySolutionButtonBounds = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        // Save canvas context state before modifying it
        context.save();
        
        // Draw button background with glow
        context.shadowColor = "#00ff88";
        context.shadowBlur = 15;
        context.fillStyle = "rgba(0, 255, 136, 0.2)";
        context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // Draw button border
        context.strokeStyle = "#00ff88";
        context.lineWidth = 2;
        context.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        context.shadowBlur = 0;
        
        // Draw button text
        const buttonFontSize = isMobile ? 12 : 14;
        context.font = `bold ${buttonFontSize}px 'Courier New', monospace`;
        context.fillStyle = "#00ff88";
        context.textAlign = "center";
        context.fillText("COPY SOLUTION", centerX, buttonY + buttonHeight / 2 + 5);
        
        // Restore canvas context state
        context.restore();
    } else {
        // Show confirmation message
        context.save();
        const confirmFontSize = isMobile ? 14 : 16;
        context.font = `bold ${confirmFontSize}px 'Courier New', monospace`;
        context.fillStyle = "#00ff88";
        context.textAlign = "center";
        context.fillText("SOLUTION COPIED TO CLIPBOARD", centerX, centerY + 65);
        context.restore();
        
        // Clear button bounds since there's no button to click
        window.copySolutionButtonBounds = null;
    }
    
    // Instructions with pulsing effect (save context again for this section)
    context.save();
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
    
    context.fillText(instructText, centerX, centerY + 105);
    
    // Restore context state after instructions
    context.restore();
    
    // Reset text alignment
    context.textAlign = "left";
}

function drawSolutionButton() {
    // Mobile detection for responsive sizing
    const isMobile = canvas.width < 600;
    
    // Button positioning in bottom-left of screen
    const padding = isMobile ? 15 : 20;
    const buttonWidth = isMobile ? 90 : 110;
    const buttonHeight = isMobile ? 40 : 50; // Taller for two lines of text
    const buttonX = padding;
    const buttonY = canvas.height - buttonHeight - padding; // Position at bottom
    
    // Store button bounds for click detection
    window.solutionButtonBounds = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // Draw solution button with neon style
    context.save();
    context.shadowColor = "#00aaff";
    context.shadowBlur = 10;
    context.fillStyle = "rgba(0, 170, 255, 0.2)";
    context.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    context.strokeStyle = "#00aaff";
    context.lineWidth = 2;
    context.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    context.shadowBlur = 0;
    
    // Button text - two lines
    const fontSize = isMobile ? 11 : 13;
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = "#00aaff";
    context.textAlign = "center";
    
    // First line: "VIEW YOUR"
    const lineSpacing = isMobile ? 12 : 14;
    const centerX = buttonX + buttonWidth / 2;
    const centerY = buttonY + buttonHeight / 2;
    context.fillText("VIEW YOUR", centerX, centerY - lineSpacing / 2 + 2);
    
    // Second line: "SOLUTION"
    context.fillText("SOLUTION", centerX, centerY + lineSpacing / 2 + 2);
    
    context.restore();
    
    context.textAlign = "left";
}

function drawPreviouslySolvedOverlay() {
    // Calculate text positioning
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Mobile detection and responsive sizing
    const isMobile = canvas.width < 600;
    const padding = isMobile ? 20 : 40;
    
    // Get level progress data
    const levelKey = `${currentSet}_${currentLevelNumber}`;
    const levelProgressData = levelProgress.get(levelKey);
    const hasSolution = levelProgressData && levelProgressData.solution;
    
    // Calculate overlay height based on content
    const overlayHeight = hasSolution ? 320 : 280; // Taller if has solution for extra button
    const overlayY = centerY - overlayHeight / 2;
    
    // Draw semi-transparent overlay with dark gradient
    const gradient = context.createLinearGradient(0, overlayY, 0, overlayY + overlayHeight);
    gradient.addColorStop(0, "rgba(0, 10, 20, 0.7)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.7)");
    gradient.addColorStop(1, "rgba(20, 0, 20, 0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, overlayY, canvas.width, overlayHeight);
    
    // Draw neon borders at top and bottom
    context.shadowColor = "#ffaa00";
    context.shadowBlur = 10;
    context.fillStyle = "#ffaa00";
    context.fillRect(0, overlayY, canvas.width, 3); // Top border
    context.fillRect(0, overlayY + overlayHeight - 3, canvas.width, 3); // Bottom border
    context.shadowBlur = 0;
    
    // Helper function to draw responsive text
    function drawResponsiveText(text, x, y, color = "#ffaa00", baseFontSize = 24) {
        const fontSize = isMobile ? Math.max(baseFontSize * 0.7, 16) : baseFontSize;
        context.font = `bold ${fontSize}px 'Courier New', monospace`;
        
        let adjustedText = text;
        let textWidth = context.measureText(adjustedText).width;
        const maxWidth = canvas.width - (padding * 2);
        
        if (textWidth > maxWidth) {
            const smallerSize = fontSize * 0.8;
            context.font = `bold ${smallerSize}px 'Courier New', monospace`;
            textWidth = context.measureText(adjustedText).width;
            
            if (textWidth > maxWidth) {
                while (textWidth > maxWidth && adjustedText.length > 10) {
                    adjustedText = adjustedText.slice(0, -4) + "...";
                    textWidth = context.measureText(adjustedText).width;
                }
            }
        }
        
        context.shadowBlur = 0;
        context.fillStyle = color;
        context.fillText(adjustedText, x, y);
        
        return adjustedText;
    }
    
    // Main message
    context.textAlign = "center";
    drawResponsiveText("PREVIOUSLY SOLVED", centerX, centerY - 80, "#ffaa00", 40);
    
    // Show best stats
    if (levelProgressData) {
        const statsText = `BEST: ${levelProgressData.bestMoves || '?'} MOVES, ${levelProgressData.bestPushes || '?'} PUSHES`;
        drawResponsiveText(statsText, centerX, centerY - 40, "#ffdd00", 20);
        
        if (levelProgressData.completionCount > 1) {
            const countText = `COMPLETED ${levelProgressData.completionCount} TIMES`;
            drawResponsiveText(countText, centerX, centerY - 10, "#88ddff", 16);
        }
    }
    
    // Different content based on whether solution exists
    if (hasSolution) {
        // Has solution - show copy solution and replay solution buttons
        
        const buttonWidth = isMobile ? 140 : 160;
        const buttonHeight = isMobile ? 30 : 35;
        const buttonSpacing = 10;
        
        // Copy Solution button (left)
        const copyButtonX = centerX - buttonWidth - buttonSpacing / 2;
        const copyButtonY = centerY + 50;
        
        // Replay Solution button (right)
        const replayButtonX = centerX + buttonSpacing / 2;
        const replayButtonY = centerY + 50;
        
        window.copySavedSolutionButtonBounds = solutionCopiedState ? null : {
            x: copyButtonX,
            y: copyButtonY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        window.replaySolutionButtonBounds = {
            x: replayButtonX,
            y: replayButtonY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        // Clear play again button bounds since it's removed
        window.playAgainButtonBounds = null;
        
        // Draw Copy Solution button or copied state
        context.save();
        const buttonColor = solutionCopiedState ? "#00ff88" : "#ffaa00";
        const buttonText = solutionCopiedState ? "COPIED!" : "COPY SOLUTION";
        
        context.shadowColor = buttonColor;
        context.shadowBlur = 15;
        context.fillStyle = solutionCopiedState ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 170, 0, 0.2)";
        context.fillRect(copyButtonX, copyButtonY, buttonWidth, buttonHeight);
        
        context.strokeStyle = buttonColor;
        context.lineWidth = 2;
        context.strokeRect(copyButtonX, copyButtonY, buttonWidth, buttonHeight);
        context.shadowBlur = 0;
        
        const copyButtonFontSize = isMobile ? 12 : 14;
        context.font = `bold ${copyButtonFontSize}px 'Courier New', monospace`;
        context.fillStyle = buttonColor;
        context.textAlign = "center";
        context.fillText(buttonText, copyButtonX + buttonWidth / 2, copyButtonY + buttonHeight / 2 + 5);
        context.restore();
        
        // Draw Replay Solution button
        context.save();
        context.shadowColor = "#00aaff";
        context.shadowBlur = 15;
        context.fillStyle = "rgba(0, 170, 255, 0.2)";
        context.fillRect(replayButtonX, replayButtonY, buttonWidth, buttonHeight);
        
        context.strokeStyle = "#00aaff";
        context.lineWidth = 2;
        context.strokeRect(replayButtonX, replayButtonY, buttonWidth, buttonHeight);
        context.shadowBlur = 0;
        
        const replayButtonFontSize = isMobile ? 11 : 13;
        context.font = `bold ${replayButtonFontSize}px 'Courier New', monospace`;
        context.fillStyle = "#00aaff";
        context.textAlign = "center";
        context.fillText("REPLAY SOLUTION", replayButtonX + buttonWidth / 2, replayButtonY + buttonHeight / 2 + 5);
        context.restore();
        
    } else {
        // No solution stored - show message only
        drawResponsiveText("No solution stored", centerX, centerY + 20, "#ff8888", 20);
        drawResponsiveText("Solve again to save solution", centerX, centerY + 45, "#ffffff", 16);
        
        // Clear button bounds since there are no buttons in this case
        window.playAgainButtonBounds = null;
        window.copySavedSolutionButtonBounds = null;
        window.replaySolutionButtonBounds = null;
    }
    
    // Back button (always centered below content)
    const backButtonWidth = isMobile ? 100 : 120;
    const backButtonHeight = isMobile ? 25 : 30;
    const backButtonX = centerX - backButtonWidth / 2;
    const backButtonY = hasSolution ? centerY + 100 : centerY + 85;
    
    window.backButtonBounds = {
        x: backButtonX,
        y: backButtonY,
        width: backButtonWidth,
        height: backButtonHeight
    };
    
    // Draw Back button
    context.save();
    context.shadowColor = "#ffffff";
    context.shadowBlur = 10;
    context.fillStyle = "rgba(255, 255, 255, 0.1)";
    context.fillRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight);
    
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.strokeRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight);
    context.shadowBlur = 0;
    
    const backButtonFontSize = isMobile ? 11 : 13;
    context.font = `bold ${backButtonFontSize}px 'Courier New', monospace`;
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.fillText("BACK", backButtonX + backButtonWidth / 2, backButtonY + backButtonHeight / 2 + 4);
    context.restore();
    context.textAlign = "left";
}

function drawSolutionReplayControls() {
    const isMobile = canvas.width < 600;
    
    // Button dimensions (declared early to calculate control bar height)
    const buttonHeight = isMobile ? 30 : 40;
    
    // Control bar at bottom of screen - made taller for better spacing and iOS gesture avoidance
    const controlBarHeight = isMobile ? 80 + (buttonHeight / 2) : 100 + (buttonHeight / 2);
    const controlBarY = canvas.height - controlBarHeight;
    
    // Draw control bar background
    const gradient = context.createLinearGradient(0, controlBarY, 0, canvas.height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.4)");
    gradient.addColorStop(1, "rgba(0, 10, 20, 0.5)");
    context.fillStyle = gradient;
    context.fillRect(0, controlBarY, canvas.width, controlBarHeight);
    
    // Draw neon border at top of control bar
    context.shadowColor = "#00aaff";
    context.shadowBlur = 10;
    context.fillStyle = "#00aaff";
    context.fillRect(0, controlBarY, canvas.width, 2);
    context.shadowBlur = 0;
    
    // Button dimensions
    const buttonWidth = isMobile ? 50 : 65;
    const buttonSpacing = isMobile ? 8 : 10;
    
    // Back button positioned on the left
    const leftMargin = isMobile ? 10 : 15;
    const backButtonX = leftMargin;
    const buttonY = controlBarY + (controlBarHeight - buttonHeight) / 2 + (isMobile ? 5 : 8) - (buttonHeight / 2); // Moved up by half button height
    
    // Center the other 3 main controls (step back, play/pause, step forward)
    const mainButtonsWidth = (buttonWidth * 3) + (buttonSpacing * 2);
    const mainButtonsStartX = (canvas.width - mainButtonsWidth) / 2;
    const stepBackButtonX = mainButtonsStartX;
    const playPauseButtonX = mainButtonsStartX + buttonWidth + buttonSpacing;
    const stepForwardButtonX = mainButtonsStartX + (buttonWidth + buttonSpacing) * 2;
    
    // Store button bounds for click detection
    window.solutionReplayBackButtonBounds = {
        x: backButtonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    window.solutionReplayStepBackButtonBounds = {
        x: stepBackButtonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    window.solutionReplayPlayPauseButtonBounds = {
        x: playPauseButtonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    window.solutionReplayStepForwardButtonBounds = {
        x: stepForwardButtonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // Draw buttons
    drawSolutionReplayButton(backButtonX, buttonY, buttonWidth, buttonHeight, "BACK", "#ffffff");
    
    // Step buttons - enabled when paused, not animating, and within valid range
    const baseEnabled = !solutionReplayData.isPlaying && !isPlayerMoving;
    
    // Step backward - also check if we're not at the beginning
    const stepBackEnabled = baseEnabled && solutionReplayData.currentMoveIndex > 0;
    const stepBackColor = stepBackEnabled ? "#ffaa00" : "#666666";
    drawSolutionReplayButton(stepBackButtonX, buttonY, buttonWidth, buttonHeight, "◄", stepBackColor);
    
    const playPauseText = solutionReplayData.isPlaying ? "PAUSE" : "PLAY";
    const playPauseColor = solutionReplayData.isPlaying ? "#ff6666" : "#00ff88";
    drawSolutionReplayButton(playPauseButtonX, buttonY, buttonWidth, buttonHeight, playPauseText, playPauseColor);
    
    // Step forward - also check if we're not at the end
    const stepForwardEnabled = baseEnabled && solutionReplayData.currentMoveIndex < solutionReplayData.solution.length;
    const stepForwardColor = stepForwardEnabled ? "#ffaa00" : "#666666";
    drawSolutionReplayButton(stepForwardButtonX, buttonY, buttonWidth, buttonHeight, "►", stepForwardColor);
    
    // Draw progress info - positioned in the space above the moved-up buttons
    const progressY = buttonY - (isMobile ? 8 : 12); // Position above buttons with some spacing
    context.font = `bold ${isMobile ? 12 : 16}px 'Courier New', monospace`;
    context.fillStyle = "#00aaff";
    context.textAlign = "center";
    
    const currentMove = getCurrentReplayMoveNumber();
    const totalMoves = solutionReplayData.solution.length;
    const progressText = `MOVE ${currentMove} / ${totalMoves}`;
    
    context.fillText(progressText, canvas.width / 2, progressY);
    context.textAlign = "left";
}

function drawSolutionReplayButton(x, y, width, height, text, color) {
    context.save();
    
    // Button background
    context.shadowColor = color;
    context.shadowBlur = 10;
    context.fillStyle = `${color}33`; // Semi-transparent version
    context.fillRect(x, y, width, height);
    
    // Button border
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.shadowBlur = 0;
    
    // Button text
    const isMobile = canvas.width < 600;
    const fontSize = isMobile ? 10 : 12;
    context.font = `bold ${fontSize}px 'Courier New', monospace`;
    context.fillStyle = color;
    context.textAlign = "center";
    context.fillText(text, x + width / 2, y + height / 2 + 4);
    
    context.restore();
}

function getCurrentReplayMoveNumber() {
    return solutionReplayData.currentMoveIndex;
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

    // Draw back button (same as exit button in gameplay) - just the PNG icon
    const buttonSize = isMobile ? 35 : 45; // Same size as gameplay exit button
    const exitButtonX = canvas.width - buttonSize - 10;
    const exitButtonY = isMobile ? 15 : 10; // Match gameplay positioning exactly
    
    // Draw backIcon.png with smooth scaling
    context.save();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(backIcon, exitButtonX, exitButtonY, buttonSize, buttonSize);
    context.restore();

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
            
            // Check if this level has been previously solved
            const levelKey = `${currentSet}_${currentLevelNumber}`;
            const levelProgressData = levelProgress.get(levelKey);
            
            if (levelProgressData && levelProgressData.completed) {
                // Level was previously completed - show solution button during gameplay
                showSolutionButton = true;
                currentGameState = GAME_STATES.PLAYING;
            } else {
                // New or unsolved level - go straight to playing
                showSolutionButton = false;
                currentGameState = GAME_STATES.PLAYING;
            }
            
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
                
                // Check if this level has been previously solved
                const levelKey = `${currentSet}_${currentLevelNumber}`;
                const levelProgressData = levelProgress.get(levelKey);
                
                if (levelProgressData && levelProgressData.completed) {
                    // Level was previously completed - show solution button during gameplay
                    showSolutionButton = true;
                    currentGameState = GAME_STATES.PLAYING;
                } else {
                    // New or unsolved level - go straight to playing
                    showSolutionButton = false;
                    currentGameState = GAME_STATES.PLAYING;
                }
                
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
    
    // Check if this level has been previously solved
    const levelKey = `${currentSet}_${currentLevelNumber}`;
    const levelProgressData = levelProgress.get(levelKey);
    
    if (levelProgressData && levelProgressData.completed) {
        // Level was previously completed - show solution button during gameplay
        solutionCopiedState = false; // Reset copied state
        showSolutionButton = true;
        currentGameState = GAME_STATES.PLAYING;
    } else {
        // New or unsolved level - go straight to playing
        showSolutionButton = false;
        currentGameState = GAME_STATES.PLAYING;
    }
    
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
            
            // Create object store for UI settings/preferences
            if (!db.objectStoreNames.contains('settings')) {
                const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
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
                    completed: record.completed,
                    bestMoves: record.bestMoves,
                    bestPushes: record.bestPushes,
                    completionCount: record.completionCount,
                    solution: record.solution
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
        let solution = existing?.solution || null;
        
        // If completing the level, update best scores and increment completion count
        if (completed && moves !== null && pushes !== null) {
            let shouldUpdateSolution = false;
            
            // Special case: Legacy data without solution string
            // Store current performance and solution together to ensure they match
            if (solution === null && (bestMoves !== null || bestPushes !== null)) {
                bestMoves = moves;
                bestPushes = pushes;
                shouldUpdateSolution = true;
            }
            // Normal case: Update best moves if this is better (or first completion)
            else if (bestMoves === null || moves < bestMoves) {
                bestMoves = moves;
                shouldUpdateSolution = true;
            }
            
            // Normal case: Update best pushes if this is better (or first completion)  
            if (bestPushes === null || pushes < bestPushes) {
                bestPushes = pushes;
                shouldUpdateSolution = true;
            }
            
            // If no solution exists yet (first completion), store it
            if (solution === null) {
                shouldUpdateSolution = true;
            }
            
            // Store/update solution if performance improved or first completion
            if (shouldUpdateSolution) {
                solution = generateSolutionString();
            }
            
            // Increment completion count on every completion
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
            solution: solution,
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
            completionCount,
            solution
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
    
    // Upload progress to cloud if user is authenticated
    if (window.firebaseAuth && window.firebaseAuth.isAuthenticated) {
        // Don't await this to avoid blocking level completion
        uploadGameProgress().catch(error => {
            console.error('Failed to upload progress after level completion:', error);
        });
    }
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

// Save UI settings to IndexedDB
async function saveSetting(key, value) {
    if (!progressDB) return;
    
    try {
        const transaction = progressDB.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        await store.put({ key: key, value: value });
    } catch (error) {
        console.error('Failed to save setting:', error);
    }
}

// Load UI setting from IndexedDB
async function loadSetting(key, defaultValue = null) {
    if (!progressDB) return defaultValue;
    
    try {
        return new Promise((resolve, reject) => {
            const transaction = progressDB.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.value);
                } else {
                    resolve(defaultValue);
                }
            };
            
            request.onerror = () => {
                console.error('Failed to load setting:', request.error);
                resolve(defaultValue);
            };
        });
    } catch (error) {
        console.error('Failed to load setting:', error);
        return defaultValue;
    }
}

// #region Solution Replay Functions

function startSolutionReplay(solutionString) {
    // Reset the level to its original state WITHOUT incrementing attempt counter
    // Store current attempt count to restore it
    const currentAttemptCount = attemptCount;
    
    // Use the standard restart but restore the attempt counter
    restartCurrentLevel();
    attemptCount = currentAttemptCount; // Restore original count
    
    // Set up the solution replay data
    solutionReplayData.solution = solutionString;
    solutionReplayData.currentMoveIndex = 0;
    solutionReplayData.isActive = true;
    solutionReplayData.isPlaying = false; // Start paused
    solutionReplayData.simulatedContinuousDirection = null; // Clear simulated continuous input
    solutionReplayData.shouldClearContinuousAfterMove = false; // Clear flag
    
    // Switch to solution replay state
    currentGameState = GAME_STATES.SOLUTION_REPLAY;
    
    // Clear any existing interval
    if (solutionReplayData.intervalId) {
        clearInterval(solutionReplayData.intervalId);
        solutionReplayData.intervalId = null;
    }
}

function toggleSolutionReplayPlayback() {
    if (!solutionReplayData.isActive) return;
    
    solutionReplayData.isPlaying = !solutionReplayData.isPlaying;
    
    if (solutionReplayData.isPlaying) {
        startReplayInterval();
    } else {
        if (solutionReplayData.intervalId) {
            clearInterval(solutionReplayData.intervalId);
            solutionReplayData.intervalId = null;
        }
        // Clear simulated continuous direction when paused to stop animation
        solutionReplayData.simulatedContinuousDirection = null;
        solutionReplayData.shouldClearContinuousAfterMove = false;
    }
}

function startReplayInterval() {
    if (solutionReplayData.intervalId) {
        clearInterval(solutionReplayData.intervalId);
    }
    
    solutionReplayData.intervalId = setInterval(() => {
        executeNextReplayMove();
    }, solutionReplayData.moveDelay);
}

function executeNextReplayMove() {
    if (!solutionReplayData.isActive || !solutionReplayData.isPlaying) return;
    
    // Don't execute next move if player is currently moving
    if (isPlayerMoving) return;
    
    // Check if we're at the end
    if (solutionReplayData.currentMoveIndex >= solutionReplayData.solution.length) {
        // Solution complete
        completeSolutionReplay();
        return;
    }
    
    // Get the current character from the solution string
    const currentChar = solutionReplayData.solution[solutionReplayData.currentMoveIndex];
    const direction = getDirectionFromChar(currentChar);
    
    if (direction) {
        // Directly attempt the move (continuous direction logic now handled in startPlayerMove)
        const moveSuccessful = attemptPlayerMove(direction);
        
        if (moveSuccessful) {
            // Move to next character in solution
            solutionReplayData.currentMoveIndex++;
        } else {
            // Move failed - this shouldn't happen with a valid solution
            console.warn('Solution replay move failed:', direction, 'at move', solutionReplayData.currentMoveIndex);
            solutionReplayData.simulatedContinuousDirection = null;
            solutionReplayData.shouldClearContinuousAfterMove = false;
            completeSolutionReplay();
        }
    }
}

function getDirectionFromChar(dirChar) {
    switch(dirChar.toUpperCase()) {
        case 'L': return { x: -1, y: 0 };
        case 'R': return { x: 1, y: 0 };
        case 'U': return { x: 0, y: -1 };
        case 'D': return { x: 0, y: 1 };
        default: return null;
    }
}

function stepSolutionReplayForward() {
    if (!solutionReplayData.isActive) return;
    
    // Pause if playing
    if (solutionReplayData.isPlaying) {
        solutionReplayData.isPlaying = false;
        if (solutionReplayData.intervalId) {
            clearInterval(solutionReplayData.intervalId);
            solutionReplayData.intervalId = null;
        }
    }
    
    // Don't execute if player is currently moving
    if (isPlayerMoving) return;
    
    // Check if we're at the end
    if (solutionReplayData.currentMoveIndex >= solutionReplayData.solution.length) {
        // Solution complete
        return;
    }
    
    // Get the current character from the solution string
    const currentChar = solutionReplayData.solution[solutionReplayData.currentMoveIndex];
    const direction = getDirectionFromChar(currentChar);
    
    if (direction) {
        // Directly attempt the move (continuous direction logic now handled in startPlayerMove)
        const moveSuccessful = attemptPlayerMove(direction);
        
        if (moveSuccessful) {
            // Move to next character in solution
            solutionReplayData.currentMoveIndex++;
            
            // Since we're stepping manually (paused), clear any continuous animation that was set up
            // The move is complete and we want to stop at this position
            solutionReplayData.simulatedContinuousDirection = null;
            solutionReplayData.shouldClearContinuousAfterMove = false;
        } else {
            // Move failed - this shouldn't happen with a valid solution
            console.warn('Solution replay move failed:', direction, 'at move', solutionReplayData.currentMoveIndex);
            solutionReplayData.simulatedContinuousDirection = null;
        }
    }
}

function stepSolutionReplayBackward() {
    if (!solutionReplayData.isActive) return;
    
    // Don't allow step backward if player is currently moving (animation in progress)
    if (isPlayerMoving) return;
    
    // Pause if playing
    if (solutionReplayData.isPlaying) {
        solutionReplayData.isPlaying = false;
        if (solutionReplayData.intervalId) {
            clearInterval(solutionReplayData.intervalId);
            solutionReplayData.intervalId = null;
        }
    }
    
    // Can't go back if we're at the beginning
    if (solutionReplayData.currentMoveIndex <= 0) return;
    
    // Clear simulated continuous input when stepping backward
    solutionReplayData.simulatedContinuousDirection = null;
    solutionReplayData.shouldClearContinuousAfterMove = false;
    
    // Use the existing undo system - it's already perfect!
    undoLastMove();
    
    // Update our move counter to match
    solutionReplayData.currentMoveIndex--;
}

function completeSolutionReplay() {
    solutionReplayData.isPlaying = false;
    if (solutionReplayData.intervalId) {
        clearInterval(solutionReplayData.intervalId);
        solutionReplayData.intervalId = null;
    }
    
    // Clear simulated continuous input
    solutionReplayData.simulatedContinuousDirection = null;
    solutionReplayData.shouldClearContinuousAfterMove = false;
    
    // Show completion message briefly, then return to controls
    // Don't trigger normal level completion logic
}

function exitSolutionReplay() {
    // Stop any ongoing playback
    solutionReplayData.isPlaying = false;
    solutionReplayData.isActive = false;
    
    if (solutionReplayData.intervalId) {
        clearInterval(solutionReplayData.intervalId);
        solutionReplayData.intervalId = null;
    }
    
    // Return to previously solved overlay
    currentGameState = GAME_STATES.PREVIOUSLY_SOLVED;
}

// #endregion

// #endregion

// #endregion
