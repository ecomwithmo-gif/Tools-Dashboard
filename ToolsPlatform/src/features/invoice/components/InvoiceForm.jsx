import { useState } from 'react'

const InvoiceForm = ({ onAddItem, onAddMultipleItems, lineItems, onRemoveItem, onUpdateItem, onClear }) => {
  const [formData, setFormData] = useState({
    imageUrl: '',
    sku: '',
    item: '',
    upc: '',
    units: '',
    description: '',
    unitPrice: ''
  })
  const [bulkPaste, setBulkPaste] = useState('')
  const [showBulkPaste, setShowBulkPaste] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.sku && formData.units && formData.description && formData.unitPrice) {
      onAddItem({
        imageUrl: formData.imageUrl || '',
        sku: formData.sku,
        item: formData.item || String(lineItems.length + 1).padStart(6, '0'),
        upc: formData.upc || '',
        units: parseFloat(formData.units) || 0,
        description: formData.description,
        unitPrice: parseFloat(formData.unitPrice) || 0
      })
      setFormData({
        imageUrl: '',
        sku: '',
        item: '',
        upc: '',
        units: '',
        description: '',
        unitPrice: ''
      })
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const parseBulkData = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim())
    const items = []
    let hasHeader = false
    
    // Check if first line is a header
    if (lines.length > 0) {
      const firstLine = lines[0].toLowerCase()
      if (firstLine.includes('brand') || firstLine.includes('item') || firstLine.includes('upc') || firstLine.includes('title') || firstLine.includes('shipped') || firstLine.includes('cost')) {
        hasHeader = true
      }
    }
    
    lines.forEach((line, index) => {
      // Skip header row
      if (hasHeader && index === 0) {
        return
      }
      
      // Try tab-separated first (Excel default), then comma-separated
      const columns = line.includes('\t') 
        ? line.split('\t').map(col => col.trim()).filter(col => col !== '')
        : line.split(',').map(col => col.trim()).filter(col => col !== '')
      
      // Expected format: Brand, Item, UPC, Title, Shipped, Cost (6 columns)
      if (columns.length < 6) {
        return // Skip lines with insufficient columns
      }
      
      const brandName = columns[0] || ''
      const item = columns[1] || ''
      const upc = columns[2] || ''
      const title = columns[3] || ''
      const shipped = columns[4] || ''
      const cost = columns[5] || ''
      
      // Clean numeric values (remove currency symbols, spaces, etc.)
      const cleanShipped = shipped.toString().replace(/[^\d.-]/g, '')
      const cleanCost = cost.toString().replace(/[^\d.-]/g, '')
      
      // Validate required fields
      if (brandName && item && title && cleanShipped && cleanCost) {
        const parsedShipped = parseFloat(cleanShipped)
        const parsedCost = parseFloat(cleanCost)
        
        if (!isNaN(parsedShipped) && !isNaN(parsedCost) && parsedShipped > 0 && parsedCost >= 0) {
          items.push({
            imageUrl: '', // No image URL in new format
            sku: brandName,
            item: item,
            upc: upc,
            description: title,
            units: parsedShipped,
            unitPrice: parsedCost
          })
        }
      }
    })
    
    return items
  }

  const handleBulkPaste = () => {
    const items = parseBulkData(bulkPaste)
    if (items.length === 0) {
      alert('No valid items found. Please check your data format.\n\nExpected format (tab or comma separated):\nBrand, Item, UPC, Title, Shipped, Cost\n\nExample:\nSockers, B0DGXY, 8436624380457, Product Title, 5, 10.00')
      return
    }
    
    // Use bulk add function if available, otherwise add one by one
    if (onAddMultipleItems) {
      onAddMultipleItems(items)
    } else {
      items.forEach(item => {
        onAddItem(item)
      })
    }
    
    setBulkPaste('')
    setShowBulkPaste(false)
    alert(`Successfully added ${items.length} item(s)!`)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Add Line Items</h2>
        <button
          type="button"
          onClick={() => setShowBulkPaste(!showBulkPaste)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
        >
          {showBulkPaste ? 'Hide' : '📋 Bulk Paste'}
        </button>
      </div>

      {showBulkPaste && (
        <div className="mb-6 p-5 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Bulk Paste from Excel</h3>
          <p className="text-xs text-gray-600 mb-3">
            Format: <strong>Brand, Item, UPC, Title, Shipped, Cost</strong> (6 columns, tab or comma separated)
          </p>
          <textarea
            value={bulkPaste}
            onChange={(e) => setBulkPaste(e.target.value)}
            placeholder="Paste your Excel data here (tab or comma separated)..."
            rows="6"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all mb-3 font-mono text-sm bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBulkPaste}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg transition-all shadow-sm hover:shadow"
            >
              Import Items
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkPaste('')
                setShowBulkPaste(false)
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-5 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL (optional)
          </label>
          <input
            type="url"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Brand Name *
          </label>
          <input
            type="text"
            name="sku"
            value={formData.sku}
            onChange={handleChange}
            required
            placeholder="Brand name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Item (optional)
          </label>
          <input
            type="text"
            name="item"
            value={formData.item}
            onChange={handleChange}
            placeholder="Item number (auto-generated if empty)"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            UPC (optional)
          </label>
          <input
            type="text"
            name="upc"
            value={formData.upc}
            onChange={handleChange}
            placeholder="UPC code"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title/Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            placeholder="Product description"
            rows="3"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shipped *
            </label>
            <input
              type="number"
              name="units"
              value={formData.units}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cost *
            </label>
            <input
              type="number"
              name="unitPrice"
              value={formData.unitPrice}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-all shadow-sm hover:shadow"
        >
          Add Item
        </button>
      </form>

      {lineItems.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-900">Line Items ({lineItems.length})</h3>
            <button
              onClick={onClear}
              className="text-red-600 hover:text-red-700 text-xs font-medium hover:underline"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.sku}</p>
                  <p className="text-xs text-gray-600 truncate">{item.description}</p>
                </div>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="ml-4 text-red-600 hover:text-red-700 font-bold text-lg hover:bg-red-50 rounded px-2 py-1 transition-colors"
                  title="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default InvoiceForm

