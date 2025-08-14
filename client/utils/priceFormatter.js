/**
 * Formats a price value to display with exactly 2 decimal places
 * @param {number|string} price - The price to format
 * @returns {string} - Formatted price string
 */
export const formatPrice = (price) => {
  if (!price || price === 0) return '₪0.00';
  
  // Convert to number and fix to 2 decimal places
  const formattedPrice = parseFloat(price).toFixed(2);
  return `₪${formattedPrice}`;
};

/**
 * Formats a price value without the currency symbol
 * @param {number|string} price - The price to format
 * @returns {string} - Formatted price string without currency symbol
 */
export const formatPriceNumber = (price) => {
  if (!price || price === 0) return '0.00';
  
  // Convert to number and fix to 2 decimal places
  return parseFloat(price).toFixed(2);
}; 