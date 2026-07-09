const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('d:/KRM/26/26IN001 - IT_PLAN/it-tracker/src');
let changedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('indigo')) {
    const newContent = content.replace(/indigo/g, 'emerald');
    fs.writeFileSync(file, newContent, 'utf8');
    changedCount++;
  }
}
console.log(`Replaced in ${changedCount} files.`);
