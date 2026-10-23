const { htmlToPdfBuffer } = require("./launchBrowser");
const salesOrderTemplate = require("../templates/salesOrderTemplate");

/**
 * Generate Sales Order PDF Buffer
 * @param {object} order
 * @param {object} settings
 * @returns {Promise<Buffer>}
 */
const generateSalesOrderPdf = async (order, settings) => {
  console.log("[STEP 1] Request received in generateSalesOrderPdf for ID:", order.id);
  const htmlContent = salesOrderTemplate(order, settings);

  const pdfBuffer = await htmlToPdfBuffer(htmlContent, {
    format: "A4",
    printBackground: true,
  });

  return pdfBuffer;
};

module.exports = generateSalesOrderPdf;
