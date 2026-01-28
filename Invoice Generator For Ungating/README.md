# Invoice Generator

A modern, sleek invoice generator application built with React and TailwindCSS.

## Features

- **Easy-to-use UI**: Add line items with image URLs, SKU, units, description, and unit price
- **Automatic Calculations**: Subtotal and total are calculated automatically
- **Smart Date Generation**: 
  - Invoice date: 7 days prior to creation
  - Order date: 16 days prior to creation
- **Random Number Generation**: 
  - Invoice number (based on date)
  - PO number (random)
  - Sales order number (random)
- **Professional Invoice Layout**: Clean, printable invoice format
- **Print/PDF Support**: Print or save as PDF directly from browser

## Static Information

- **From**: Footwear Giant Group LLC, 30 N Gould St, Ste R, Sheridan, WY 82801
- **To**: MMM DISTRIBUTION, 1776 S PALO VERDE AVE STE D12, TUCSON AZ 85713
- **Customer Number**: 367494
- **Payment Terms**: Net 30
- **Status**: Paid
- **Ship**: Collect
- **Shipping Cost**: Always $0.00

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Usage

1. Fill in the form with product details (SKU, description, units, unit price)
2. Optionally add an image URL
3. Click "Add Item" to add the line item
4. Review the invoice preview on the right
5. Click "Print / Save PDF" to print or save as PDF


