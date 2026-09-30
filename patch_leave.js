const fs = require('fs');
const file = 'C:/Users/DELL/Downloads/new-queerp/backend/src/controllers/leaveController.js';
let content = fs.readFileSync(file, 'utf8');

const employeeIdLogic = `    let employeeId = req.user?.employeeId;
    let isAdminAction = false;

    if (req.body.employeeId && req.user?.role !== 'EMPLOYEE') {
      employeeId = req.body.employeeId;
      isAdminAction = true;
    }

    if (!employeeId) {`;

content = content.replace(
  /const employeeId = req\.user\?\.employeeId;\s*if \(\!employeeId\) \{/,
  employeeIdLogic
);

content = content.replace(
  /date: leaveDate\s*\}\s*\}\);/,
  "date: leaveDate,\n        status: isAdminAction ? 'APPROVED' : 'PENDING'\n      }\n    });"
);

fs.writeFileSync(file, content);
console.log('Modified leaveController.js');
