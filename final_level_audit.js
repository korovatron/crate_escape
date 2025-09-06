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

// Find all formatting differences
function findAllDifferences() {
    const originalLevels = parseOriginalLevels();
    const jsLevels = extractJsLevels();
    
    console.log(`=== COMPREHENSIVE LEVEL COMPARISON ===`);
    console.log(`Found ${originalLevels.length} original levels`);
    console.log(`Found ${jsLevels.length} JavaScript levels`);
    
    const differences = [];
    
    for (const originalLevel of originalLevels) {
        const jsLevel = jsLevels.find(js => js.number === originalLevel.number);
        
        if (!jsLevel) {
            differences.push({
                type: 'MISSING_LEVEL',
                levelNumber: originalLevel.number,
                details: 'Level not found in JavaScript file'
            });
            continue;
        }
        
        // Check line count differences
        if (originalLevel.lines.length !== jsLevel.lines.length) {
            differences.push({
                type: 'LINE_COUNT_MISMATCH',
                levelNumber: originalLevel.number,
                details: `Original: ${originalLevel.lines.length} lines, JS: ${jsLevel.lines.length} lines`
            });
        }
        
        // Check each line for exact differences
        const maxLines = Math.max(originalLevel.lines.length, jsLevel.lines.length);
        for (let i = 0; i < maxLines; i++) {
            const originalLine = originalLevel.lines[i] || '';
            const jsLine = jsLevel.lines[i] || '';
            
            if (originalLine !== jsLine) {
                differences.push({
                    type: 'LINE_CONTENT_MISMATCH',
                    levelNumber: originalLevel.number,
                    lineNumber: i + 1,
                    original: originalLine,
                    converted: jsLine,
                    details: `Line ${i + 1} differs`
                });
            }
        }
    }
    
    // Summarize results
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total differences found: ${differences.length}`);
    
    const byType = {};
    differences.forEach(diff => {
        byType[diff.type] = (byType[diff.type] || 0) + 1;
    });
    
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
    });
    
    // Show first 20 differences in detail
    console.log(`\n=== DETAILED DIFFERENCES (First 20) ===`);
    differences.slice(0, 20).forEach(diff => {
        console.log(`\nLevel ${diff.levelNumber} - ${diff.type}`);
        if (diff.lineNumber) {
            console.log(`  Line ${diff.lineNumber}:`);
            console.log(`    Original:  "${diff.original}"`);
            console.log(`    Converted: "${diff.converted}"`);
        } else {
            console.log(`  ${diff.details}`);
        }
    });
    
    if (differences.length > 20) {
        console.log(`\n... and ${differences.length - 20} more differences.`);
    }
    
    return differences;
}

// Run the analysis
findAllDifferences();
