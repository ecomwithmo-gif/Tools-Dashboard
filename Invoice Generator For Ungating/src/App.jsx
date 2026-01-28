import { useState } from 'react'
import InvoiceForm from './components/InvoiceForm'
import InvoicePreview from './components/InvoicePreview'
import { 
  generateInvoiceNumber, 
  getInvoiceDate, 
  getOrderDate, 
  generatePONumber, 
  generateSalesOrderNumber
} from './utils/invoiceUtils'

function App() {
  const [lineItems, setLineItems] = useState([])
  const [invoiceData, setInvoiceData] = useState(null)

  const addLineItem = (item) => {
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

  const addMultipleItems = (items) => {
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

  const removeLineItem = (id) => {
    setLineItems(lineItems.filter(item => item.id !== id))
  }

  const updateLineItem = (id, field, value) => {
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

export default App

