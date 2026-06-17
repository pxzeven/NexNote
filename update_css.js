const fs = require('fs');
const cssPath = './src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

// The tricky part is we don't want to replace `:root[data-theme="forest"] {`
// We only want to replace it where it acts as a selector list.

// Replace `:root[data-theme="forest"] ` when it's followed by `body`, `.app`, etc.
css = css.replace(/:root\[data-theme="forest"\] /g, ':root[data-theme="forest"] ,\n:root[data-theme="darkneon"] ');

// Replace `:root[data-theme="forest"] {` with the definition list.
css = css.replace(/:root\[data-theme="forest"\] \{/g, ':root[data-theme="forest"],\n:root[data-theme="darkneon"] {');

// Oh wait, there are places where it's `:root[data-theme="forest"]\n` or similar. Let's just do a smarter regex.
// Find all `:root[data-theme="forest"]` and replace with `:root[data-theme="forest"],\n:root[data-theme="darkneon"]` 
// UNLESS it's the `/* Forest */\n:root[data-theme="forest"] {` block.

let newCss = '';
const lines = css.split('\n');
let inForestBlock = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('/* Forest */')) {
    newCss += line + '\n';
    // Skip down until we close the block, copy exactly.
    while (i + 1 < lines.length) {
      i++;
      newCss += lines[i] + '\n';
      if (lines[i] === '}') {
        break;
      }
    }
    // Now inject dark neon block
    newCss += '\n/* Dark Neon */\n:root[data-theme="darkneon"] {\n  --bg-color: #050505;\n  --bg-gradient: radial-gradient(circle at 15% 50%, rgba(0, 255, 255, 0.15), transparent 50%),\n    radial-gradient(circle at 85% 30%, rgba(255, 0, 255, 0.15), transparent 50%),\n    radial-gradient(circle at 50% 80%, rgba(138, 43, 226, 0.15), transparent 50%),\n    linear-gradient(135deg, #000000 0%, #0a0a0a 100%);\n  --sidebar-bg: rgba(255, 255, 255, 0.03);\n  --accent: #00ffff;\n  --active-item: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(255, 0, 255, 0.2));\n  --active-shadow: 0 4px 15px rgba(0, 255, 255, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2);\n  --shape1-bg: linear-gradient(135deg, #00ffff, #0088ff);\n  --shape1-shadow: inset -20px -20px 40px rgba(0, 0, 0, 0.6), inset 10px 10px 20px rgba(255, 255, 255, 0.4), 0 20px 40px rgba(0, 255, 255, 0.3);\n  --shape2-bg: linear-gradient(135deg, #ff00ff, #8a2be2);\n  --shape2-shadow: inset -30px -30px 50px rgba(0, 0, 0, 0.6), inset 15px 15px 30px rgba(255, 255, 255, 0.4), 0 30px 50px rgba(255, 0, 255, 0.3);\n  --right-sidebar-bg: rgba(5, 5, 5, 0.85);\n}\n';
  } else {
    // Regular line, replace if it contains :root[data-theme="forest"]
    if (line.includes(':root[data-theme="forest"]')) {
      // Find the text after it, e.g. " body,"
      line = line.replace(':root[data-theme="forest"]', ':root[data-theme="forest"],\n:root[data-theme="darkneon"]');
      // In case the original line had a comma, e.g. `:root[data-theme="forest"] body,` -> we want `:root[data-theme="darkneon"] body,`
      // Wait, if original line is `:root[data-theme="forest"] body,`, simple replace makes it:
      // `:root[data-theme="forest"],\n:root[data-theme="darkneon"] body,`
      // Which means forest body is now just forest root! This is WRONG!
    }
    // we can't do this simple line replace.
  }
}

// Safer approach using regex:
// Replace `:root[data-theme="forest"](.*?)(?={|,|\n)` with `:root[data-theme="forest"]$1,\n:root[data-theme="darkneon"]$1`
// Let's test this in the node script.
