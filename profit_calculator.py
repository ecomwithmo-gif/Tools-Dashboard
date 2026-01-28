class ProfitMetricsCalculator:
    """
    Calculates 5 critical profitability columns for Amazon products:
    1. Profit
    2. ROI
    3. Profit Margin (Buybox)
    4. Profit Margin (MSRP)
    5. MSRP Difference
    """

    def calculate_metrics(self, row: dict) -> dict:
        """
        Calculates all metrics for a single product row.
        Input: dict containing raw values
        Output: dict with mapped values + new calculated metrics
        """
        results = {}

        # 0. Determine Buy Box Price used for Margin and Diff logic
        # This executes the Buy Box -> 90 -> 180 waterfall
        buy_box_price = self._get_buybox_waterfall_price(row)
        
        if buy_box_price:
            results['Price Used For BB Profit'] = f"{buy_box_price:.2f}"
        else:
            results['Price Used For BB Profit'] = "No Buybox"

        # 1. Calculate Profit (CRITICAL: Must be first)
        # Note: Profit uses a slightly different waterfall (includes MSRP fallback)
        profit_data = self._calculate_profit(row, buy_box_price)
        results['Profit'] = profit_data['profit_formatted']
        
        raw_profit = profit_data['raw_profit']
        
        # 2. Calculate ROI
        results['ROI'] = self._calculate_roi(raw_profit, row.get('COST'))

        # 3. Calculate Profit Margin (Buybox)
        results['Profit Margin (Buybox)'] = self._calculate_margin_buybox(row, buy_box_price)

        # 4. Calculate Profit Margin (MSRP)
        results['Profit Margin (MSRP)'] = self._calculate_margin_msrp(row)

        # 5. MSRP Difference
        results['MSRP Difference'] = self._calculate_msrp_difference(row, buy_box_price)

        return results

    def _parse_float(self, value, default=0.0):
        if value is None or value == '':
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
            
    def _parse_float_or_none(self, value):
        if value is None or value == '' or value == 'No Buybox':
            return None
        try:
            val = float(value)
            return val if val > 0 else None
        except (ValueError, TypeError):
            return None

    def _get_referral_fee_rate(self, value):
        val = self._parse_float(value, default=0.15)
        if val == 0:
            return 0.15
        if val > 1:
            return val / 100.0
        return val

    def _get_buybox_waterfall_price(self, row):
        """
        Executes the waterfall logic: Buy Box -> Buy Box 30 -> Buy Box 90 -> Buy Box 180
        Returns float or None.
        """
        # Priority 1: Buy Box
        bb = self._parse_float_or_none(row.get('Buy Box'))
        if bb: return bb

        # Priority 2: Buy Box 30
        bb30 = self._parse_float_or_none(row.get('Buy Box 30'))
        if bb30: return bb30
        
        # Priority 3: Buy Box 90
        bb90 = self._parse_float_or_none(row.get('Buy Box 90'))
        if bb90: return bb90
        
        # Priority 4: Buy Box 180
        bb180 = self._parse_float_or_none(row.get('Buy Box 180'))
        if bb180: return bb180
        
        return None

    def _calculate_profit(self, row, buy_box_waterfall_price):
        # Step 1: Determine Sale Price (Waterfall)
        sale_price = buy_box_waterfall_price
        
        # Priority 4: MSRP (only for Profit calculation fallback)
        if sale_price is None:
            msrp = self._parse_float_or_none(row.get('MSRP'))
            if msrp: sale_price = msrp
            
        # Step 2: Calculate Net Revenue
        referral_fee_pct = self._get_referral_fee_rate(row.get('Referral Fee %'))
        
        if sale_price is not None:
            revenue = sale_price * (1 - referral_fee_pct)
        else:
            revenue = 0

        # Step 3: Calculate Total Cost
        cost = self._parse_float(row.get('COST'), default=0.0)
        
        pick_pack = self._parse_float(row.get('Pick & Pack'), default=0.0)
        if pick_pack == 0:
            pick_pack = 7.00
            
        total_cost = cost + pick_pack
        
        # Step 4: Calculate Final Profit
        if sale_price is not None:
            profit = revenue - total_cost
        else:
            profit = -total_cost
            
        return {
            'raw_profit': profit,
            'profit_formatted': f"${profit:,.2f}",
            'total_cost': total_cost,
            'sale_price_used': sale_price
        }

    def _calculate_roi(self, profit, cost_val):
        cost = self._parse_float(cost_val, default=0.0)
        
        if cost == 0:
            return ""
            
        roi = (profit / cost) * 100
        return f"{roi:,.2f}"

    def _calculate_margin_buybox(self, row, buy_box_price):
        if buy_box_price is None:
            return "No Buybox"
            
        # Step 2: Net Revenue
        referral_fee_pct = self._get_referral_fee_rate(row.get('Referral Fee %'))
        revenue = buy_box_price * (1 - referral_fee_pct)
        
        # Step 3: Total Cost
        cost = self._parse_float(row.get('COST'), default=0.0)
        pick_pack = self._parse_float(row.get('Pick & Pack'), default=0.0)
        if pick_pack == 0: pick_pack = 7.00
        total_cost = cost + pick_pack
        
        # Step 4: Profit
        profit = revenue - total_cost
        
        # Step 5: Margin Percentage (Profit / Buy Box Price)
        margin = (profit / buy_box_price) * 100
        return f"{margin:,.2f}%"

    def _calculate_margin_msrp(self, row):
        # Step 1: Get MSRP
        msrp = self._parse_float_or_none(row.get('MSRP'))
        if msrp is None:
            return ""
            
        # Step 2: Net Revenue
        referral_fee_pct = self._get_referral_fee_rate(row.get('Referral Fee %'))
        revenue = msrp * (1 - referral_fee_pct)
        
        # Step 3: Total Cost
        cost = self._parse_float(row.get('COST'), default=0.0)
        pick_pack = self._parse_float(row.get('Pick & Pack'), default=0.0)
        if pick_pack == 0: pick_pack = 7.00
        total_cost = cost + pick_pack
        
        # Step 4: Profit
        profit = revenue - total_cost
        
        # Step 5: Margin Percentage
        margin = (profit / msrp) * 100
        return f"{margin:,.2f}%"

    def _calculate_msrp_difference(self, row, buy_box_price):
        # Step 1: Get MSRP
        msrp = self._parse_float_or_none(row.get('MSRP'))
        if msrp is None:
            return ""
            
        if buy_box_price is None:
            return "No Buybox"
            
        # Step 3: Calculate Difference
        diff = buy_box_price - msrp
        return f"{diff:.2f}"
