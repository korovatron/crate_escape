// Script to replace only the Microban levels while preserving everything else
const fs = require('fs');

function replaceMicrobanLevels() {
    // Read the source file with correct Microban levels
    const microbanContent = fs.readFileSync('Microban Levels.txt', 'utf8');
    const lines = microbanContent.split('\n').map(line => line.replace('\r', ''));
    
    // Parse the Microban levels
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
    
    console.log(`Parsed ${levels.length} Microban levels`);
    
    // Read the current levels.js file
    const currentContent = fs.readFileSync('levels.js', 'utf8');
    
    // Find the start and end of the Microban section
    const microbanStart = currentContent.indexOf('    Microban: [');
    const microbanEnd = currentContent.indexOf('    ],', microbanStart) + 6; // Include the closing ],
    
    if (microbanStart === -1 || microbanEnd === -1) {
        console.error('Could not find Microban section in levels.js');
        return;
    }
    
    // Generate the new Microban section
    let newMicrobanSection = '    Microban: [\n';
    
    for (let i = 0; i < levels.length; i++) {
        newMicrobanSection += `        // Level ${i + 1}\n`;
        newMicrobanSection += '        [\n';
        
        for (const row of levels[i]) {
            newMicrobanSection += `            "${row}",\n`;
        }
        
        newMicrobanSection += '        ]';
        if (i < levels.length - 1) {
            newMicrobanSection += ',\n\n';
        } else {
            newMicrobanSection += '\n';
        }
    }
    
    newMicrobanSection += '    ],';
    
    // Replace only the Microban section
    const newContent = currentContent.substring(0, microbanStart) + 
                      newMicrobanSection + 
                      currentContent.substring(microbanEnd);
    
    // Write the updated file
    fs.writeFileSync('levels.js', newContent);
    console.log('Successfully replaced Microban levels while preserving all other level sets!');
    
    // Verify the first few levels
    console.log('\nFirst 3 Microban levels for verification:');
    for (let i = 0; i < Math.min(3, levels.length); i++) {
        console.log(`\nLevel ${i + 1}:`);
        levels[i].forEach(row => console.log(row));
    }
}

replaceMicrobanLevels();
