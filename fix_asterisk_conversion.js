const fs = require('fs');

// Read the original Microban levels
const originalContent = fs.readFileSync('Microban Levels.txt', 'utf8');

// Read the JavaScript levels file
const jsContent = fs.readFileSync('levels.js', 'utf8');

// Parse original levels
function parseOriginalLevels() {
    const lines = originalContent.split('\n');
    const levels = [];
    let currentLevel = null;
    let currentLevelLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.match(/^Level \d+/)) {
            // Save previous level if exists
            if (currentLevel && currentLevelLines.length > 0) {
                levels.push({
                    number: currentLevel,
                    lines: currentLevelLines.filter(l => l.trim() !== '')
                });
            }
            
            currentLevel = parseInt(line.match(/\d+/)[0]);
            currentLevelLines = [];
        } else if (line.startsWith("'") || line.startsWith('"')) {
            // Skip title lines
            continue;
        } else if (line.length > 0 && (line.includes('#') || line.includes(' ') || line.includes('$') || line.includes('@') || line.includes('.') || line.includes('*'))) {
            currentLevelLines.push(line);
        }
    }
    
    // Don't forget the last level
    if (currentLevel && currentLevelLines.length > 0) {
        levels.push({
            number: currentLevel,
            lines: currentLevelLines.filter(l => l.trim() !== '')
        });
    }
    
    return levels;
}

// Extract JavaScript levels
function extractJsLevels() {
    const levels = [];
    const lines = jsContent.split('\n');
    let currentLevel = null;
    let currentLevelLines = [];
    let inLevel = false;
    let bracketDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine.match(/\/\/ Level (\d+)/)) {
            // Save previous level if exists
            if (currentLevel && currentLevelLines.length > 0) {
                levels.push({
                    number: currentLevel,
                    lines: currentLevelLines
                });
            }
            
            currentLevel = parseInt(trimmedLine.match(/\d+/)[0]);
            currentLevelLines = [];
            inLevel = false;
            bracketDepth = 0;
        } else if (trimmedLine === '[' && currentLevel && !inLevel) {
            inLevel = true;
            bracketDepth = 1;
        } else if (inLevel) {
            if (trimmedLine.includes('[')) {
                bracketDepth++;
            }
            if (trimmedLine.includes(']')) {
                bracketDepth--;
                if (bracketDepth === 0) {
                    inLevel = false;
                }
            }
            
            // Extract quoted strings
            if (trimmedLine.startsWith('"') && (trimmedLine.endsWith('",') || trimmedLine.endsWith('"'))) {
                let content;
                if (trimmedLine.endsWith('",')) {
                    content = trimmedLine.slice(1, -2); // Remove quotes and comma
                } else {
                    content = trimmedLine.slice(1, -1); // Remove quotes
                }
                currentLevelLines.push(content);
            }
        }
    }
    
    // Don't forget the last level
    if (currentLevel && currentLevelLines.length > 0) {
        levels.push({
            number: currentLevel,
            lines: currentLevelLines
        });
    }
    
    return levels;
}

// Find levels with asterisk conversion issues
function findAsteriskIssues() {
    const originalLevels = parseOriginalLevels();
    const jsLevels = extractJsLevels();
    
    console.log(`Found ${originalLevels.length} original levels`);
    console.log(`Found ${jsLevels.length} JavaScript levels`);
    
    const issues = [];
    const debugLog = [];
    
    for (const originalLevel of originalLevels) {
        const jsLevel = jsLevels.find(js => js.number === originalLevel.number);
        
        if (!jsLevel) {
            debugLog.push(`No JavaScript level found for Level ${originalLevel.number}`);
            continue;
        }
        
        // Check if original has asterisks
        const originalHasAsterisks = originalLevel.lines.some(line => line.includes('*'));
        
        if (originalHasAsterisks) {
            debugLog.push(`Level ${originalLevel.number} has asterisks in original`);
            debugLog.push(`  Original lines: ${originalLevel.lines.length}, JS lines: ${jsLevel.lines.length}`);
            
            // Check each line for asterisk->period conversion
            const lineIssues = [];
            
            for (let i = 0; i < Math.min(originalLevel.lines.length, jsLevel.lines.length); i++) {
                const originalLine = originalLevel.lines[i];
                const jsLine = jsLevel.lines[i];
                
                if (originalLevel.number <= 5) {
                    debugLog.push(`  Line ${i}: Original="${originalLine}" JS="${jsLine}"`);
                }
                
                // Check if this line had asterisks that became periods
                if (originalLine.includes('*')) {
                    // Find positions where asterisks were converted to periods
                    for (let j = 0; j < originalLine.length && j < jsLine.length; j++) {
                        if (originalLine[j] === '*' && jsLine[j] === '.') {
                            lineIssues.push({
                                lineIndex: i,
                                position: j,
                                original: originalLine,
                                converted: jsLine,
                                expected: originalLine // Keep asterisk as-is
                            });
                        }
                    }
                }
            }
            
            if (lineIssues.length > 0) {
                issues.push({
                    levelNumber: originalLevel.number,
                    lineIssues: lineIssues
                });
            }
        }
    }
    
    // Print debug log for first few levels
    console.log("\n=== DEBUG LOG (First 10 levels) ===");
    debugLog.slice(0, 30).forEach(log => console.log(log));
    
    return issues;
}

// Generate fixes
function generateFixes() {
    const issues = findAsteriskIssues();
    
    console.log(`\n=== ASTERISK CONVERSION ISSUES FOUND ===`);
    console.log(`Found ${issues.length} levels with asterisk->period conversion errors:\n`);
    
    for (const issue of issues) {
        console.log(`Level ${issue.levelNumber}:`);
        for (const lineIssue of issue.lineIssues) {
            console.log(`  Line ${lineIssue.lineIndex + 1}:`);
            console.log(`    Original:  "${lineIssue.original}"`);
            console.log(`    Converted: "${lineIssue.converted}"`);
            console.log(`    Should be: "${lineIssue.expected}"`);
        }
        console.log('');
    }
    
    return issues;
}

// Run the analysis
generateFixes();
