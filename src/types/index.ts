export interface ProductData {
  [key: string]: any;
  Brand?: string;
  Parent?: string;
  ASIN?: string;
  "Imported by Code"?: string;
  Title?: string;
  Color?: string;
  Size?: string;
  "Sales Badge"?: string | number;
  "Parent Sales Badge"?: string;
  "Rating Count"?: number;
  "Rating Count - Child"?: number;
  "Sales Rank"?: number;
  "Sales Rank 30"?: number;
  "Sales Rank 90"?: number;
  "Buy Box"?: number;
  "Buy Box 30"?: number;
  "Buy Box 90"?: number;
  "Buy Box 180"?: number;
  "AMZ In Stock %"?: string;
  "Amazon Availability"?: string;
  FBA?: number;
  FBM?: number;
  "Pick & Pack"?: number;
  "Referral Fee &"?: number;
  COST?: number;
  MSRP?: number | 'N/A';
  "In Stock"?: number;
  Sales?: number;
  
  // Rating Intelligence
  "Total Parent Ratings"?: number;
  "Total Color Ratings"?: number;
  "Global Color Popularity"?: number;
  _isBestColor?: boolean;

  // Calculated fields
  Profit?: number;
  ROI?: number;
  "Profit Margin (Buybox)"?: number | 'No Buybox';
  "Profit Margin (MSRP)"?: number | 'N/A';
  "MSRP Difference"?: number | 'No Buybox' | 'N/A';
  "Price Used For BB Profit"?: string | number;
  "Margin Div"?: number;
  "Amazon URL"?: string;
  
  // Internal tags for highlighting
  _isBestVariant?: boolean;
  
  // Metadata for formatting
  _styles?: {
    [key: string]: {
      fill?: string;
      font?: {
        color?: { rgb: string };
        bold?: boolean;
      };
      comment?: string;
    };
  };
}

export interface ColumnMapping {
  original: string;
  standard: string;
  detected: boolean;
  required: boolean;
}

export interface LiveStats {
  totalSKUs: number;
  profitableCount: number;
  totalPotentialProfit: number;
  avgROI: number;
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'parsing' | 'mapping' | 'processing' | 'exporting' | 'done' | 'error';
  progress: number;
  message: string;
}
