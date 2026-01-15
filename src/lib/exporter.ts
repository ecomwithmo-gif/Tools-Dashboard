import ExcelJS from 'exceljs';
import { ProductData } from '../types';
import { generateOrder } from './orderBuilder';

// Colors for Conditional Formatting (ExcelJS uses ARGB usually without #, or hex)
const ARGB_COLORS = {
  SUBTLE_GREEN: 'FFF0FDF4', 
  SUBTLE_RED: 'FFFEF2F2',   
  SUBTLE_ORANGE: 'FFFFFBEB', 
  GREEN_TEXT: 'FF15803D',
  RED_TEXT: 'FFDC2626',
  BLUE_HEADER: 'FF0F172A',
  WHITE: 'FFFFFFFF',
  BORDER: 'FFE2E8F0',
  LINK: 'FF2563EB',
  BOLD_GREEN_FILL: 'FF90EE90'
};

export async function exportToExcel(
  data: ProductData[], 
  filename: string, 
  onProgress?: (msg: string) => void,
  orderBudget: number = 0
) {
  if (data.length === 0) return;

  // Pre-process: Logic for 'Parent Sales Badge'
  // If any ASIN has a sales badge that belongs to a Parent ASIN, mark all rows with that parent with an X
  const parentWithBadgeSet = new Set<string>();
  
  // 1. Identify Parents that have at least one badged child
  data.forEach(row => {
    const p = row.Parent;
    const b = row['Sales Badge'];
    // Check if badge exists and is not N/A (and not empty)
    const hasBadge = b && String(b).trim().length > 0 && String(b).toLowerCase() !== 'n/a';
    
    if (p && hasBadge) {
      parentWithBadgeSet.add(p);
    }
  });

  // 2. Mark rows
  data.forEach(row => {
    // We add the property to all rows so headers pick it up
    if (row.Parent && parentWithBadgeSet.has(row.Parent)) {
      row['Parent Sales Badge'] = 'X';
    } else {
      row['Parent Sales Badge'] = ''; 
    }
  });

  // We no longer strictly need CSV for performance up to ~200k rows with this method,
  // but let's keep a sanity check for EXTREME valid cases (e.g. 500k+) or if simple CSV is preferred.
  // For now, we trust ExcelJS for the < 300k range.
  
  if (data.length > 300000) {
    onProgress?.(`Dataset massive (${data.length} rows). Switching to CSV for stability...`);
    await exportToCSV(data, filename, onProgress);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity Scouter';
  workbook.created = new Date();

  // 1. Summary Dashboard
  onProgress?.('Generating Summary Dashboard...');
  createSummarySheet(workbook, data);

  // 2. Analysis Results
  onProgress?.('Processing Analysis Data...');
  const analysisSheet = workbook.addWorksheet('Analysis Results');
  
  // Define Headers and Columns
  const extraCols: string[] = (data as any)._extraCostColumns || [];
  const excludeHeaders = ['_styles', '_isBestVariant', '_isBestColor', 'Locale', 'Image', 'Amazon URL', ...extraCols];
  const rawHeaders = Object.keys(data[0]).filter(k => !excludeHeaders.includes(k));
  
  const ratingHeaders = ['Total Parent Ratings', 'Total Color Ratings', 'Global Color Popularity'];
  const stockHeaders = ['In Stock', 'Sales'];
  const metricHeaders = ['COST', 'MSRP', 'Profit', 'ROI', 'Margin Div', 'Profit Margin (Buybox)', 'Price Used For BB Profit'];
  
  const finalHeaders: string[] = [];
  rawHeaders.forEach(h => {
    if (!ratingHeaders.includes(h) && !metricHeaders.includes(h) && !stockHeaders.includes(h)) {
      finalHeaders.push(h);
      if (h === 'Sales Badge') {
        finalHeaders.push('Parent Sales Badge');
      }
      if (h === 'Referral Fee &') {
        finalHeaders.push(...ratingHeaders, ...stockHeaders);
      }
    }
  });
  
  [...ratingHeaders, ...stockHeaders, ...metricHeaders].forEach(h => {
    if (!finalHeaders.includes(h)) finalHeaders.push(h);
  });

  // Add extra columns at the very end
  extraCols.forEach(h => {
      if (!finalHeaders.includes(h)) finalHeaders.push(h);
  });

  // Set up columns
  analysisSheet.columns = finalHeaders.map(h => {
    let width = 15;
    if (h === 'Title') width = 50;
    if (h === 'Title') width = 50;
    if (['Brand', 'Parent', 'ASIN', 'Imported by Code'].includes(h)) width = 20;
    if (h === 'Parent Sales Badge') width = 18;
    return { header: h, key: h, width };
  });

  // Apply Header Styles
  analysisSheet.getRow(1).height = 30; // 40px approx
  analysisSheet.getRow(1).font = { bold: true, color: { argb: ARGB_COLORS.WHITE }, size: 10, name: 'Inter' };
  analysisSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_COLORS.BLUE_HEADER } };
  analysisSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Add Data Efficiently
  onProgress?.('Writing data rows...');
  // Transform data slightly if needed (e.g. for links) but mostly just pass objects
  // Note: ExcelJS allows adding array of objects if columns keys match properties
  const CHUNK_SIZE = 10000;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    if (onProgress) onProgress(`Writing rows ${i} to ${Math.min(i + CHUNK_SIZE, data.length)}...`);
    const chunk = data.slice(i, i + CHUNK_SIZE).map(item => {
      // Create a shallow copy to modify specific fields for display if needed
      // Actually ExcelJS matches by key.
      const row: any = { ...item };
      
      // Hyperlinks handling needs care. 
      // ExcelJS usually wants { text: '...', hyperlink: '...' } for cell value
      if (item.ASIN) {
        row.ASIN = { text: item.ASIN, hyperlink: `https://www.amazon.com/dp/${item.ASIN}`, tooltip: 'View on Amazon' };
      }
      if (item['Amazon URL']) {
        row['Amazon URL'] = { text: 'Link', hyperlink: item['Amazon URL'] };
      }
      return row;
    });
    analysisSheet.addRows(chunk);
    // Allow UI breath
    await new Promise(r => setTimeout(r, 0));
  }

  // Freeze top row
  analysisSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Auto-filter
  analysisSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: finalHeaders.length }
  };

  // 3. Apply Column Formats & Conditional Formatting
  onProgress?.('Applying sophisticated formatting rules...');
  
  const lastRow = data.length + 1;
  const fullRange = (colLetter: string) => `${colLetter}2:${colLetter}${lastRow}`;
  
  // Helper to find column letter by header key
  const getColLetter = (header: string) => {
    const col = analysisSheet.getColumn(header);
    // ExcelJS column.letter might be undefined if not accessed yet, but usually works after adding data.
    // If not, we calculate it 1-based index to letter
    if (col && col.letter) return col.letter;
    const idx = finalHeaders.indexOf(header);
    if (idx === -1) return null;
    return numToAlpha(idx + 1); // Helper below
  };

  finalHeaders.forEach((h) => {
    const colLetter = getColLetter(h);
    if (!colLetter) return;
    
    // Number Formats
    const col = analysisSheet.getColumn(h);
    if (['Sales Rank', 'Sales Rank 30', 'Sales Rank 90', 'Rating Count', 'Total Parent Ratings'].includes(h)) {
      col.numFmt = '#,##0';
    } else if (['COST', 'MSRP', 'Profit', 'Buy Box', 'MSRP Difference'].includes(h)) {
      col.numFmt = '"$"#,##0.00';
    } else if (['ROI', 'Profit Margin (Buybox)', 'Profit Margin (MSRP)'].includes(h)) {
      col.numFmt = '0.00"%"'; // formatted as percent but value is e.g. 20 for 20%
    } else if (h === 'Margin Div') {
      col.numFmt = '0.00'; // Plain number
    } else if (h === 'AMZ In Stock %') {
      col.numFmt = '0%';
    }

    // Conditional Formatting Rules
    // Sales Rank: < 150k Green, < 500k Orange, > 500k Red
    if (['Sales Rank', 'Sales Rank 30'].includes(h)) {
      analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
          {
            type: 'cellIs', 
            priority: 1,
            operator: 'lessThan', 
            formulae: ['150000'], 
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_GREEN } } }
          },
          {
            type: 'cellIs',
            priority: 2,
            operator: 'between', 
            formulae: ['150000', '500000'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_ORANGE } } }
          },
          {
            type: 'cellIs',
            priority: 3,
            operator: 'greaterThan',
            formulae: ['500000'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_RED } } }
          }
        ]
      });
    }

    // Profit / ROI: > 20% Green, > 12% Orange, Else Red
    // Note: Excel percentages are 0.12 etc. if value is raw number. If user stores as '12.00', need to check.
    // Assuming data is numbers (e.g. 25.5 for 25.5%). Exporter logic usually assumes numbers or parses them.
    // Based on `applyRowStyles`, ROI is number (e.g. 50 meaning 50%).
    if (['ROI', 'Profit Margin (Buybox)'].includes(h)) {
      analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
          {
            type: 'cellIs',
            priority: 1,
            operator: 'greaterThan',
            formulae: ['20'], // Assuming 20 means 20% in your data convention based on old exporter
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_GREEN } } }
          },
          {
            type: 'cellIs',
            priority: 2,
            operator: 'between',
            formulae: ['12', '20'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_ORANGE } } }
          },
          {
            type: 'cellIs',
            priority: 3,
            operator: 'lessThan',
            formulae: ['12'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_RED } } }
          }
        ]
      });
    }
    
    // Margin Div: > 150% Green (1.5x), < 130% Red
    if (h === 'Margin Div') {
      analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
          {
            type: 'cellIs', 
            priority: 1,
            operator: 'greaterThan', 
            formulae: ['150'], 
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_GREEN } } }
          },
          {
            type: 'cellIs',
            priority: 2,
            operator: 'between',
            formulae: ['130', '150'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_ORANGE } } }
          },
          {
            type: 'cellIs',
            priority: 3,
            operator: 'lessThan',
            formulae: ['130'],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_RED } } }
          }
        ]
      });
    }
    
    // Profit Amount
    if (h === 'Profit') {
      analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
           { 
             type: 'cellIs', 
             priority: 1,
             operator: 'lessThan', 
             formulae: ['0.80'], 
             style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_RED } } }
           }
        ]
      });
    }

    // Amazon Availability
    // Contains "no amazon offer" -> Green
    // Contains "is in stock" -> Red
    if (h === 'Amazon Availability') {
      analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
          {
            type: 'containsText',
            priority: 1,
            operator: 'containsText',
            text: 'no amazon offer',
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_GREEN } } }
          },
          {
            type: 'containsText',
            priority: 2,
            operator: 'containsText',
            text: 'is in stock',
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_RED } } }
          }
        ]
      });
    }
    
    // Sales Badge
    if (h === 'Sales Badge') {
       analysisSheet.addConditionalFormatting({
        ref: fullRange(colLetter),
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [`AND(LEN(${colLetter}2)>0, ISERR(SEARCH("N/A", ${colLetter}2)))`], // Green if NOT empty AND "N/A" is NOT found
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: ARGB_COLORS.SUBTLE_GREEN } } }
          }
        ]
       });
    }

    if (h === 'Parent Sales Badge') {
        const col = analysisSheet.getColumn(colLetter);
        col.alignment = { horizontal: 'center' };
    }
  });


  // 4. Order Draft Sheet
  if (orderBudget > 0) {
    onProgress?.('Generating Smart Order Draft...');
    const orderItems = generateOrder(data, orderBudget);
    if (orderItems.length > 0) {
      createOrderSheet(workbook, orderItems);
    }
  }

  onProgress?.('Finalizing and Compressing...');
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace('.xlsx', '')}_Analysis.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


function createSummarySheet(workbook: ExcelJS.Workbook, data: ProductData[]) {
  const sheet = workbook.addWorksheet('Summary Dashboard');
  // Logic copied from old exporter and adapted to ExcelJS
  const totalSKUs = data.length;
  const profitable = data.filter(r => (r.Profit || 0) > 0);
  const totalProfit = data.reduce((sum, r) => sum + (r.Profit || 0), 0);
  
  // ... [Calculation Logic remains same, omitted for brevity but need to include in final file] 
  // For the tool call I need to implement fully.
  
  const deadWeight = data.filter(r => (r.Profit || 0) < 0).length;
  const avgROI = profitable.length > 0 ? profitable.reduce((sum, r) => sum + (r.ROI || 0), 0) / profitable.length : 0;
  const noAmazon = data.filter(r => String(r['Amazon Availability'] || '').toLowerCase().includes('no amazon offer'));
  const highOpportunity = noAmazon.filter(r => {
      const rank = parseFloat(String(r['Sales Rank'] || '9999999').replace(/[^0-9.]/g, ''));
      const roi = parseFloat(String(r.ROI || '0'));
      return rank < 200000 && roi > 25;
  });
  const goldenSKUs = data.filter(r => {
    const rank = parseFloat(String(r['Sales Rank'] || '9999999').replace(/[^0-9.]/g, ''));
    const roi = parseFloat(String(r.ROI || '0'));
    return rank < 50000 && roi > 50;
  }).length;
  
  const avgMargin = data.reduce((sum, r) => sum + (typeof r['Profit Margin (Buybox)'] === 'number' ? r['Profit Margin (Buybox)'] : 0), 0) / totalSKUs;
  const msrpAdherence = (data.filter(r => {
     const price = getSalePrice(r);
     const msrp = parseFloat(r.MSRP as any) || 0;
     return msrp > 0 && price && price >= msrp;
  }).length / data.filter(r => (parseFloat(r.MSRP as any) || 0) > 0).length) * 100 || 0;

  // Build Summary Data Rows
  const summaryRows = [
    ["AMAZON BUSINESS INTELLIGENCE - EXECUTIVE REPORT"],
    [],
    ["1. EXECUTIVE OVERVIEW", "Value"],
    ["Total Catalog Size", totalSKUs],
    ["Profitability Success Rate", (profitable.length / totalSKUs)], // Format as %
    ["Total Potential Profit", totalProfit], // Format as currency
    ["Total Annualized Potential", totalProfit * 12],
    ["Average Catalog ROI %", avgROI / 100], // Excel expects 0.5 for 50%
    [],
    ["2. FINANCIAL HEALTH & CATALOG QUALITY", "Value"],
    ["Average Profit Margin %", avgMargin / 100],
    ["Golden SKUs (ROI > 50% & Rank < 50k)", goldenSKUs],
    ["MSRP Adherence %", msrpAdherence / 100],
    ["Dead Weight SKUs", deadWeight],
    [],
    ["3. MARKET OPPORTUNITY ANALYSIS", "Value"],
    ["SKUs with No Amazon Offer", noAmazon.length],
    ["High-Opportunity SKUs", highOpportunity.length]
  ];

  sheet.addRows(summaryRows);

  // Styling Summary
  sheet.getColumn(1).width = 40;
  sheet.getColumn(2).width = 20;
  
  sheet.getRow(1).font = { bold: true, size: 20, color: { argb: ARGB_COLORS.BLUE_HEADER } };
  
  // Iterate rows to style headers
  sheet.eachRow((row, rowNumber) => {
    const cell1 = row.getCell(1);
    const val = cell1.value?.toString() || '';
    if (/^[1-7]\./.test(val)) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { bold: true, color: { argb: ARGB_COLORS.WHITE } };
      });
    }
    
    // Number Formats
    const cell2 = row.getCell(2);
    const val2 = cell2.value;
    if (typeof val2 === 'number') {
        if (val.includes('Profit') || val.includes('Potential')) cell2.numFmt = '$#,##0.00';
        else if (val.includes('%') || val.includes('Rate')) cell2.numFmt = '0.0%';
        else if (val.includes('Size') || val.includes('SKUs')) cell2.numFmt = '#,##0';
    }
  });

  // Top 15 SKUs
  sheet.addRow([]);
  sheet.addRow(['7. TOP 15 PROFITABLE SKUs']);
  const headerRowIdx = sheet.lastRow!.number + 1;
  const headerRow = sheet.addRow(["ASIN", "Title", "Brand", "Rank", "ROI", "Profit $"]);
  headerRow.font = { bold: true };
  
  const top15 = data.slice().sort((a, b) => (b.Profit || 0) - (a.Profit || 0)).slice(0, 15);
  top15.forEach(r => {
    sheet.addRow([
      r.ASIN,
      r.Title,
      r.Brand,
      r['Sales Rank'],
      (r.ROI || 0) / 100,
      r.Profit
    ]);
  });
  
  const tableStart = headerRowIdx + 1;
  const tableEnd = tableStart + top15.length;
  // Apply formats to Top 15 table
  for (let r = tableStart; r <= tableEnd; r++) {
      sheet.getCell(`D${r}`).numFmt = '#,##0';
      sheet.getCell(`E${r}`).numFmt = '0.0%';
      sheet.getCell(`F${r}`).numFmt = '$#,##0.00';
  }
}

function createOrderSheet(workbook: ExcelJS.Workbook, items: any[]) {
  const sheet = workbook.addWorksheet('Order Draft');
  
  const totalUnits = items.reduce((sum, item) => sum + item.Units, 0);
  const totalCost = items.reduce((sum, item) => sum + item.TotalCost, 0);
  const totalProfit = items.reduce((sum, item) => sum + item.EstProfit, 0);
  
  // Headers
  const columns = [
    { header: 'Image', key: 'Image', width: 10 },
    { header: 'Brand', key: 'Brand', width: 15 },
    { header: 'UPC', key: 'UPC', width: 15 },
    { header: 'ASIN', key: 'ASIN', width: 12 },
    { header: 'Title', key: 'Title', width: 40 },
    { header: 'Color', key: 'Color', width: 12 },
    { header: 'Size', key: 'Size', width: 8 },
    { header: 'COST', key: 'COST', width: 10 },
    { header: 'Sell Price', key: 'Buy Box', width: 10 },
    { header: 'Units', key: 'Units', width: 8 },
    { header: 'Total Cost', key: 'TotalCost', width: 12 },
    { header: 'Est. Profit', key: 'EstProfit', width: 12 },
    { header: 'ROI', key: 'ROI', width: 10 },
  ];
  
  // Summary at top
  sheet.addRow(['ORDER DRAFT SUMMARY']);
  sheet.addRow(['Total Units', totalUnits]);
  sheet.addRow(['Total Cost', totalCost]);
  sheet.addRow(['Total Profit', totalProfit]);
  sheet.addRow([]);
  
  // Table Header start at row 6
  sheet.getRow(6).values = columns.map(c => c.header);
  sheet.getRow(6).font = { bold: true, color: { argb: ARGB_COLORS.WHITE } };
  sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_COLORS.BLUE_HEADER } };
  
  // Data
  items.forEach(item => {
    const row = [
       '', 
       item.Brand, 
       item['Imported by Code'] || item['Import Code'],
       item.ASIN,
       item.Title,
       item.Color,
       item.Size,
       item.COST,
       item['Buy Box'],
       item.Units,
       item.TotalCost,
       item.EstProfit,
       (item.ROI || 0) / 100
    ];
    sheet.addRow(row);
  });
  
  // Formats
  sheet.getColumn(8).numFmt = '$#,##0.00'; // COST
  sheet.getColumn(9).numFmt = '$#,##0.00'; // Sell
  sheet.getColumn(11).numFmt = '$#,##0.00'; // Total Cost
  sheet.getColumn(12).numFmt = '$#,##0.00'; // Profit
  sheet.getColumn(13).numFmt = '0.0%'; // ROI
}

function numToAlpha(num: number): string {
  let s = '';
  let t;
  while (num > 0) {
    t = (num - 1) % 26;
    s = String.fromCharCode(65 + t) + s;
    num = (num - t) / 26 | 0;
  }
  return s;
}

// Minimal helper fallback
async function exportToCSV(data: ProductData[], filename: string, onProgress?: (msg: string) => void) {
  // ... [Keep existing CSV logic just in case, heavily simplified or just rely on ExcelJS csv writer]
  // ExcelJS has a CSV writer too!
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  const headers = Object.keys(data[0]);
  sheet.columns = headers.map(h => ({ header: h, key: h }));
  sheet.addRows(data);
  const buffer = await wb.csv.writeBuffer();
  const blob = new Blob([buffer], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace('.xlsx', '.csv');
  link.click();
}

function getSalePrice(row: ProductData): number | null {
  for (const col of ['Buy Box', 'Buy Box 30', 'Buy Box 90', 'Buy Box 180', 'MSRP'] as const) {
    const val = parseFloat(row[col] as any);
    if (val > 0) return val;
  }
  return null;
}


export async function exportToGoogleSheets(
  data: ProductData[], 
  filename: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  console.log('Google Sheets Export not yet implemented', data.length, filename);
  // Placeholder implementation to satisfy build
  return { success: false, error: 'Google Sheets export is currently disabled.' };
}
