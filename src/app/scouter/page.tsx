"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Play, Download, CheckCircle2, AlertCircle, RefreshCw, BarChart3, Calculator, Terminal, FileSpreadsheet } from 'lucide-react';
import { FileUploader, ProgressBar, ColumnMappingPanel, ActivityLog, DataPreview, ValidationStatus, LiveStatsBoard } from '@/components/AnalysisUI';
import { parseExcel, detectColumns, processData } from '@/lib/processor';
import { exportToExcel, exportToGoogleSheets } from '@/lib/exporter';
import { COLUMN_PATTERNS, COST_PATTERNS, cn } from '@/lib/utils';

import { ProcessingState, ProductData, LiveStats } from '@/types';

export default function Home() {
  const [mainFiles, setMainFiles] = useState<File[]>([]);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [miscCost, setMiscCost] = useState(0);
  const [orderBudget, setOrderBudget] = useState(0);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [googleExporting, setGoogleExporting] = useState(false);

  
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [processedData, setProcessedData] = useState<ProductData[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  // Preview & Validation State
  const [mainPreview, setMainPreview] = useState<any[]>([]);
  const [costPreview, setCostPreview] = useState<any[]>([]);
  const [costHeaders, setCostHeaders] = useState<string[]>([]);
  const [costMappings, setCostMappings] = useState<Record<string, string>>({});
  const [showCostMapping, setShowCostMapping] = useState(false);
  const [stockPreview, setStockPreview] = useState<any[]>([]);
  const [costValidation, setCostValidation] = useState<{ isValid: boolean; missing: string[] }>({ isValid: false, missing: [] });
  const [stockHeaders, setStockHeaders] = useState<string[]>([]);
  const [stockMappings, setStockMappings] = useState<Record<string, string>>({});

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), msg]); 
  }, []);

  // Auto-detect columns when main files are uploaded
  useEffect(() => {
    if (mainFiles.length > 0 && processingState.status === 'idle') {
      handleParseMainFiles();
    } else if (mainFiles.length === 0) {
      setMainPreview([]);
    }
  }, [mainFiles]);

  useEffect(() => {
    if (costFile) {
      handleParseCostFile();
    } else {
      setCostPreview([]);
      setCostHeaders([]);
      setCostMappings({});
      setShowCostMapping(false);
      setCostValidation({ isValid: false, missing: [] });
    }
  }, [costFile]);

  useEffect(() => {
    if (stockFile) {
      handleParseStockFile();
    } else {
      setStockPreview([]);
      setStockHeaders([]);
      setStockMappings({});
    }
  }, [stockFile]);

  const handleParseMainFiles = async () => {
    if (mainFiles.length === 0) return;
    
    addLog(`Uploaded ${mainFiles.length} file(s). Merging data...`);
    setProcessingState({ status: 'parsing', progress: 10, message: 'Parsing and merging files...' });
    
    let mergedData: any[] = [];
    let combinedHeaders: string[] = [];
    
    try {
      for (const file of mainFiles) {
         addLog(`Parsing: ${file.name}`);
         const { data, headers } = await parseExcel(file);
         
         if (combinedHeaders.length === 0) combinedHeaders = headers;
         mergedData = [...mergedData, ...data];
      }

      if (mergedData.length > 0) {
        setMainPreview(mergedData.slice(0, 5));
        setAvailableColumns(combinedHeaders);
        addLog(`Successfully merged ${mergedData.length} total rows.`);
        addLog(`Previewing first 5 rows...`);
        
        const detected = detectColumns(combinedHeaders);
        setMappings(detected);
        const matchCount = Object.keys(detected).length;
        addLog(`Auto-mapped ${matchCount} columns successfully`);
        
        setProcessingState({ status: 'mapping', progress: 30, message: 'Ready for analysis' });
      }
    } catch (err) {
      addLog(`Error during parsing: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProcessingState({ status: 'error', progress: 0, message: 'Failed to parse files' });
    }
  };

  const handleParseCostFile = async () => {
    if (!costFile) return;
    addLog(`Previewing cost file: ${costFile.name}`);
    try {
      const { data, headers } = await parseExcel(costFile);
      if (headers.length > 0) {
        setCostPreview(data.slice(0, 5));
        setCostHeaders(headers);
        
        // Use detectColumns for cost file too
        const detected = detectColumns(headers, COST_PATTERNS);
        setCostMappings(detected);

        const check = (pattern: string) => Object.values(detected).includes(pattern) || headers.some(h => h.trim() === pattern); // fallback

        // We validate based on the MAPPING, not the raw headers solely
        const validateMappings = (currentMappings: Record<string, string>) => {
           const missing = [];
           if (!currentMappings['Imported by Code']) missing.push('Imported by Code');
           if (!currentMappings['COST']) missing.push('COST');
           if (!currentMappings['MSRP']) missing.push('MSRP');
           
           setCostValidation({
              isValid: missing.length === 0,
              missing
           });
           
           if (missing.length === 0) addLog('Cost file validation passed (Green Status)');
           else addLog(`Cost file needs mapping: ${missing.join(', ')}`);
        };

        validateMappings(detected);
      }
    } catch (err) {
      addLog(`Error Parsing Cost File: ${costFile.name}`);
    }
  };

  const handleParseStockFile = async () => {
    if (!stockFile) return;
    addLog(`Parsing performance file: ${stockFile.name}`);
    try {
      const { data, headers } = await parseExcel(stockFile);
      if (headers.length > 0) {
        setStockPreview(data.slice(0, 5));
        setStockHeaders(headers);
        
        // Auto-match specific columns for this file
        const detected = detectColumns(headers);
        setStockMappings(detected);
        addLog(`Auto-detected Stock/Sales columns in ${stockFile.name}`);
      }
    } catch (err) {
      addLog(`Error Parsing Stock File: ${stockFile.name}`);
    }
  };

  const updateMapping = (standard: string, selected: string) => {
    setMappings(prev => ({ ...prev, [standard]: selected }));
    addLog(`Manually mapped [${standard}] to "${selected}"`);
  };

  const updateCostMapping = (standard: string, selected: string) => {
    setCostMappings(prev => {
        const next = { ...prev, [standard]: selected };
        
        // Re-validate
        const missing = [];
        if (!next['Imported by Code']) missing.push('Imported by Code');
        if (!next['COST']) missing.push('COST');
        if (!next['MSRP']) missing.push('MSRP');
        
        setCostValidation({
            isValid: missing.length === 0,
            missing
        });
        
        return next;
    });
    addLog(`Manually mapped Cost [${standard}] to "${selected}"`);
  };

  const handleProcess = async () => {
    if (mainFiles.length === 0) return;
    addLog('Starting comprehensive analysis engine...');
    setProcessingState({ status: 'processing', progress: 40, message: 'Initializing...' });
    
    try {
      // 1. Re-parse merge (or we could store it, but memory might be an issue. 
      // Re-parsing is safer for memory usually if we cleared previews, but here we kept them? 
      // Actually, we haven't stored the FULL mergedData in state to save RAM, only preview.
      // So we parse again.
      
      let mergedMainData: any[] = [];
      
      // 1. Pre-process each file individually to handle heterogeneous headers (Excel vs CSV mixed)
      for (const file of mainFiles) {
        addLog(`Processing ${file.name}...`);
        const { data, headers } = await parseExcel(file);
        
        // Detect columns for THIS specific file
        const fileMapping = detectColumns(headers);
        
        // Apply User Overrides from UI if the column exists in this file
        // (This handles cases where user manually mapped "My Custom UPC" -> "Imported by Code")
        for (const [std, userSelectedCol] of Object.entries(mappings)) {
            // Check if user's selected column exists in this file's headers
            // We use a loose check (trim) to be safe
            if (headers.some(h => h.trim() === userSelectedCol.trim())) {
                 fileMapping[std] = userSelectedCol;
            }
        }
        
        const upcCol = fileMapping['Imported by Code'];
        if (upcCol) {
            addLog(`File [${file.name}]: Using column "${upcCol}" for UPC matching.`);
        } else {
            addLog(`File [${file.name}]: WARNING - No UPC column detected!`);
        }
        
        // Map rows to Standard Schema immediately
        const mappedRows = data.map(row => {
            const newRow: any = {};
            // 1. Transfer Mapped Columns to Standard Keys
            for (const [std, originalCol] of Object.entries(fileMapping)) {
                 newRow[std] = row[originalCol];
            }
            // 2. Preserve unmapped columns (optional, but good for reference)
            // We prefix them or just keep them? processData only cares about Standard Keys.
            // Let's keep them in case custom logic needs them, but strictly processData uses mapping.
            // Actually, processData's mapAndSanitize uses the mapping to PULL data.
            // Since we are creating a Standardized Object, we don't need the original junk.
            return newRow;
        });
        
        mergedMainData = [...mergedMainData, ...mappedRows];
      }
      
      // Create an Identity Mapping because mergedMainData is already using Standard Keys
      const identityMapping: Record<string, string> = {};
      Object.keys(COLUMN_PATTERNS).forEach(k => identityMapping[k] = k);
      
      let costData: any[] = [];
      if (costFile) {
        // addLog(`Reading cost file...`);
        const { data } = await parseExcel(costFile);
        costData = data;
      }

      let stockData: any[] = [];
      if (stockFile) {
        // addLog(`Reading stock file...`);
        const { data } = await parseExcel(stockFile);
        stockData = data;
      }

      const result = await processData(
        mergedMainData, 
        identityMapping, // Use Identity Mapping as data is pre-mapped
        costData, 
        costMappings, 
        stockData,
        stockMappings,
        shippingCost, 
        miscCost,
        (progress, message, stats) => {
          setProcessingState({ status: 'processing', progress, message });
          if (stats) setLiveStats(stats);
          addLog(message);
        }
      );
      
      setProcessedData(result);
      addLog(`Analysis complete. Processed ${result.length} unique items.`);
      setProcessingState({ status: 'done', progress: 100, message: 'Analysis complete!' });
    } catch (err) {
      console.error(err);
      addLog(`Critical Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProcessingState({ status: 'error', progress: 0, message: 'Processing failed' });
    }
  };

  const handleDownload = async () => {
    if (processedData.length === 0 || mainFiles.length === 0) return;
    const baseName = mainFiles[0].name.replace(/\.[^/.]+$/, ""); // Strip extension
    const exportName = `${baseName}_Analyzed`;

    addLog('Generating professional Excel report...');
    setProcessingState({ status: 'exporting', progress: 0, message: 'Initializing export...' });
    
    try {
      await exportToExcel(processedData, exportName, (msg) => {
        setProcessingState(prev => ({ ...prev, status: 'exporting', message: msg, progress: Math.min(prev.progress + 2, 95) }));
        addLog(msg);
      }, orderBudget);
      addLog('Report generated and downloaded successfully.');
      setProcessingState({ status: 'done', progress: 100, message: 'Report downloaded' });
    } catch (err) {
      addLog(`Export Error: ${err instanceof Error ? err.message : 'Download failed'}`);
      setProcessingState({ status: 'error', progress: 0, message: 'Export failed' });
    }
  };

  const handleGoogleExport = async () => {
    if (processedData.length === 0) return;
    
    setGoogleExporting(true);
    addLog('Initiating Google Sheets export...');
    
    try {
      const baseName = mainFiles[0]?.name.replace(/\.[^/.]+$/, "") || "Export"; 
      const exportName = `${baseName}_Analyzed_${new Date().toISOString().split('T')[0]}`;
      
      const result = await exportToGoogleSheets(processedData, exportName);
      
      if (!result) {
        throw new Error("Server action returned no response. The dataset might be too large or contain invalid data.");
      }

      if (result.success && result.url) {
        addLog('Google Sheet created successfully!');
        window.open(result.url, '_blank');
      } else {
        throw new Error(result.error || "Unknown export error");
      }
    } catch (err) {
      addLog(`Google Sheet Export Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGoogleExporting(false);
    }
  };

  const reset = () => {
    setMainFiles([]);
    setCostFile(null);
    setStockFile(null);
    setProcessedData([]);
    setLogs([]);
    setMappings({});
    setMainPreview([]); // Clear preview
    setLiveStats(null);
    setProcessingState({ status: 'idle', progress: 0, message: '' });
  };

  const mappingList = Object.keys(COLUMN_PATTERNS).map(standard => ({
    standard,
    detected: mappings[standard] || null,
    status: mappings[standard] ? 'ok' : (['Brand', 'Parent', 'ASIN', 'Title'].includes(standard) ? 'error' : 'warn') as any
  }));

  const costMappingList = Object.keys(COST_PATTERNS).map(standard => ({
      standard,
      detected: costMappings[standard] || null,
      status: costMappings[standard] ? 'ok' : 'error' as any
  }));

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900" />
      
      <div className="p-6 lg:p-12 max-w-[1440px] mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="bg-gradient-to-br from-slate-800 to-blue-900 text-white p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
                <BarChart3 size={28} />
              </span>
              Profitability Calculator
            </h1>
            <p className="text-slate-500 font-medium">Professional Amazon Product Data Analysis Tool</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
              <RefreshCw size={16} /> Reset
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">v1.1.0 - MULTI-FILE</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Data Input & Mapping */}
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-8">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <Calculator className="text-blue-900" size={20} />
                <h2 className="font-bold text-slate-900">Data Integration</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FileUploader
                  label="Product Data File(s)"
                  description="Upload one or multiple XLSX/CSV files"
                  onFileSelect={(files) => setMainFiles(Array.isArray(files) ? files : [files])}
                  selectedFiles={mainFiles} // Pass array
                  onClear={() => setMainFiles([])}
                  required
                  multiple // Enable multi-file support
                />
                <div className="space-y-6">
                  <FileUploader
                    label="Cost/MSRP File"
                    description="Optional cost data mapping"
                    onFileSelect={(f) => setCostFile(Array.isArray(f) ? f[0] : f)}
                    selectedFile={costFile}
                    onClear={() => setCostFile(null)}
                  />
                  <FileUploader
                    label="In Stock / Sales File"
                    description="Optional performance data mapping"
                    onFileSelect={(f) => setStockFile(Array.isArray(f) ? f[0] : f)}
                    selectedFile={stockFile}
                    onClear={() => setStockFile(null)}
                  />
                  {costFile && (
                    <div className="space-y-2">
                        <ValidationStatus 
                          isValid={costValidation.isValid} 
                          message={costValidation.isValid ? "Cost Data Ready" : "Map Columns Needed"}
                          missing={costValidation.missing}
                        />
                         <button
                            onClick={() => setShowCostMapping(!showCostMapping)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 underline pl-1"
                        >
                            {showCostMapping ? "Hide Cost Mapping" : "Map Cost Columns"}
                        </button>
                    </div>
                  )}
                </div>
              </div>

              {processingState.status !== 'idle' && (
                <div className="pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                  <ProgressBar progress={processingState.progress} status={processingState.message} />
                  {processingState.status === 'error' && (
                    <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {processingState.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Live Stats Board */}
            {liveStats && (
              <LiveStatsBoard stats={liveStats} />
            )}

            {/* Previews Section */}
            {(mainPreview.length > 0 || costPreview.length > 0 || stockPreview.length > 0) && (
              <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {mainPreview.length > 0 && <DataPreview data={mainPreview} title="Merged Product Data" />}
                {costPreview.length > 0 && <DataPreview data={costPreview} title="Cost / MSRP" />}
                {stockPreview.length > 0 && <DataPreview data={stockPreview} title="In Stock / Sales" />}
              </div>
            )}

            {/* Interactive Mapping Panel */}
            {mainFiles.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ColumnMappingPanel 
                  mappings={mappingList} 
                  allColumns={availableColumns}
                  onUpdate={updateMapping} 
                />
              </div>
            )}

            {/* Cost Mapping Panel */}
            {showCostMapping && costFile && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-50 p-4 rounded-xl border border-blue-100 mb-4">
                        <h4 className="font-bold text-blue-900 mb-2">Cost File Columns</h4>
                         <ColumnMappingPanel 
                            mappings={costMappingList}
                            allColumns={costHeaders}
                            onUpdate={updateCostMapping}
                         />
                    </div>
                </div>
            )}

            {/* Activity Logs Dashboard */}
            <ActivityLog logs={logs} />
          </div>

          {/* Right Column: Settings & Summary */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-8 sticky top-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <Settings className="text-slate-400" size={20} />
                <h2 className="font-bold text-slate-900">Global Adjustments</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Shipping Cost (Per Unit)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input 
                      type="number" 
                      value={shippingCost || ''}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 outline-none transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Misc. Cost (Per Unit)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input 
                      type="number" 
                      value={miscCost || ''}
                      onChange={(e) => setMiscCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 outline-none transition-all font-medium text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Automatically generates a smart &quot;Order Draft&quot; maximizing potential based on this budget.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                    <Calculator size={18} />
                    <h3>Order Builder</h3>
                  </div>
                  <label className="text-sm font-medium text-slate-700">Total Order Budget</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input 
                      type="number" 
                      value={orderBudget || ''}
                      onChange={(e) => setOrderBudget(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 5000"
                      className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 outline-none transition-all font-medium text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Automatically generates a smart &quot;Order Draft&quot; maximizing potential based on this budget.
                  </p>

                </div>
              </div>

              <div className="pt-4 flex flex-col gap-4">
                <button
                  disabled={mainFiles.length === 0 || processingState.status === 'processing' || mappingList.some(m => m.status === 'error')}
                  onClick={handleProcess}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:active:scale-100",
                    mainFiles.length === 0 || processingState.status === 'processing' || mappingList.some(m => m.status === 'error')
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-gradient-to-br from-slate-800 to-blue-900 hover:from-slate-700 hover:to-blue-800 text-white shadow-blue-900/20"
                  )}
                >
                  {processingState.status === 'processing' ? <RefreshCw size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                  Calculate Profitability
                </button>

                {processedData.length > 0 && (
                  <>
                  <button
                    onClick={handleDownload}
                    disabled={processingState.status === 'exporting'}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:active:scale-100 animate-in zoom-in-95 duration-300",
                      processingState.status === 'exporting'
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-green-600/20"
                    )}
                  >
                    {processingState.status === 'exporting' ? <RefreshCw size={20} className="animate-spin" /> : <Download size={20} />}
                    Download Report
                  </button>
                  </>
                )}
              </div>

              {processedData.length > 0 && (
                <div className="pt-6 border-t border-slate-100 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                    <CheckCircle2 size={18} /> Summary
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">SKUs</p>
                      <p className="text-xl font-black text-slate-900">{processedData.length}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ROI</p>
                      <p className="text-xl font-black text-slate-900">
                        {(processedData.reduce((sum, r) => sum + (r.ROI || 0), 0) / processedData.length).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
