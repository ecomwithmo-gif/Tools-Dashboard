import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanProductCode(value: any): string {
  if (value === undefined || value === null || value === '' || 
      String(value).toLowerCase() === 'nan' || String(value).toLowerCase() === 'none' || String(value).toLowerCase() === 'null') return '';
  
  let cleaned = String(value).trim();
  
  // Remove .0 suffix that Excel adds
  if (cleaned.endsWith('.0')) {
    cleaned = cleaned.slice(0, -2);
  }
  
  return cleaned;
}

export function normalizeCode(code: any): string | null {
  if (!code) return null;
  let str = String(code).trim();
  
  // Handle Excel Scientific Notation (e.g. 1.23E+11)
  // Only attempt to expand if it strictly looks like a scientific number
  if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)$/.test(str)) {
    const num = parseFloat(str);
    if (!isNaN(num)) {
       str = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }

  // Remove .0 suffix
  if (str.endsWith('.0')) str = str.slice(0, -2);
  
  // Aggressively remove all non-alphanumeric characters (keep 0s)
  const alphanumeric = str.replace(/[^a-zA-Z0-9]/g, '');
  
  if (!alphanumeric) return null;

  return alphanumeric.toUpperCase();
}
export function canonicalize(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const REQUIRED_COLUMNS = ['Brand', 'Parent', 'ASIN', 'Title'];
export const CRITICAL_COLUMNS = ['Brand', 'Parent', 'ASIN', 'Imported by Code', 'Title', 'Sales Rank', 'Buy Box', 'Pick & Pack'];
export const MANDATORY_COST_COLUMNS = ['Imported by Code', 'COST', 'MSRP'];

export const COLUMN_PATTERNS: Record<string, string[]> = {
  "Brand": ["Brand"],
  "Parent": ["Parent ASIN", "Parent"],
  "ASIN": ["ASIN"],
  "Imported by Code": ["Imported by Code", "Import Code", "UPC", "GTIN", "EAN", "Product ID", "Barcode", "External ID"],
  "Title": ["Title", "Product Title"],
  "Color": ["Color", "Colour"],
  "Size": ["Size"],
  "Sales Badge": ["Bought in past month", "Bought in last month", "Sales Badge"],
  "Rating Count": ["Reviews: Rating Count", "Rating Count", "Total Ratings"],
  "Rating Count - Child": ["Reviews: Review Count - Format Specific", "Rating Count - Child"],
  "Sales Rank": ["Sales Rank: Current", "Sales Rank", "Current Rank"],
  "Sales Rank 30": ["Sales Rank: 30 days avg.", "Sales Rank 30"],
  "Sales Rank 90": ["Sales Rank: 90 days avg.", "Sales Rank 90"],
  "Buy Box": ["Buy Box 🚚: Current", "Buy Box", "Current Buy Box"],
  "Buy Box 30": ["Buy Box 🚚: 30 days avg.", "Buy Box 30"],
  "Buy Box 90": ["Buy Box 🚚: 90 days avg.", "Buy Box 90"],
  "Buy Box 180": ["Buy Box 🚚: 180 days avg.", "Buy Box 180"],
  "AMZ In Stock %": ["Buy Box: % Amazon 90 days", "AMZ In Stock %"],
  "Amazon Availability": ["Amazon: Availability of the Amazon offer", "Amazon Availability"],
  "FBA": ["Count of retrieved live offers: New, FBA", "FBA", "FBA Sellers"],
  "FBM": ["Count of retrieved live offers: New, FBM", "FBM", "FBM Sellers"],
  "Pick & Pack": ["FBA Pick&Pack Fee", "Pick & Pack Fee", "Fulfillment Fee"],
  "Referral Fee &": ["Referral Fee %", "Referral Fee"],
  "In Stock": ["In Stock", "Stock", "Quantity", "QTY", "Available"],
  "Sales": ["Sales", "Units Sold", "Sold", "Monthly Sales"]
};

export const COST_PATTERNS: Record<string, string[]> = {
  "Imported by Code": ["Imported by Code", "Import Code", "UPC", "GTIN", "EAN", "Product ID", "Barcode", "External ID"],
  "COST": ["Cost", "Price", "Unit Cost", "Wholesale Price", "WSP"],
  "MSRP": ["MSRP", "Retail Price", "Retail", "RRP"]
};
