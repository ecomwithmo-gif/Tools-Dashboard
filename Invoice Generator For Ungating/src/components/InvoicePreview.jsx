import { useRef } from 'react'
import {
  generateInvoiceNumber,
  getInvoiceDate,
  getOrderDate,
  generatePONumber,
  generateSalesOrderNumber,
  calculateSubtotal,
  calculateTotal
} from '../utils/invoiceUtils'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const InvoicePreview = ({ lineItems, invoiceData }) => {
  const invoiceRef = useRef(null)
  
  // Use provided invoice data or generate new if not available
  const currentInvoiceData = invoiceData || {
    invoiceNumber: generateInvoiceNumber(),
    invoiceDate: getInvoiceDate(),
    orderDate: getOrderDate(),
    poNumber: generatePONumber(),
    salesOrderNumber: generateSalesOrderNumber()
  }
  
  const subtotal = calculateSubtotal(lineItems)
  const shipping = 0
  const total = calculateTotal(lineItems)
  const totalQuantity = lineItems.reduce((sum, item) => sum + item.units, 0)

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return
    
    try {
      // Store original styles
      const originalStyles = {
        padding: invoiceRef.current.style.padding,
        margin: invoiceRef.current.style.margin,
        borderRadius: invoiceRef.current.style.borderRadius,
        width: invoiceRef.current.style.width,
        maxWidth: invoiceRef.current.style.maxWidth,
        overflow: invoiceRef.current.style.overflow
      }
      
      // Temporarily set styles for better capture
      invoiceRef.current.style.padding = '20px'
      invoiceRef.current.style.margin = '0'
      invoiceRef.current.style.borderRadius = '0'
      invoiceRef.current.style.width = '210mm' // A4 width
      invoiceRef.current.style.maxWidth = 'none'
      invoiceRef.current.style.overflow = 'visible'
      
      // Ensure table is fully visible
      const tables = invoiceRef.current.querySelectorAll('table')
      tables.forEach(table => {
        table.style.width = '100%'
        table.style.tableLayout = 'auto'
      })
      
      // Wait a bit for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: invoiceRef.current.scrollWidth,
        height: invoiceRef.current.scrollHeight,
        windowWidth: invoiceRef.current.scrollWidth,
        windowHeight: invoiceRef.current.scrollHeight,
        allowTaint: false,
        removeContainer: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Ensure all elements are visible in the clone
          const clonedElement = clonedDoc.querySelector('.invoice-container')
          if (clonedElement) {
            clonedElement.style.width = '210mm'
            clonedElement.style.maxWidth = 'none'
            clonedElement.style.overflow = 'visible'
          }
        }
      })
      
      // Restore original styles
      Object.keys(originalStyles).forEach(key => {
        invoiceRef.current.style[key] = originalStyles[key] || ''
      })
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Set professional PDF metadata
      const producerString = 'MMM Distribution Enterprise Billing System v2.1'
      pdf.setProperties({
        title: `Invoice ${currentInvoiceData.invoiceNumber} - MMM Distribution`,
        subject: 'Sales Invoice',
        author: 'MMM Distribution',
        creator: producerString,
        producer: producerString,
        keywords: 'invoice, sales invoice, billing, MMM Distribution, commercial invoice',
        creationDate: new Date()
      })
      
      // Override PDF Producer in internal structure to ensure it shows correctly
      try {
        // Set producer in info dictionary
        if (pdf.internal && pdf.internal.info) {
          pdf.internal.info.Producer = producerString
        }
        // Also set in the output stream if possible
        if (pdf.internal && pdf.internal.newObject) {
          // Producer will be set when PDF is finalized
        }
      } catch (e) {
        // Producer metadata is set via setProperties above
      }
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Calculate dimensions
      const margin = 5 // 5mm margin
      const availableWidth = pdfWidth - (margin * 2)
      const availableHeight = pdfHeight - (margin * 2)
      
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = imgWidth / imgHeight
      
      // Calculate final dimensions
      let finalWidth = availableWidth
      let finalHeight = finalWidth / ratio
      
      // If content is taller than one page, handle pagination
      if (finalHeight > availableHeight) {
        // Scale to fit height
        finalHeight = availableHeight
        finalWidth = finalHeight * ratio
        
        // Calculate how many pages we need
        const totalHeight = finalHeight
        const pagesNeeded = Math.ceil(totalHeight / availableHeight)
        
        let yPosition = margin
        let sourceY = 0
        
        for (let page = 0; page < pagesNeeded; page++) {
          if (page > 0) {
            pdf.addPage()
            yPosition = margin
          }
          
          const pageHeight = Math.min(availableHeight, totalHeight - (page * availableHeight))
          const sourceHeight = (pageHeight / finalHeight) * imgHeight
          
          // Create a temporary canvas for this page slice
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = imgWidth
          pageCanvas.height = sourceHeight
          const ctx = pageCanvas.getContext('2d')
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight)
          
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0)
          pdf.addImage(pageImgData, 'PNG', margin, yPosition, finalWidth, pageHeight)
          
          sourceY += sourceHeight
        }
      } else {
        // Single page
        pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight)
      }
      
      pdf.save(`Invoice-${currentInvoiceData.invoiceNumber}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try printing instead.')
    }
  }

  const staticInfo = {
    from: {
      name: 'MMM DISTRIBUTION',
      address: '1776 S PALO VERDE AVE STE D12',
      city: 'TUCSON AZ 85713',
      phone: '442-389-0895',
      email: 'billing@mmmdistribution.com'
    },
    billTo: {
      name: 'WOAH SOFT GOODS LLC',
      address: '1144 S DESERT SENNA LOOP',
      suite: '',
      city: 'Tucson, AZ 85748'
    },
    shipTo: {
      name: 'WOAH SOFT GOODS LLC',
      address: '1144 S DESERT SENNA LOOP',
      suite: '',
      city: 'Tucson, AZ 85748'
    },
    customerNumber: '367494',
    paymentTerms: 'Net 30',
    status: 'Open',
    ship: 'Collect'
  }

  const terms = `TERMS & CONDITIONS
1. CLAIMS - Goods must be counted upon receipt. We are not responsible for any goods after altered from original delivered form. All claims or demands for defective merchandise must be made in writing by certified mail within 5 days of receipt goods. Failure to give such notice shall constitute unqualified acceptance and waiver of all such claims by buyer. Written return authorization is required by seller for returns. Any errors in items or price must be reported within 5 days. Absolutely no returns will be accepted or allowances made after goods have been altered from original delivered form.
2. CASUALTIES - Goods delivered throughout common carriers or sent via parcel post are at the risk of buyer. In no event shall the seller be liable for loss of profits, late deliveries, damages for breach of contract by buyer, or other consequential or contingent losses.
Thank you for your business!`

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">Invoice Preview</h2>
        {lineItems.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={handleExportPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-sm transition-all shadow-sm hover:shadow flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF
            </button>
            <button
              onClick={handlePrint}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded text-sm transition-all shadow-sm hover:shadow flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        )}
      </div>

      {lineItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">Add line items to see invoice preview</p>
        </div>
      ) : (
         <div ref={invoiceRef} className="invoice-container bg-white p-4 border border-gray-300" style={{ minWidth: '210mm', width: '100%' }}>
           {/* Compact Header */}
           <div className="flex justify-between items-start border-b border-gray-300 pb-2 mb-2">
             <div>
               <p className="text-xs text-gray-500 uppercase mb-0.5">From</p>
               <p className="text-sm font-bold text-gray-900">{staticInfo.from.name}</p>
               <p className="text-xs text-gray-700">{staticInfo.from.address}</p>
               <p className="text-xs text-gray-700">{staticInfo.from.city}</p>
               <p className="text-xs text-gray-700">{staticInfo.from.phone}</p>
               {staticInfo.from.email && <p className="text-xs text-gray-700">{staticInfo.from.email}</p>}
             </div>
             <div className="text-right">
               <p className="text-lg font-bold text-gray-900">INVOICE</p>
               <p className="text-sm font-bold text-gray-900">Invoice #{currentInvoiceData.invoiceNumber}</p>
               <p className="text-xs text-gray-600">PO: {currentInvoiceData.poNumber}</p>
               <p className="text-xs text-gray-600">Sales Order #: {currentInvoiceData.salesOrderNumber}</p>
               <div className="mt-2 text-xs space-y-0.5">
                 <p className="text-gray-700"><span className="text-gray-500">Invoice Date:</span> {currentInvoiceData.invoiceDate}</p>
                 <p className="text-gray-700"><span className="text-gray-500">Order Date:</span> {currentInvoiceData.orderDate}</p>
                 <p className="text-gray-700"><span className="text-gray-500">Payment Terms:</span> {staticInfo.paymentTerms}</p>
                 <p className="text-gray-700"><span className="text-gray-500">Customer #:</span> {staticInfo.customerNumber}</p>
               </div>
             </div>
           </div>

           {/* Compact Bill to / Ship to */}
           <div className="grid grid-cols-2 gap-3 mb-2 text-xs">
             <div>
               <p className="text-gray-500 uppercase mb-0.5 font-semibold">Bill To</p>
               <p className="font-bold text-gray-900">{staticInfo.billTo.name}</p>
               <p className="text-gray-700">{staticInfo.billTo.address}{staticInfo.billTo.suite ? ', ' + staticInfo.billTo.suite : ''}</p>
               <p className="text-gray-700">{staticInfo.billTo.city}</p>
             </div>
             <div>
               <p className="text-gray-500 uppercase mb-0.5 font-semibold">Ship To</p>
               <p className="font-bold text-gray-900">{staticInfo.shipTo.name}</p>
               <p className="text-gray-700">{staticInfo.shipTo.address}{staticInfo.shipTo.suite ? ', ' + staticInfo.shipTo.suite : ''}</p>
               <p className="text-gray-700">{staticInfo.shipTo.city}</p>
             </div>
           </div>

           {/* Shipping Information */}
           <div className="grid grid-cols-2 gap-2 mb-2 text-xs border-b border-gray-200 pb-2">
             <div>
               <span className="text-gray-500">Ship Via:</span>
               <span className="ml-1 font-semibold text-gray-900">{staticInfo.ship}</span>
             </div>
             <div>
               <span className="text-gray-500">FREIGHT METHOD/TERMS:</span>
               <span className="ml-1 font-semibold text-gray-900">FOB Origin</span>
             </div>
           </div>

          {/* Line Items Table */}
          <div className="mb-2">
            <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '12%' }}>Brand</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '12%' }}>Item</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '12%' }}>UPC</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '28%' }}>Title</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '10%' }}>Shipped</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '10%' }}>Cost</th>
                  <th className="px-2 py-1 text-center font-semibold" style={{ width: '16%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={item.id} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="font-medium text-gray-900">{item.sku}</span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="text-gray-700">{item.item || String(index + 1).padStart(6, '0')}</span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="text-gray-700">{item.upc || '—'}</span>
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className="text-gray-700 line-clamp-2 block">{item.description}</span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="text-gray-900">{item.units}</span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="text-gray-900">${item.unitPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <span className="font-semibold text-gray-900">${(item.units * item.unitPrice).toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
                {/* Total Quantity Row */}
                <tr className="bg-gray-100 border-t-2 border-gray-400 font-semibold">
                  <td colSpan="5" className="px-2 py-1 text-center text-gray-900">
                    Qty Totals:
                  </td>
                  <td className="px-2 py-1 text-center text-gray-900">
                    {totalQuantity}
                  </td>
                  <td className="px-2 py-1 text-center text-gray-900">
                    ${subtotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Compact Totals */}
          <div className="flex justify-end mb-2">
            <div className="w-64">
              <div className="border border-gray-300">
                <div className="flex justify-between px-3 py-1.5 text-xs border-b border-gray-200">
                  <span className="text-gray-700">Sub Total</span>
                  <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 text-xs border-b border-gray-200">
                  <span className="text-gray-700">Freight</span>
                  <span className="font-semibold text-gray-900">${shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between px-3 py-1.5 bg-gray-900 text-white font-bold">
                  <span>Balance Due</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Remittance */}
          <div className="text-xs text-gray-600 mb-2">
            <p className="font-semibold text-gray-800 mb-0.5">Remittance</p>
            <p className="mb-0">Please remit payment to MMM Distribution and include the invoice number with your payment. Billing questions: {staticInfo.from.email}</p>
          </div>

          {/* Terms & Conditions */}
          <div className="mt-2 pt-2 border-t border-gray-300">
            <h3 className="text-xs font-bold text-gray-900 uppercase mb-1">Terms & Conditions</h3>
            <div className="bg-gray-50 p-2 border border-gray-200">
              <pre className="text-[10px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed m-0">
                {terms}
              </pre>
            </div>
          </div>

          {/* Remit To Address */}
          <div className="mt-3 pt-2 border-t border-gray-300">
            <p className="text-xs font-bold text-gray-900 uppercase mb-1">Remit Payment To:</p>
            <div className="text-xs text-gray-700">
              <p className="font-semibold">{staticInfo.from.name}</p>
              <p>{staticInfo.from.address}</p>
              <p>{staticInfo.from.city}</p>
              <p className="mt-1">Please include invoice number {currentInvoiceData.invoiceNumber} with your payment.</p>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default InvoicePreview
