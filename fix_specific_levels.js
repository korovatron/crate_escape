// Script to fix individual Microban levels that have conversion errors
const fs = require('fs');

function fixMicrobanLevels() {
    // Read the correct Microban levels
    const microbanContent = fs.readFileSync('Microban Levels.txt', 'utf8');
    const lines = microbanContent.split('\n').map(line => line.replace('\r', ''));
    
    // Parse the correct Microban levels
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
    
    console.log(`Parsed ${correctLevels.length} correct Microban levels`);
    
    // Read current levels.js
    let content = fs.readFileSync('levels.js', 'utf8');
    
    // Fix Level 4
    const level4Correct = correctLevels[3]; // 0-indexed
    console.log('Fixing Level 4:');
    level4Correct.forEach(row => console.log(row));
    
    const level4Pattern = /(\s+\/\/ Level 4\s+\[\s+)([\s\S]*?)(\s+\],)/;
    const level4Replacement = '$1' + level4Correct.map(row => `            "${row}",\n`).join('').slice(0, -1) + '\n$3';
    content = content.replace(level4Pattern, level4Replacement);
    
    // Fix Level 5
    const level5Correct = correctLevels[4]; // 0-indexed
    console.log('\nFixing Level 5:');
    level5Correct.forEach(row => console.log(row));
    
    const level5Pattern = /(\s+\/\/ Level 5\s+\[\s+)([\s\S]*?)(\s+\],)/;
    const level5Replacement = '$1' + level5Correct.map(row => `            "${row}",\n`).join('').slice(0, -1) + '\n$3';
    content = content.replace(level5Pattern, level5Replacement);
    
    // Write the file
    fs.writeFileSync('levels.js', content);
    console.log('\nSuccessfully fixed Microban levels 4 and 5!');
}

fixMicrobanLevels();
