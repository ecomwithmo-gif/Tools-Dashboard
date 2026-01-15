// Generate invoice number based on date (7 days prior)
export const generateInvoiceNumber = () => {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `INV-${year}${month}${day}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
}

// Generate invoice date (7 days prior)
export const getInvoiceDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

// Generate order date (16 days prior)
export const getOrderDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 16)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

// Generate random PO number (just the number, no prefix)
export const generatePONumber = () => {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
}

// Generate random Sales Order number (just the number, no prefix)
export const generateSalesOrderNumber = () => {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
}

// Calculate subtotal
export const calculateSubtotal = (lineItems) => {
  return lineItems.reduce((sum, item) => {
    return sum + (item.units * item.unitPrice)
  }, 0)
}

// Calculate total
export const calculateTotal = (lineItems) => {
  const subtotal = calculateSubtotal(lineItems)
  const shipping = 0 // Always 0
  return subtotal + shipping
}

