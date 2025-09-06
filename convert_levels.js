// Script to properly convert Microban Levels.txt to levels.js format
const fs = require('fs');

function parseMicrobanLevels() {
    // Read the source file
    const content = fs.readFileSync('Microban Levels.txt', 'utf8');
    const lines = content.split('\n').map(line => line.replace('\r', ''));
    
    const levels = [];
    let currentLevel = [];
    let inLevel = false;
    let levelNumber = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if this line starts a new level
        if (line.match(/^Level \d+$/)) {
            // If we were already in a level, save the previous one
            if (inLevel && currentLevel.length > 0) {
                levels.push([...currentLevel]);
            }
            
            // Start new level
            levelNumber++;
            currentLevel = [];
            inLevel = true;
            continue;
        }
        
        // If we're in a level, collect the level data
        if (inLevel) {
            // Skip empty lines between level header and level data
            if (line.trim() === '' && currentLevel.length === 0) {
                continue;
            }
            
            // If we hit another empty line after we have level data, or we reach the end
            // this indicates the end of the current level
            if (line.trim() === '' && currentLevel.length > 0) {
                // Check if the next non-empty line is a new level
                let j = i + 1;
                while (j < lines.length && lines[j].trim() === '') {
                    j++;
                }
                if (j < lines.length && lines[j].match(/^Level \d+$/)) {
                    // This empty line marks the end of current level
                    levels.push([...currentLevel]);
                    currentLevel = [];
                    inLevel = false;
                    continue;
                }
            }
            
            // Add non-empty lines to current level
            if (line.trim() !== '') {
                currentLevel.push(line);
            }
        }
    }
    
    // Don't forget the last level
    if (inLevel && currentLevel.length > 0) {
        levels.push([...currentLevel]);
    }
    
    console.log(`Parsed ${levels.length} levels`);
    
    // Generate the JavaScript file
    let jsContent = `// Sokoban Levels - JavaScript version
// Converted from Microban Levels.txt for easy access

const SOKOBAN_LEVELS = {
    // Level symbols:
    // @ - Player starting position
    // $ - Box/crate starting position  
    // . - Goal where a box needs to be pushed
    // + - Player & goal (player on goal)
    // * - Box & goal (box on goal)
    // # - Wall
    // (space) - Empty open space

    // Microban Levels - ${levels.length} total levels
    Microban: [
`;

    // Add each level
    for (let i = 0; i < levels.length; i++) {
        jsContent += `        // Level ${i + 1}\n`;
        jsContent += '        [\n';
        
        for (const row of levels[i]) {
            jsContent += `            "${row}",\n`;
        }
        
        jsContent += '        ]';
        if (i < levels.length - 1) {
            jsContent += ',\n\n';
        } else {
            jsContent += '\n';
        }
    }

    jsContent += `    ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SOKOBAN_LEVELS;
}
`;

    // Write the file
    fs.writeFileSync('levels_new.js', jsContent);
    console.log('Conversion complete! New file saved as levels_new.js');
    
    // Print first few levels for verification
    console.log('\nFirst 3 levels for verification:');
    for (let i = 0; i < Math.min(3, levels.length); i++) {
        console.log(`\nLevel ${i + 1}:`);
        levels[i].forEach(row => console.log(row));
    }
}

parseMicrobanLevels();
