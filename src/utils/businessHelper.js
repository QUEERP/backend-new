/**
 * Helper functions for business logic and feature gating.
 */

/**
 * Checks if a business is a trading business based on its businessType.
 * 
 * @param {Object} business - The business object containing businessType.
 * @returns {boolean} True if the business is a trading business, false otherwise.
 */
function isTradingBusiness(business) {
  if (!business || !business.businessType) return false;
  return business.businessType.trim().toLowerCase() === 'trading';
}

module.exports = {
  isTradingBusiness
};
