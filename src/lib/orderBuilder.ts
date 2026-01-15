import { ProductData } from '@/types';

export interface OrderItem extends ProductData {
  Units: number;
  TotalCost: number;
  EstProfit: number;
}

/**
 * Smart Order Builder Algorithm
 * Prioritizes: Sales Badge > Sales Rank > Reviews
 * Excludes: Amazon In-Stock, Negative ROI/Profit
 */
export function generateOrder(products: ProductData[], budget: number): OrderItem[] {
  // 1. Filter viable candidates
  const candidates = products.filter(p => {
    const amzAvailability = (p['Amazon Availability'] || '').toLowerCase();
    const amzInStock = amzAvailability.includes('in stock') && amzAvailability.includes('shippable');
    
    // EXCLUSION RULES
    if (amzInStock) return false; // Amazon is selling it
    if ((p.ROI || 0) <= 0) return false; // Not profitable
    if ((p.Profit || 0) <= 0) return false; // No profit
    if ((p.COST || 0) <= 0) return false; // No cost data

    return true;
  });

  // 2. Score & Sort Candidates
  // Higher score is better
  const scoredCandidates = candidates.map(p => {
    let score = 0;

    // A. Sales Badge (Golden Ticket) - Highest Weight
    // Matches "100+ bought", "50+ bought", etc.
    const badge = String(p['Sales Badge'] || '').toLowerCase();
    const hasBadge = badge.includes('bought') || badge.length > 0; 
    if (hasBadge) score += 10000;

    // B. Sales Rank (Lower is better)
    // Invert rank for scoring: (MaxRank - CurrentRank)
    // Assume max rank of 1,000,000 for relevant scoring
    const rank = parseInt(String(p['Sales Rank'] || '1000000').replace(/[^0-9]/g, '')) || 1000000;
    // Cap efficient rank score influence to 5000 points
    const rankScore = Math.max(0, (500000 - rank) / 100); 
    score += rankScore;

    // C. Reviews (Tie breaker)
    const reviews = (parseInt(String(p['Rating Count'] || '0').replace(/[^0-9]/g, '')) || 0) +
                    (parseInt(String(p['Rating Count - Child'] || '0').replace(/[^0-9]/g, '')) || 0);
    score += Math.min(reviews, 1000) / 10; // Cap influence

    return { product: p, score };
  });

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // 3. Allocate Budget
  const orderItems: OrderItem[] = [];
  let currentSpend = 0;

  for (const { product } of scoredCandidates) {
    if (currentSpend >= budget) break;

    const cost = Number(product.COST) || 0;
    if (cost <= 0) continue;

    // Determine max units based on strength
    let maxUnits = 2; // Standard
    const badge = String(product['Sales Badge'] || '').toLowerCase();
    const rank = parseInt(String(product['Sales Rank'] || '1000000').replace(/[^0-9]/g, '')) || 1000000;

    if (badge.length > 0) {
      maxUnits = 8; // Requested max for badge items
    } else if (rank < 100000) {
      maxUnits = 4; // Strong rank
    }

    // Try to fit max units
    let unitsToOrder = 0;
    
    // Check if we can afford at least 1
    if (currentSpend + cost > budget) continue;

    // Calculate how many we can actually afford up to maxUnits
    const remainingBudget = budget - currentSpend;
    const affordableUnits = Math.floor(remainingBudget / cost);
    unitsToOrder = Math.min(maxUnits, affordableUnits);

    if (unitsToOrder > 0) {
      const totalItemCost = unitsToOrder * cost;
      const totalItemProfit = unitsToOrder * (Number(product.Profit) || 0);

      orderItems.push({
        ...product,
        Units: unitsToOrder,
        TotalCost: totalItemCost,
        EstProfit: totalItemProfit
      });

      currentSpend += totalItemCost;
    }
  }

  return orderItems;
}
