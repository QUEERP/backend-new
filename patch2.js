const fs = require('fs');

// Patch Controller
const ctrlFile = 'C:/Users/DELL/Downloads/new-queerp/backend/src/controllers/inventory/stock.controller.js';
let ctrlContent = fs.readFileSync(ctrlFile, 'utf8');

const updateFunc = `
exports.updateStockTransfer = async (req, res) => {
  try {
    const transfer = await transferService.updateStockTransfer(
      req.business.id,
      req.user.id,
      req.user.email,
      req.params.id,
      req.body
    );
    res.json({ success: true, transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
`;

if (!ctrlContent.includes('updateStockTransfer')) {
  ctrlContent = ctrlContent + '\n' + updateFunc;
  fs.writeFileSync(ctrlFile, ctrlContent);
}

// Patch Routes
const routeFile = 'C:/Users/DELL/Downloads/new-queerp/backend/src/routes/inventory/stock.routes.js';
let routeContent = fs.readFileSync(routeFile, 'utf8');

if (!routeContent.includes('put("/transfers/:id"')) {
  routeContent = routeContent.replace(
    'router.get("/transfers/:id", auth, business, Controller.getStockTransferById);',
    'router.get("/transfers/:id", auth, business, Controller.getStockTransferById);\nrouter.put("/transfers/:id", auth, business, checkPermission("stock", "edit"), Controller.updateStockTransfer);'
  );
  fs.writeFileSync(routeFile, routeContent);
}

console.log('Patched controller and routes');
