import unittest
from profit_calculator import ProfitMetricsCalculator

class TestProfitMetricsCalculator(unittest.TestCase):
    def setUp(self):
        self.calc = ProfitMetricsCalculator()

    def test_profit_example_from_prompt(self):
        # Example 1: Standard case
        row = {
            'Buy Box': '50.00',
            'Referral Fee %': '15', # Will be parsed as 0.15
            'COST': '18.00',
            'Pick & Pack': '6.50'
        }
        result = self.calc.calculate_metrics(row)
        
        # Revenue = 50 * 0.85 = 42.50
        # Cost = 18 + 6.50 = 24.50
        # Profit = 42.50 - 24.50 = 18.00
        self.assertEqual(result['Profit'], '$18.00')
        
        # ROI = 18 / 18 * 100 = 100.00
        self.assertEqual(result['ROI'], '100.00')
        
        # Margin BB = 18 / 50 * 100 = 36.00%
        self.assertEqual(result['Profit Margin (Buybox)'], '36.00%')
        self.assertEqual(result['Price Used For BB Profit'], '50.00')

    def test_roi_calculation_standalone(self):
        # Verifying ROI logic specifically with float input logic
        # row needs to produce proft=18, cost=18
        row = {
            'Buy Box': '50.00',
            'Referral Fee %': '0.15',
            'COST': '18.00',
            'Pick & Pack': '6.50'
        }
        result = self.calc.calculate_metrics(row)
        self.assertEqual(result['ROI'], '100.00')

    def test_margin_msrp_example(self):
        row = {
            'MSRP': '75.00',
            'Referral Fee %': '15',
            'COST': '18.00',
            'Pick & Pack': '6.50'
        }
        # Note: Logic for Profit uses Waterfall. If Buy Box is missing, it falls back to MSRP (Priority 4).
        # So Profit calculation uses MSRP as sale price here.
        # Revenue = 75 * 0.85 = 63.75
        # Cost = 24.50
        # Profit = 39.25
        
        result = self.calc.calculate_metrics(row)
        # Margin MSRP = 39.25 / 75 * 100 = 52.333... -> 52.33%
        self.assertEqual(result['Profit Margin (MSRP)'], '52.33%')

    def test_msrp_difference_examples(self):
        # Discounted
        row1 = {'Buy Box': '42.00', 'MSRP': '50.00'}
        res1 = self.calc.calculate_metrics(row1)
        self.assertEqual(res1['MSRP Difference'], '-8.00')
        
        # Premium
        row2 = {'Buy Box': '65.00', 'MSRP': '60.00'}
        res2 = self.calc.calculate_metrics(row2)
        self.assertEqual(res2['MSRP Difference'], '5.00')

    def test_waterfall_logic(self):
        # Priority 1: Buy Box
        row1 = {'Buy Box': '10.00', 'Buy Box 90': '20.00', 'COST': '5.00'} 
        # Rev: 8.5, Cost: 12 (5+7), Profit: -3.5
        # Check that it picked 10.00, not 20.00
        # If it picked 20: Rev 17, Profit 5.
        
        # Let's check Margin BB to see which price it used
        # Margin = Profit / Price
        # If price 10: Profit=-3.5, M = -35%
        # If price 20: Profit=5, M = 25%
        res1 = self.calc.calculate_metrics(row1)
        # We can check specific values. 
        # 10 * 0.85 = 8.5. Cost = 5 + 7 = 12. Profit = -3.5.
        self.assertEqual(res1['Profit'], '$-3.50')
        self.assertEqual(res1['Price Used For BB Profit'], '10.00')

        # Priority 2: Buy Box 90
        row2 = {'Buy Box': '', 'Buy Box 90': '100.00', 'COST': '10.00'}
        # Rev: 85. Cost: 17. Profit: 68.
        res2 = self.calc.calculate_metrics(row2)
        self.assertEqual(res2['Profit'], '$68.00')
        self.assertEqual(res2['Profit Margin (Buybox)'], '68.00%')
        self.assertEqual(res2['Price Used For BB Profit'], '100.00')

    def test_defaults(self):
        # Default Pick & Pack = 7.00
        # Default Fee = 0.15
        row = {'Buy Box': '100.00', 'COST': '10.00'}
        # Rev = 85. Cost = 10 + 7 = 17. Profit = 68.
        res = self.calc.calculate_metrics(row)
        self.assertEqual(res['Profit'], '$68.00')

    def test_no_buybox_values(self):
        # All empty
        row = {'COST': '10.00'} 
        # Sale Price = None.
        # Revenue = 0. Cost = 17. Profit = -17.
        res = self.calc.calculate_metrics(row)
        self.assertEqual(res['Profit'], '$-17.00')
        self.assertEqual(res['Profit Margin (Buybox)'], 'No Buybox')
        self.assertEqual(res['Price Used For BB Profit'], 'No Buybox')
        self.assertEqual(res['MSRP Difference'], '') # MSRP is missing too
        
        # ROI? Profit -17. Cost 10. ROI = -170%
        # Wait, simple math -17 / 10 * 100 = -170.00
        self.assertEqual(res['ROI'], '-170.00') 

    def test_zero_cost_roi_handling(self):
        row = {'Buy Box': '10.00', 'COST': '0.00'}
        res = self.calc.calculate_metrics(row)
        self.assertEqual(res['ROI'], '')

if __name__ == '__main__':
    unittest.main()
