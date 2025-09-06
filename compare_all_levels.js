// Script to compare all 155 Microban levels between levels.js and Microban Levels.txt
const fs = require('fs');

function compareAllMicrobanLevels() {
    // Parse the correct Microban levels from text file
    console.log('Parsing Microban Levels.txt...');
    const microbanContent = fs.readFileSync('Microban Levels.txt', 'utf8');
    const lines = microbanContent.split('\n').map(line => line.replace('\r', ''));
    
    const correctLevels = [];
    let currentLevel = [];
    let inLevel = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.match(/^Level \d+$/)) {
            if (inLevel && currentLevel.length > 0) {
                correctLevels.push([...currentLevel]);
            }
            currentLevel = [];
            inLevel = true;
            continue;
        }
        
        if (inLevel) {
            if (line.trim() === '' && currentLevel.length === 0) {
                continue;
            }
            
            if (line.trim() === '' && currentLevel.length > 0) {
                let j = i + 1;
                while (j < lines.length && lines[j].trim() === '') {
                    j++;
                }
                if (j < lines.length && lines[j].match(/^Level \d+$/)) {
                    correctLevels.push([...currentLevel]);
                    currentLevel = [];
                    inLevel = false;
                    continue;
                }
            }
            
            if (line.trim() !== '') {
                currentLevel.push(line);
            }
        }
    }
    
    if (inLevel && currentLevel.length > 0) {
        correctLevels.push([...currentLevel]);
    }
    
    console.log(`Found ${correctLevels.length} levels in Microban Levels.txt`);
    
    // Parse the current levels from levels.js
    console.log('Parsing levels.js...');
    const levelsContent = fs.readFileSync('levels.js', 'utf8');
    
    // Extract just the Microban levels from the JavaScript file
    const microbanStart = levelsContent.indexOf('    Microban: [');
    const microbanEnd = levelsContent.indexOf('    ],', microbanStart);
    
    if (microbanStart === -1 || microbanEnd === -1) {
        console.error('Could not find Microban section in levels.js');
        return;
    }
    
    const microbanSection = levelsContent.substring(microbanStart, microbanEnd);
    
    // Parse each level from the JavaScript format
    const currentLevels = [];
    
    // Find all level blocks using a more robust regex
    const levelRegex = /\/\/ Level \d+\s*\[\s*((?:\s*"[^"]*",?\s*)*)\s*\]/g;
    let match;
    
    while ((match = levelRegex.exec(microbanSection)) !== null) {
        const levelContent = match[1];
        // Extract all quoted strings from this level
        const rows = levelContent.match(/"([^"]*)"/g);
        if (rows) {
            const level = rows.map(row => row.slice(1, -1)); // Remove quotes
            currentLevels.push(level);
        }
    }
    
    // If the regex approach didn't work, try a simpler line-by-line approach
    if (currentLevels.length === 0) {
        console.log('Trying alternative parsing method...');
        const lines = microbanSection.split('\n');
        let currentLevel = [];
        let inLevel = false;
        
        for (const line of lines) {
            if (line.includes('// Level')) {
                if (currentLevel.length > 0) {
                    currentLevels.push([...currentLevel]);
                }
                currentLevel = [];
                inLevel = true;
                continue;
            }
            
            if (inLevel && line.includes('"')) {
                const match = line.match(/"([^"]*)"/);
                if (match) {
                    currentLevel.push(match[1]);
                }
            }
            
            if (inLevel && line.includes('],')) {
                if (currentLevel.length > 0) {
                    currentLevels.push([...currentLevel]);
                    currentLevel = [];
                }
                inLevel = false;
            }
        }
        
        // Don't forget the last level
        if (currentLevel.length > 0) {
            currentLevels.push(currentLevel);
        }
    }
    
    console.log(`Found ${currentLevels.length} levels in levels.js Microban section`);
    
    // Compare all levels
    const errors = [];
    const maxLevels = Math.min(correctLevels.length, currentLevels.length);
    
    for (let i = 0; i < maxLevels; i++) {
        const correctLevel = correctLevels[i];
        const currentLevel = currentLevels[i];
        
        // Compare dimensions
        if (correctLevel.length !== currentLevel.length) {
            errors.push({
                level: i + 1,
                type: 'dimension_mismatch',
                message: `Height mismatch: correct=${correctLevel.length}, current=${currentLevel.length}`
            });
            continue;
        }
        
        // Compare each row
        let levelHasError = false;
        for (let row = 0; row < correctLevel.length; row++) {
            if (correctLevel[row] !== currentLevel[row]) {
                if (!levelHasError) {
                    errors.push({
                        level: i + 1,
                        type: 'content_mismatch',
                        correct: correctLevel,
                        current: currentLevel
                    });
                    levelHasError = true;
                }
            }
        }
    }
    
    // Check if level counts match
    if (correctLevels.length !== currentLevels.length) {
        console.log(`\nWARNING: Level count mismatch!`);
        console.log(`Correct file has ${correctLevels.length} levels`);
        console.log(`Current file has ${currentLevels.length} levels`);
    }
    
    // Report results
    console.log(`\n=== COMPARISON RESULTS ===`);
    console.log(`Total levels compared: ${maxLevels}`);
    console.log(`Levels with errors: ${errors.length}`);
    
    if (errors.length === 0) {
        console.log(`\n🎉 ALL LEVELS MATCH! No conversion errors found.`);
    } else {
        console.log(`\n❌ Found ${errors.length} levels with errors:`);
        
        for (const error of errors) {
            console.log(`\n--- Level ${error.level} ---`);
            if (error.type === 'dimension_mismatch') {
                console.log(error.message);
            } else {
                console.log('CORRECT version:');
                error.correct.forEach((row, idx) => console.log(`${(idx + 1).toString().padStart(2)}: ${row}`));
                console.log('\nCURRENT version:');
                error.current.forEach((row, idx) => console.log(`${(idx + 1).toString().padStart(2)}: ${row}`));
                console.log('');
            }
        }
        
        // Generate fix script
        console.log('\\nGenerating fix script...');
        generateFixScript(errors, correctLevels);
    }
}

function generateFixScript(errors, correctLevels) {
    let fixScript = `// Auto-generated script to fix all Microban level errors
const fs = require('fs');

function fixAllMicrobanErrors() {
    let content = fs.readFileSync('levels.js', 'utf8');
    
`;

    for (const error of errors) {
        if (error.type === 'content_mismatch') {
            const levelNum = error.level;
            const correctLevel = correctLevels[levelNum - 1];
            
            fixScript += `    // Fix Level ${levelNum}\n`;
            fixScript += `    const level${levelNum}Pattern = /(\\s+\\/\\/ Level ${levelNum}\\s+\\[\\s+)([\\s\\S]*?)(\\s+\\],)/;\n`;
            fixScript += `    const level${levelNum}Replacement = '$1' + [\n`;
            
            for (const row of correctLevel) {
                fixScript += `        "${row}",\n`;
            }
            
            fixScript += `    ].map(row => \`            "\${row}",\\n\`).join('').slice(0, -1) + '\\n$3';\n`;
            fixScript += `    content = content.replace(level${levelNum}Pattern, level${levelNum}Replacement);\n\n`;
        }
    }

    fixScript += `    fs.writeFileSync('levels.js', content);
    console.log('All Microban level errors have been fixed!');
}

fixAllMicrobanErrors();`;

    fs.writeFileSync('fix_all_microban_errors.js', fixScript);
    console.log('Fix script saved as: fix_all_microban_errors.js');
    console.log('Run with: node fix_all_microban_errors.js');
}

compareAllMicrobanLevels();
