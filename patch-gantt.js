// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const files = [
  'node_modules/gantt-task-react/dist/index.js',
  'node_modules/gantt-task-react/dist/index.modern.js',
  'node_modules/gantt-task-react/dist/index.es.js'
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let code = fs.readFileSync(f, 'utf8');
    // Change Month view padding from 1 year to 1 month
    code = code.replace(/newEndDate = addToDate\(newEndDate, [12], "year"\);\s*newEndDate = startOfDate\(newEndDate, "year"\);/g, 'newEndDate = addToDate(newEndDate, 1, "month"); newEndDate = startOfDate(newEndDate, "month");');
    code = code.replace(/newEndDate = addToDate\(newEndDate, 2, "month"\);\s*newEndDate = startOfDate\(newEndDate, "month"\);/g, 'newEndDate = addToDate(newEndDate, 1, "month"); newEndDate = startOfDate(newEndDate, "month");');
    fs.writeFileSync(f, code);
  }
});
console.log('Patched gantt-task-react padding to 1 month');
