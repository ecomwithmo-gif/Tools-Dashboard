import React, { useState } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertTriangle, ArrowRight, Settings, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  label: string;
  description: string;
  onFileSelect: (files: File | File[]) => void;
  selectedFile?: File | null;      // For single file mode
  selectedFiles?: File[];          // For multiple file mode
  onClear: () => void;
  required?: boolean;
  multiple?: boolean;
}

export const FileUploader = ({ 
  label, 
  description, 
  onFileSelect, 
  selectedFile, 
  selectedFiles,
  onClear, 
  required,
  multiple 
}: FileUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (multiple) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.csv'));
      if (files.length > 0) {
        onFileSelect(files);
      }
    } else {
      const file = e.dataTransfer.files[0];
      if (file && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.csv'))) {
        onFileSelect(file);
      }
    }
  };

  const hasFiles = multiple ? (selectedFiles && selectedFiles.length > 0) : !!selectedFile;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {hasFiles && (
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
            Clear {multiple && selectedFiles!.length > 1 ? 'All' : 'File'}
          </button>
        )}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative group cursor-pointer transition-all duration-300",
          "border-2 border-dashed rounded-xl p-6 text-center",
          isDragging ? "border-blue-900 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white",
          hasFiles && "border-green-400 bg-green-50/50"
        )}
      >
        <input
          type="file"
          accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              if (multiple) {
                onFileSelect(Array.from(e.target.files));
              } else {
                onFileSelect(e.target.files[0]);
              }
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
            hasFiles ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
          )}>
            {hasFiles ? <FileText size={24} /> : <Upload size={24} />}
          </div>
          
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {multiple && selectedFiles && selectedFiles.length > 0
                ? `${selectedFiles.length} files selected`
                : selectedFile
                  ? selectedFile.name
                  : multiple ? "Drop multiple files here" : "Click to upload or drag & drop"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {multiple && selectedFiles && selectedFiles.length > 0
               ? `${(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB Total`
               : selectedFile
                 ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                 : description}
            </p>
          </div>
        </div>
      </div>
      
      {/* File List for Multiple Mode */}
      {multiple && selectedFiles && selectedFiles.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
           {selectedFiles.slice(0, 3).map((f, i) => (
             <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1 pl-2">
               <CheckCircle2 size={10} className="text-green-500"/> {f.name}
             </div>
           ))}
           {selectedFiles.length > 3 && (
             <p className="text-[10px] text-slate-400 pl-6 italic">...and {selectedFiles.length - 3} more</p>
           )}
        </div>
      )}
    </div>
  );
};

export const ProgressBar = ({ progress, status }: { progress: number; status: string }) => (
  <div className="w-full space-y-2">
    <div className="flex justify-between text-xs font-medium text-slate-600">
      <span>{status}</span>
      <span>{Math.round(progress)}%</span>
    </div>
    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-slate-900 via-blue-900 to-blue-600 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

export const ColumnMappingPanel = ({ 
  mappings, 
  allColumns,
  onUpdate 
}: { 
  mappings: { standard: string; detected: string | null; status: 'ok' | 'warn' | 'error' }[];
  allColumns: string[];
  onUpdate: (standard: string, selected: string) => void;
}) => {
  const detectedCount = mappings.filter(m => m.status === 'ok').length;
  
  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
      <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-900">Column Mapping</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Auto-detection results and manual overrides</p>
        </div>
        <span className={cn(
          "px-4 py-1.5 rounded-full text-xs font-bold shadow-sm",
          detectedCount === mappings.length ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-900"
        )}>
          {detectedCount} of {mappings.length} detected
        </span>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {mappings.map((m) => (
          <div key={m.standard} className="space-y-2 p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white transition-all group">
            <div className="flex items-center gap-2">
              {m.status === 'ok' ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : m.status === 'warn' ? (
                <AlertTriangle size={16} className="text-amber-500" />
              ) : (
                <X size={16} className="text-red-500" />
              )}
              <p className="text-xs font-bold text-slate-900">{m.standard}</p>
            </div>
            
            <select
              value={m.detected || ''}
              onChange={(e) => onUpdate(m.standard, e.target.value)}
              className={cn(
                "w-full text-[11px] font-bold py-2 px-3 rounded-xl border outline-none transition-all text-slate-900 shadow-sm",
                m.status === 'ok' ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"
              )}
            >
              <option value="">Select Column...</option>
              {allColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ActivityLog = ({ logs }: { logs: string[] }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Processing Activity
        </h3>
        <span className="text-slate-600 text-[10px] font-mono">v1.0.4 - LIVE</span>
      </div>
      <div 
        ref={containerRef}
        className="h-40 overflow-y-auto space-y-1 font-mono text-[11px] custom-scrollbar"
      >
        {logs.length === 0 ? (
          <p className="text-slate-700 italic">Waiting for input...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
              <span className={cn(
                log.toLowerCase().includes('complete') ? "text-green-400" :
                log.toLowerCase().includes('error') ? "text-red-400" :
                "text-slate-300"
              )}>
                {log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const DataPreview = ({ data, title }: { data: any[]; title: string }) => {
  if (!data || data.length === 0) return null;
  const headers = Object.keys(data[0]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
      <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title} Preview (First 5 Rows)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-slate-900 border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {headers.map(h => (
                <th key={h} className="px-4 py-2 text-[10px] font-bold text-slate-540 whitespace-nowrap border-r border-slate-100 last:border-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                {headers.map(h => (
                  <td key={h} className="px-4 py-2 text-[10px] text-slate-500 whitespace-nowrap border-r border-slate-50 last:border-0 truncate max-w-[150px]">
                    {String(row[h] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ValidationStatus = ({ 
  isValid, 
  message, 
  missing 
}: { 
  isValid: boolean; 
  message: string; 
  missing?: string[] 
}) => (
  <div className={cn(
    "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all animate-in fade-in zoom-in-95",
    isValid 
      ? "bg-green-50 border-green-100 text-green-700" 
      : "bg-red-50 border-red-100 text-red-700"
  )}>
    {isValid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
    <div className="flex-1">
      <p className="text-xs font-bold uppercase tracking-wide">{message}</p>
      {missing && missing.length > 0 && (
        <p className="text-[10px] mt-0.5 opacity-80 font-medium whitespace-nowrap">Missing: {missing.join(', ')}</p>
      )}
    </div>
  </div>
);
export const LiveStatsBoard = ({ stats }: { stats: any }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">SKUs Analyzed</p>
        <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.totalSKUs}</p>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Profitable Items</p>
        <div className="flex items-center gap-2">
          <p className="text-3xl font-black text-green-600 tabular-nums">{stats.profitableCount}</p>
          <span className="text-xs font-bold text-green-600/60">({Math.round((stats.profitableCount / stats.totalSKUs) * 100)}%)</span>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Total Potential Profit</p>
        <p className="text-3xl font-black text-blue-900 tabular-nums">${stats.totalPotentialProfit.toLocaleString()}</p>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/50">
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Average ROI</p>
        <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.avgROI}%</p>
      </div>
    </div>
  );
};
