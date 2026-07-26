const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (
        fullPath.includes('lib\\axios.ts') || 
        fullPath.includes('lib/axios.ts') || 
        fullPath.includes('services\\api.ts') || 
        fullPath.includes('services/api.ts')
      ) continue;
      
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("import axios from 'axios'") || content.includes('import axios from "axios"')) {
        content = content.replace(/import axios from 'axios';?/g, "import { api as axios } from '@/lib/axios';");
        content = content.replace(/import axios from "axios";?/g, "import { api as axios } from '@/lib/axios';");
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

walk('d:/KRM/26/26IN001 - IT_PLAN/it-tracker/src');
