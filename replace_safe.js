const fs = require('fs');

const files = [
  "src/components/layout/NotificationDropdown.tsx",
  "src/components/layout/ChatPanel.tsx",
  "src/components/projects/AddProjectModal.tsx",
  "src/components/projects/AddProjectButton.tsx",
  "src/components/projects/EditProjectModal.tsx",
  "src/components/projects/EditProjectButton.tsx",
  "src/components/projects/AddTaskModal.tsx",
  "src/components/projects/AddTaskButton.tsx",
  "src/components/layout/Sidebar.tsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let buf = fs.readFileSync(file);
  let str = buf.toString('binary');
  const searchStr = 'indigo';
  const replaceStr = 'emerald';
  if (str.includes(searchStr)) {
    str = str.split(searchStr).join(replaceStr);
    fs.writeFileSync(file, Buffer.from(str, 'binary'));
    console.log(`Replaced in ${file}`);
  }
}
