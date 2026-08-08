const fs = require('fs');
const path = require('path');

const files = [
  'src/routes/auth.tsx',
  'src/routes/app.settle.tsx',
  'src/routes/app.index.tsx',
  'src/routes/app.group.$groupId.tsx',
  'src/routes/app.activity.tsx',
  'src/components/ProfileForm.tsx',
  'src/components/PaidDialog.tsx',
  'src/components/ChangePasswordDialog.tsx',
  'src/components/AddExpenseDialog.tsx'
];

files.forEach(f => {
  const p = path.join('d:\\Project\\Splity', f);
  if (!fs.existsSync(p)) return;
  
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;

  // Add import if missing
  if (!content.includes('getCleanErrorMessage')) {
    // try to add to existing "@/lib/utils" import
    if (content.includes('from "@/lib/utils"')) {
      content = content.replace(/import\s+\{([^}]*)\}\s+from\s+"@\/lib\/utils"/, (match, p1) => {
        return `import { ${p1.trim()}, getCleanErrorMessage } from "@/lib/utils"`;
      });
      changed = true;
    } else {
      content = `import { getCleanErrorMessage } from "@/lib/utils";\n` + content;
      changed = true;
    }
  }

  if (content.includes('toast.error(error.message)')) {
    content = content.replace(/toast\.error\(error\.message\)/g, 'toast.error(getCleanErrorMessage(error))');
    changed = true;
  }
  
  if (content.includes('toast.error(e.message)')) {
    content = content.replace(/toast\.error\(e\.message\)/g, 'toast.error(getCleanErrorMessage(e))');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log('Updated ' + f);
  }
});
