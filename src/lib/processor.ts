import * as XLSX from 'xlsx';
import { ProductData, LiveStats } from '../types';
import { cleanProductCode, normalizeCode, COLUMN_PATTERNS, canonicalize } from './utils';

const CHUNK_SIZE = 2000; // Increased chunk size for better throughput

export async function parseExcel(file: File): Promise<{ data: any[], headers: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArray = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArray, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Explicitly get headers from the first row and trim them
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        const rawHeaders = (rows[0] || []).map(h => String(h || ''));
        const headers = rawHeaders.map(h => h.trim()).filter(h => h !== '');
        
        // Get data using the first row as headers, and ensuring they are trimmed
        // Use raw: false to ensure we get the formatted string (preserves leading zeros)
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false }).map((row: any) => {
          const entry: any = {};
          Object.keys(row).forEach(key => {
            entry[key.trim()] = row[key];
          });
          return entry;
        });
        
        resolve({ data, headers });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function detectColumns(headers: string[], patternsMap: Record<string, string[]> = COLUMN_PATTERNS): Record<string, string> {
  if (headers.length === 0) return {};
  const mapping: Record<string, string> = {};
  const usedKeys = new Set<string>();

  const canonicalKeys = headers.map(k => ({ original: k, canonical: canonicalize(k) }));

  // Pass 1: Canonical Exact Match
  for (const [standard, patterns] of Object.entries(patternsMap)) {
    const canonicalPatterns = patterns.map(p => canonicalize(p));
    
    for (const { original, canonical } of canonicalKeys) {
      if (usedKeys.has(original)) continue;
      if (canonicalPatterns.includes(canonical)) {
        mapping[standard] = original;
        usedKeys.add(original);
        break;
      }
    }
  }

  // Pass 2: Partial Canonical Match
  for (const [standard, patterns] of Object.entries(patternsMap)) {
    if (mapping[standard]) continue;
    const canonicalPatterns = patterns.map(p => canonicalize(p));

    for (const { original, canonical } of canonicalKeys) {
      if (usedKeys.has(original)) continue;
      if (canonicalPatterns.some(p => canonical.includes(p) || p.includes(canonical))) {
        mapping[standard] = original;
        usedKeys.add(original);
        break;
      }
    }
  }

  return mapping;
}

export async function processData(
  mainData: any[],
  mapping: Record<string, string>,
  costData?: any[],
  costMapping?: Record<string, string>,
  inStockSalesData?: any[],
  inStockMapping?: Record<string, string>,
  shippingCost: number = 0,
  miscCost: number = 0,
  onProgress?: (progress: number, message: string, stats?: LiveStats) => void
): Promise<ProductData[]> {
  
  // 1. Map and Sanitize (Initial Step)
  onProgress?.(10, 'Mapping and sanitizing data...');
  let processed = await mapAndSanitize(mainData, mapping);

  // 2. Remove Duplicates on ASIN
  onProgress?.(20, 'Removing duplicates...');
  const seenAsins = new Set<string>();
  const uniqueProcessed: ProductData[] = [];
  for (const item of processed) {
    if (item.ASIN) {
      if (seenAsins.has(item.ASIN)) continue;
      seenAsins.add(item.ASIN);
    }
    uniqueProcessed.push(item);
  }
  processed = uniqueProcessed;

  // 3. Remove invalid
  processed = processed.filter(row => row.Brand || row.Parent || row.ASIN || row.Title);

  // 4. Integrate Costs
  const extraCols = await integrateCosts(processed, costData, costMapping, shippingCost, miscCost, (p, m) => onProgress?.(p, m));
  (processed as any)._extraCostColumns = extraCols;

  // 5. Integrate In-Stock / Sales Data
  if (inStockSalesData && inStockMapping) {
    onProgress?.(50, 'Merging In-Stock and Sales performance data...');
    await integrateInStockSales(processed, inStockSalesData, inStockMapping);
  }

  // 6. Sort for Grouping (Pre-requisite for processBrain without Maps)
  onProgress?.(60, 'Sorting data needed for analysis...');
  processed.sort((a, b) => {
    const parentA = String(a.Parent || '');
    const parentB = String(b.Parent || '');
    if (parentA !== parentB) return parentA.localeCompare(parentB);
    return String(a.Color || '').localeCompare(String(b.Color || ''));
  });

  // 7. Variant Logic & Calculations
  onProgress?.(70, 'Analyzing product variations and computing profitability...');
  await processBrainOptimized(processed, (p, m, stats) => onProgress?.(p, m, stats));

  // 8. Advanced Rating Intelligence
  onProgress?.(90, 'Computing cross-catalog rating intelligence...');
  calculateRatingMetricsOptimized(processed);

  onProgress?.(100, 'Analysis complete!');
  return processed;
}

// Optimized Rating Calculation - 2 Passes Max
function calculateRatingMetricsOptimized(data: ProductData[]) {
  // Pass 1: Aggregation
  const parentRatingTotals = new Map<string, number>();
  const parentColorTotals = new Map<string, number>();
  const globalColorTotals = new Map<string, number>();
  const parentMaxRatings = new Map<string, number>();
  const parentUniqueColors = new Map<string, Set<string>>();

  for (const row of data) {
    const parent = row.Parent || 'Unknown';
    const color = row.Color || 'Unknown';
    const ratingCount = typeof row['Rating Count'] === 'number' ? row['Rating Count'] : parseFloat(String(row['Rating Count'] || '0')) || 0;
    const childRatingCount = typeof row['Rating Count - Child'] === 'number' ? row['Rating Count - Child'] : parseFloat(String(row['Rating Count - Child'] || '0')) || 0;
    
    // Parent Rating Total
    if (row.Parent) {
      parentRatingTotals.set(parent, (parentRatingTotals.get(parent) || 0) + ratingCount);
    }

    // Parent-Color Total
    const pcKey = `${parent}|||${color}`;
    parentColorTotals.set(pcKey, (parentColorTotals.get(pcKey) || 0) + childRatingCount);

    // Global Color
    globalColorTotals.set(color, (globalColorTotals.get(color) || 0) + childRatingCount);

    // Best Color Identification Helpers
    const colorStr = String(row.Color || '').trim();
    if (colorStr && row.Parent) {
      if (!parentUniqueColors.has(parent)) parentUniqueColors.set(parent, new Set());
      parentUniqueColors.get(parent)!.add(colorStr);
    }

    // Accumulate total for this color variant (using pre-calced key if possible, but here we just re-sum or use the group logic from before? 
    // Wait, the original logic accumulated 'Rating Count - Child' into parentColorTotals then used that total.
    // Let's stick to the original logic which seemed to sum child ratings for the same parent+color combo (duplicates?) or just single row? 
    // Assuming single row per variant, but for safety we sum.
    
    // Update Max for Parent (we need the TOTAL for the color first, so we might need to defer this check or do it in Pass 2 if we have duplicates)
    // Assuming each row is unique variant.
  }

  // Intermediate: Determine Max Ratings per Parent based on the summed totals
  // We iterate the map we just built to find max
  // Actually, we can just do it in Pass 2 or a quick intermediate loop on keys.
  // Given we have 1M rows, let's just do it in Pass 2 dynamically or build it now.
  // We haven't fully summed parentColorTotals if there are duplicate rows for same variant (which shouldn't happen after dedup).
  // Let's assume processed data is unique per variant.

  for (const row of data) {
    const parent = row.Parent || 'Unknown';
    const color = row.Color || 'Unknown';
    const pcKey = `${parent}|||${color}`;
    const total = parentColorTotals.get(pcKey) || 0;
    
    const currentMax = parentMaxRatings.get(parent) || 0;
    if (total > currentMax) {
      parentMaxRatings.set(parent, total);
    }
  }

  // Pass 2: Assignment
  for (const row of data) {
    const parent = row.Parent || 'Unknown';
    const color = row.Color || 'Unknown';
    const pcKey = `${parent}|||${color}`;

    if (row.Parent) {
      row['Total Parent Ratings'] = parentRatingTotals.get(parent) || 0;
    } else {
      // Fallback: If no parent SKU, use the specific ASIN's rating count
      row['Total Parent Ratings'] = typeof row['Rating Count'] === 'number' ? row['Rating Count'] : parseFloat(String(row['Rating Count'] || '0')) || 0;
    }

    row['Total Color Ratings'] = parentColorTotals.get(pcKey) || 0;
    row['Global Color Popularity'] = globalColorTotals.get(color) || 0;

    const colorTotal = row['Total Color Ratings'] || 0;
    const maxForParent = parentMaxRatings.get(parent) || 0;
    const colorStr = String(row.Color || '').trim();
    const uniqueColorCount = parentUniqueColors.get(parent)?.size || 0;

    row._isBestColor = 
      colorTotal === maxForParent && 
      maxForParent > 0 && 
      uniqueColorCount > 1 && 
      colorStr !== '';
  }
}

async function mapAndSanitize(data: any[], mapping: Record<string, string>): Promise<ProductData[]> {
  const result: ProductData[] = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const item: ProductData = { COST: 0, MSRP: 0 };
    for (const [standard, original] of Object.entries(mapping)) {
      item[standard] = row[original];
    }
    
    if (item['Imported by Code']) item['Imported by Code'] = cleanProductCode(item['Imported by Code']);

    ['Buy Box', 'Buy Box 30', 'Buy Box 90', 'Buy Box 180', 'Sales Rank', 'Sales Rank 30', 'Sales Rank 90', 'Pick & Pack', 'Referral Fee &', 'Rating Count', 'Rating Count - Child', 'FBA', 'FBM', 'AMZ In Stock %'].forEach(col => {
      let val = parseFloat(String(item[col] || '').replace(/[^0-9.]/g, ''));
      if (isNaN(val)) val = 0;
      
      // Standardize percentages (15 -> 0.15)
      if ((col === 'Referral Fee &' || col === 'AMZ In Stock %') && val > 1) {
        val = val / 100;
      }
      
      item[col] = val;
    });

    result[i] = item;
    
    // Less frequent yield for perf
    if (i % 5000 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
  return result;
}

async function integrateCosts(processed: ProductData[], costData: any[] | undefined, mapping: Record<string, string> | undefined, shipping: number, misc: number, onProgress: (p: number, m: string) => void) {
  if (!costData || !mapping) {
    for (let i = 0; i < processed.length; i++) {
      const item = processed[i];
      item.COST = (parseFloat(item.COST as any) || 0) + shipping + misc;
    }
    return [];
  }
  
  const costMap = new Map<string, { c: number, m: number, extras: Record<string, any> }>();
  // We use mapping primarily now.
  const costFileHeaders = Object.keys(costData[0] || {});
  
  // Use Mapped Columns if available, otherwise fallback to finding them?
  // Actually, UI ensures we have a mapping or we default to auto-detect results.
  
  const costKey = mapping['COST'] || 'COST';
  const msrpKey = mapping['MSRP'] || 'MSRP';
  const costFileUpcKey = mapping['Imported by Code'] || 'Imported by Code';
  const extraColsStart = mapping['Extra Columns Start'] || null; // Not really passed this way

  onProgress(30, `Cost Matching: Using [${costFileUpcKey}] against [Imported by Code]`);
  
  // Identifying Extra Columns to pass through
  // If the user uploads a cost file, we generally want to append all columns that are NOT the mapped Cost/MSRP/UPC keys.
  const coreKeys = new Set([costKey, msrpKey, costFileUpcKey]);
  const extraKeys = costFileHeaders.filter(h => !coreKeys.has(h));

  const addToMap = (key: string | null, entry: {c: number, m: number, extras: Record<string, any>}) => {
      if (!key) return;
      costMap.set(key, entry);
  };
  
  costData.forEach(row => {
    const c = (parseFloat(String(row[costKey] || '0').replace(/[^0-9.]/g, '')) || 0);
    const m = parseFloat(String(row[msrpKey] || '0').replace(/[^0-9.]/g, '')) || 0;
    
    // Capture extra data
    const extras: Record<string, any> = {};
    extraKeys.forEach(k => {
        if (row[k] !== undefined && row[k] !== "") {
            extras[k] = row[k];
        }
    });

    if (c === 0 && m === 0 && Object.keys(extras).length === 0) return;

    const entry = { c, m, extras };
    
    if (costFileUpcKey && row[costFileUpcKey]) {
        const exactCode = cleanProductCode(row[costFileUpcKey]);
        if (exactCode) {
            addToMap(exactCode, entry);
        }
    }
  });

  onProgress(40, `Merging costs (Indexed ${costMap.size} keys)...`);
  let matchedCount = 0;
  
  const missedExamples: string[] = [];
  const costMapKeys = Array.from(costMap.keys()).slice(0, 5); 

  for (let i = 0; i < processed.length; i++) {
    const item = processed[i];
    const itemUpc = item['Imported by Code'] || '';
    const match = itemUpc && costMap.get(itemUpc);
    
    if (match) {
      item.COST = match.c + shipping + misc;
      item.MSRP = match.m;
      Object.assign(item, match.extras);
      
      matchedCount++;
      if (item._styles?.COST) delete item._styles.COST;
    } else {
      item.COST = (parseFloat(item.COST as any) || 0) + shipping + misc;
      if (costData.length > 0) {
         if (!item._styles) item._styles = {};
         item._styles.COST = { fill: 'FEE2E2', comment: 'No Cost Found' };
         if (itemUpc && missedExamples.length < 5 && !missedExamples.includes(itemUpc)) {
             missedExamples.push(itemUpc);
         }
      }
    }
    
    // Periodically yield for UI responsiveness
    if (i > 0 && i % 5000 === 0) {
      await new Promise(r => setTimeout(r, 0));
      onProgress(40 + Math.floor((i / processed.length) * 10), `Merging costs: ${matchedCount}/${i} matched`);
    }
  }
  
  if (missedExamples.length > 0) {
      onProgress(48, `DIAGNOSTIC: Failed to match Product UPCs like [${missedExamples.join(', ')}] against Cost Keys like [${costMapKeys.join(', ')}...]`);
      await new Promise(r => setTimeout(r, 2000));
  }
  
  onProgress(50, `Cost Integration Complete. Matched: ${matchedCount}/${processed.length} (${((matchedCount/processed.length)*100).toFixed(1)}%)`);
  await new Promise(r => setTimeout(r, 100)); 
  return extraKeys;
}

async function integrateInStockSales(processed: ProductData[], data: any[], mapping: Record<string, string>) {
  const stockMap = new Map<string, { s: number, sales: number }>();
  const upcKey = mapping['Imported by Code'] || mapping['ASIN'] || 'UPC';

  data.forEach(row => {
    const upc = normalizeCode(row[upcKey] || '');
    if (upc) {
        let s = 0, sales = 0;
        if (mapping['In Stock']) s = parseFloat(String(row[mapping['In Stock']] || '0').replace(/[^0-9.]/g, '')) || 0;
        if (mapping['Sales']) sales = parseFloat(String(row[mapping['Sales']] || '0').replace(/[^0-9.]/g, '')) || 0;
        stockMap.set(upc, { s, sales });
    }
  });

  processed.forEach(item => {
    const upc = normalizeCode(item['Imported by Code'] || item['ASIN'] || '');
    if (upc && stockMap.has(upc)) {
      const match = stockMap.get(upc)!;
      item['In Stock'] = match.s;
      item['Sales'] = match.sales;
    }
  });
}

// Optimized Brain: No Grouping Map. Expects Sorted Data.
async function processBrainOptimized(processed: ProductData[], onProgress: (p: number, m: string, stats: LiveStats) => void) {
  let processedCount = 0;
  let chunkStart = 0;
  
  // Helper to process a group of items (same parent)
  const processGroup = (group: ProductData[]) => {
    // 1. Identify Best Variant
    let maxRatings = 0;
    for (const r of group) {
       const val = r['Rating Count - Child'] || 0;
       if (val > maxRatings) maxRatings = val;
    }
    
    const winners = group.filter(r => (r['Rating Count - Child'] || 0) === maxRatings && maxRatings > 0);
    const best = winners.sort((a, b) => (a['Sales Rank'] || 9999999) - (b['Sales Rank'] || 9999999))[0];

    for (const item of group) {
      // 2. Default Assumptions
      if (!item['Pick & Pack'] || item['Pick & Pack'] === 0) {
        item['Pick & Pack'] = 7.00;
        item._styles = { ...item._styles, 'Pick & Pack': { fill: 'FFB6B6', comment: 'Assumed $7.00 fee' } };
      }
      if (!item['Referral Fee &'] || item['Referral Fee &'] === 0) {
        item['Referral Fee &'] = 0.15;
        item._styles = { ...item._styles, 'Referral Fee &': { fill: 'FFB6B6', comment: 'Assumed 15% referral' } };
      }

      if (item === best) {
        item._isBestVariant = true;
        item._styles = { ...item._styles, Color: { fill: '90EE90', comment: 'Best Variant' } };
      }

      // 3. Mathematical Calculations
      const bbPriceUsed = getBuyBoxWaterfallPrice(item);
      item['Price Used For BB Profit'] = bbPriceUsed ? bbPriceUsed.toFixed(2) : 'No Buybox';

      item.Profit = calculateProfit(item);
      item.ROI = calculateROI(item.Profit, item.COST || 0);
      item['Profit Margin (Buybox)'] = calculateMargin(item, 'buybox', bbPriceUsed) as any;
      item['Profit Margin (MSRP)'] = calculateMargin(item, 'msrp') as any;
      
      const msrp = parseFloat(item.MSRP as any) || 0;
      item['MSRP Difference'] = calculateMSRPDifference(msrp, bbPriceUsed);
      
      // Calculate Margin Div (Price / Cost)
      const finalPrice = bbPriceUsed || 0;
      const finalCost = item.COST || 0;
      if (finalCost > 0 && finalPrice > 0) {
        item['Margin Div'] = (finalPrice / finalCost) * 100;
      } else {
        item['Margin Div'] = 0;
      }
    }
  };

  // Linear Scan
  for (let i = 0; i < processed.length; i++) {
     // Check if next item implies a group change or end of list
     const isLast = i === processed.length - 1;
     const currentParent = processed[i].Parent || 'unassigned';
     const nextParent = !isLast ? (processed[i+1].Parent || 'unassigned') : null;

     if (isLast || currentParent !== nextParent) {
        // Process the group from chunkStart to i (inclusive)
        const group = processed.slice(chunkStart, i + 1);
        processGroup(group);
        processedCount += group.length;
        chunkStart = i + 1; // Next group starts at next index

        if (processedCount % 5000 === 0) {
             const liveProfitable = processed.slice(0, processedCount).filter(r => (r.Profit || 0) > 1);
             const liveProfitSum = liveProfitable.reduce((s, r) => s + (r.Profit || 0), 0);
             
             onProgress(70 + Math.floor((processedCount / processed.length) * 20), `Calculating: ${processedCount}/${processed.length}`, {
               totalSKUs: processed.length,
               profitableCount: liveProfitable.length,
               totalPotentialProfit: Math.round(liveProfitSum),
               avgROI: Math.round(liveProfitable.reduce((s, r) => s + (r.ROI || 0), 0) / (liveProfitable.length || 1))
             });
             await new Promise(r => setTimeout(r, 0));
        }
     }
  }
}

function getBuyBoxWaterfallPrice(row: ProductData): number | null {
  for (const col of ['Buy Box', 'Buy Box 30', 'Buy Box 90', 'Buy Box 180'] as const) {
    const val = parseFloat(row[col] as any);
    if (val > 0) return val;
  }
  return null;
}

function getSalePrice(row: ProductData): number | null {
  const bb = getBuyBoxWaterfallPrice(row);
  if (bb) return bb;
  const msrp = parseFloat(row.MSRP as any);
  if (msrp > 0) return msrp;
  return null;
}

function calculateProfit(row: ProductData): number {
  const price = getSalePrice(row);
  const cost = (row.COST || 0) + (row['Pick & Pack'] || 0);
  
  if (!price) return -cost;
  
  const referralFee = row['Referral Fee &'] || 0.15;
  const rev = price * (1 - referralFee);
  return rev - cost;
}

function calculateROI(profit: number, cost: number): number {
  if (cost === 0) return 0;
  return (profit / cost) * 100;
}

function calculateMargin(row: ProductData, type: 'buybox' | 'msrp', bbPriceUsed?: number | null): number | string {
  let price: number | null = null;
  
  if (type === 'buybox') {
    if (!bbPriceUsed) return 'No Buybox';
    price = bbPriceUsed;
  } else {
    price = parseFloat(row.MSRP as any) || 0;
    if (price <= 0) return 'N/A';
  }

  const referralFee = row['Referral Fee &'] || 0.15;
  const cost = (row.COST || 0) + (row['Pick & Pack'] || 0);
  
  const rev = price * (1 - referralFee);
  const profit = rev - cost;
  
  return (profit / price) * 100;
}

function calculateMSRPDifference(msrp: number, bbPrice: number | null): number | 'No Buybox' | 'N/A' {
  if (msrp <= 0) return 'N/A';
  if (!bbPrice) return 'No Buybox';
  return bbPrice - msrp;
}
