'use client';

import { useState } from 'react'
import InvoiceForm from '@/features/invoice/components/InvoiceForm'
import InvoicePreview from '@/features/invoice/components/InvoicePreview'
import { 
  generateInvoiceNumber, 
  getInvoiceDate, 
  getOrderDate, 
  generatePONumber, 
  generateSalesOrderNumber
} from '@/features/invoice/utils/invoiceUtils'

interface InvoiceItem {
  id: number;
  imageUrl?: string;
  sku: string;
  item: string;
  upc?: string;
  units: number;
  description: string;
  unitPrice: number;
  [key: string]: any;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderDate: string;
  poNumber: string;
  salesOrderNumber: string;
}

export default function InvoicePage() {
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([])
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)

  const addLineItem = (item: any) => {
    // Generate invoice data when adding first item
    if (lineItems.length === 0 && invoiceData === null) {
      setInvoiceData({
        invoiceNumber: generateInvoiceNumber(),
        invoiceDate: getInvoiceDate(),
        orderDate: getOrderDate(),
        poNumber: generatePONumber(),
        salesOrderNumber: generateSalesOrderNumber()
      })
    }
    setLineItems(prevItems => [...prevItems, { ...item, id: Date.now() + Math.random() }])
  }

  const addMultipleItems = (items: any[]) => {
    // Generate invoice data when adding first items
    if (lineItems.length === 0 && invoiceData === null) {
      setInvoiceData({
        invoiceNumber: generateInvoiceNumber(),
        invoiceDate: getInvoiceDate(),
        orderDate: getOrderDate(),
        poNumber: generatePONumber(),
        salesOrderNumber: generateSalesOrderNumber()
      })
    }
    const newItems = items.map(item => ({ ...item, id: Date.now() + Math.random() }))
    setLineItems(prevItems => [...prevItems, ...newItems])
  }

  const removeLineItem = (id: number) => {
    setLineItems(lineItems.filter(item => item.id !== id))
  }

  const updateLineItem = (id: number, field: string, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const clearInvoice = () => {
    setLineItems([])
    setInvoiceData(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
            <a href="/" className="text-blue-500 hover:underline">← Back to Dashboard</a>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InvoiceForm 
            onAddItem={addLineItem}
            onAddMultipleItems={addMultipleItems}
            lineItems={lineItems}
            onRemoveItem={removeLineItem}
            onUpdateItem={updateLineItem}
            onClear={clearInvoice}
          />
          <InvoicePreview lineItems={lineItems} invoiceData={invoiceData} />
        </div>
      </div>
    </div>
  )
}
