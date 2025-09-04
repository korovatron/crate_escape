import re

# Read the sokoban levels file
with open('sokobanLevels.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Split content into sections
sections = re.split(r'; Sasquatch Set', content)

def extract_levels_from_section(section_text):
    levels = []
    lines = section_text.split('\n')
    current_level = []
    
    for line in lines:
        line = line.rstrip()
        
        # Skip comments and empty lines
        if not line or line.startswith(';'):
            # If we have a level, save it
            if current_level:
                levels.append(current_level.copy())
                current_level = []
            continue
            
        # Check if line contains level data
        if any(c in line for c in '@$.*+# '):
            current_level.append(line)
    
    # Don't forget the last level
    if current_level:
        levels.append(current_level.copy())
    
    return levels

# Extract demo level
demo_section = sections[0]
demo_lines = demo_section.split('\n')
demo_level = []
for line in demo_lines:
    line = line.rstrip()
    if line and not line.startswith(';') and any(c in line for c in '@$.*+# '):
        demo_level.append(line)
    elif demo_level and (not line or line.startswith(';')):
        break

# Extract all sets
set1_levels = extract_levels_from_section(sections[1]) if len(sections) > 1 else []
set2_levels = extract_levels_from_section(sections[2]) if len(sections) > 2 else []
set3_levels = extract_levels_from_section(sections[3]) if len(sections) > 3 else []

# Create JavaScript format
js_content = '''// Sokoban Levels - JavaScript version
// Converted from sokobanLevels.txt for easy access

const SOKOBAN_LEVELS = {
    // Level symbols:
    // @ - Player starting position
    // $ - Box/crate starting position  
    // . - Goal where a box needs to be pushed
    // + - Player & goal (player on goal)
    // * - Box & goal (box on goal)
    // # - Wall
    // (space) - Empty open space

    // Demo level
    demo: [
'''

# Add demo level
for line in demo_level:
    js_content += f'        "{line}",\n'

js_content = js_content.rstrip(',\n') + '\n    ],\n\n'

# Add Set I
js_content += '    // Sasquatch Set I (50 levels)\n    setI: [\n'
for i, level in enumerate(set1_levels):
    js_content += f'        // Level {i+1}\n        [\n'
    for line in level:
        js_content += f'            "{line}",\n'
    js_content = js_content.rstrip(',\n') + '\n        ],\n\n'

js_content = js_content.rstrip(',\n') + '\n    ],\n\n'

# Add Set II  
js_content += '    // Sasquatch Set II (50 levels)\n    setII: [\n'
for i, level in enumerate(set2_levels):
    js_content += f'        // Level {i+1}\n        [\n'
    for line in level:
        js_content += f'            "{line}",\n'
    js_content = js_content.rstrip(',\n') + '\n        ],\n\n'

js_content = js_content.rstrip(',\n') + '\n    ],\n\n'

# Add Set III
js_content += '    // Sasquatch Set III (50 levels)\n    setIII: [\n'
for i, level in enumerate(set3_levels):
    js_content += f'        // Level {i+1}\n        [\n'
    for line in level:
        js_content += f'            "{line}",\n'
    js_content = js_content.rstrip(',\n') + '\n        ],\n\n'

js_content = js_content.rstrip(',\n') + '\n    ]\n'

# Add the helper functions
js_content += '''}};

// Helper functions for level access
const LevelManager = {
    // Get a specific level by set and number (1-indexed)
    getLevel: function(setName, levelNumber) {
        const set = SOKOBAN_LEVELS[setName];
        if (!set) {
            console.error(`Level set "${setName}" not found`);
            return null;
        }
        
        const level = set[levelNumber - 1]; // Convert to 0-indexed
        if (!level) {
            console.error(`Level ${levelNumber} not found in set "${setName}"`);
            return null;
        }
        
        return level;
    },

    // Get the demo level
    getDemoLevel: function() {
        return SOKOBAN_LEVELS.demo;
    },

    // Get total number of levels in a set
    getLevelCount: function(setName) {
        const set = SOKOBAN_LEVELS[setName];
        return set ? set.length : 0;
    },

    // Get all available set names
    getAvailableSets: function() {
        return Object.keys(SOKOBAN_LEVELS).filter(key => key !== 'demo');
    },

    // Parse a level string array into a more usable format
    parseLevel: function(levelArray) {
        const level = {
            grid: [],
            width: 0,
            height: levelArray.length,
            playerStart: { x: 0, y: 0 },
            boxes: [],
            goals: [],
            walls: []
        };

        // Find the maximum width
        level.width = Math.max(...levelArray.map(row => row.length));

        // Parse each row
        for (let y = 0; y < levelArray.length; y++) {
            const row = levelArray[y];
            level.grid[y] = [];
            
            for (let x = 0; x < level.width; x++) {
                const char = x < row.length ? row[x] : ' ';
                level.grid[y][x] = char;
                
                switch (char) {
                    case '@': // Player
                        level.playerStart = { x, y };
                        level.grid[y][x] = ' '; // Replace with empty space
                        break;
                    case '+': // Player on goal
                        level.playerStart = { x, y };
                        level.goals.push({ x, y });
                        level.grid[y][x] = '.'; // Replace with goal
                        break;
                    case '$': // Box
                        level.boxes.push({ x, y });
                        level.grid[y][x] = ' '; // Replace with empty space
                        break;
                    case '*': // Box on goal
                        level.boxes.push({ x, y });
                        level.goals.push({ x, y });
                        level.grid[y][x] = '.'; // Replace with goal
                        break;
                    case '.': // Goal
                        level.goals.push({ x, y });
                        break;
                    case '#': // Wall
                        level.walls.push({ x, y });
                        break;
                }
            }
        }

        return level;
    },

    // Get a parsed level ready for game use
    getParsedLevel: function(setName, levelNumber) {
        const levelArray = this.getLevel(setName, levelNumber);
        if (!levelArray) return null;
        
        return this.parseLevel(levelArray);
    },

    // Get parsed demo level
    getParsedDemoLevel: function() {
        return this.parseLevel(SOKOBAN_LEVELS.demo);
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SOKOBAN_LEVELS, LevelManager };
}'''

# Write to file
with open('levels_complete.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f'Generated complete levels file with:')
print(f'- Demo level: 1 level')
print(f'- Set I: {len(set1_levels)} levels')
print(f'- Set II: {len(set2_levels)} levels') 
print(f'- Set III: {len(set3_levels)} levels')
print(f'Total: {1 + len(set1_levels) + len(set2_levels) + len(set3_levels)} levels')
