const { htmlToPdfBuffer } = require("./launchBrowser");
const proposalTemplate = require("../templates/proposalTemplate");

const generateProposalPdf = async (proposal, settings) => {
  const htmlContent = proposalTemplate(proposal, settings);

  const pdfBuffer = await htmlToPdfBuffer(htmlContent, {
    format: "A4",
    printBackground: true,
  });

  return pdfBuffer;
};

module.exports = generateProposalPdf;

