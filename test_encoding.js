const fs = require('fs');
const mangled = "à¹ƒà¸™à¸ à¸²à¸£ map à¸ à¹‡à¸•à¹‰à¸­à¸‡à¸„à¸£à¸­à¸š String()";
const restored = Buffer.from(mangled, 'latin1').toString('utf8');
console.log("Restored:", restored);
