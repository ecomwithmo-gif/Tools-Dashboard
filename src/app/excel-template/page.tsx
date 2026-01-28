'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet, Download, X, File as FileIcon, Loader2 } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export default function ExcelTemplate() {
    const [templateFile, setTemplateFile] = useState<File | null>(null);
    const [dataFiles, setDataFiles] = useState<File[]>([]);
    const [processedFiles, setProcessedFiles] = useState<{ name: string; blob: Blob }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle Template Upload
    const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setTemplateFile(e.target.files[0]);
            setError(null);
            // Reset processed files as template changed
            setProcessedFiles([]);
        }
    };

    // Handle Data Files Drag & Drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).filter(
                file => file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
            );
            setDataFiles(prev => [...prev, ...newFiles]);
            setProcessedFiles([]); // Reset processed files
        }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const removeDataFile = (index: number) => {
        setDataFiles(prev => prev.filter((_, i) => i !== index));
        setProcessedFiles([]);
    };

    // Convert File to ArrayBuffer
    const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    // Convert File to Workbook (using XLSX for reading data files as it handles CSV better)
    const readDataFile = async (file: File): Promise<any[][]> => {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    };

    const processFiles = async () => {
        if (!templateFile) return;

        setIsProcessing(true);
        setError(null);
        setProcessedFiles([]);

        try {
            const results = [];

            // Load Template ArrayBuffer once
            const templateBuffer = await readFileAsArrayBuffer(templateFile);

            for (const dataFile of dataFiles) {
                // Read data file content
                const dataRows = await readDataFile(dataFile);

                // Load template into ExcelJS
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(templateBuffer);

                // Add new sheet "Raw Imported"
                const newSheet = workbook.addWorksheet('Raw Imported');

                // Add rows to new sheet
                newSheet.addRows(dataRows);

                // Generate output buffer
                const outputBuffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([outputBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

                const originalNameBase = dataFile.name.replace(/\.[^/.]+$/, "");
                const newName = `${originalNameBase} ADDED TO TEMPLATE.xlsx`;

                results.push({
                    name: newName,
                    blob: blob
                });
            }

            setProcessedFiles(results);
        } catch (err) {
            console.error(err);
            setError('An error occurred while processing files. Please check your inputs.');
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadFile = (file: { name: string; blob: Blob }) => {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadAll = () => {
        processedFiles.forEach((file, index) => {
            setTimeout(() => downloadFile(file), index * 500); // Stagger downloads slightly
        });
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] p-8 font-sans text-[#333]">
            <div className="max-w-6xl mx-auto">
                <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium transition-colors">
                    <ArrowLeft size={20} className="mr-2" />
                    Back to Dashboard
                </Link>

                <h1 className="text-3xl font-bold mb-2 text-[#111]">Excel Template Merger</h1>
                <p className="text-[#666] mb-8">Merge multiple data files (CSV/Excel) into a master Excel template.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* LEFT COLUMN: Inputs */}
                    <div className="space-y-6">

                        {/* 1. Template Upload */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-semibold mb-4 flex items-center">
                                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">1</span>
                                Upload Template
                            </h2>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleTemplateUpload}
                                    className="hidden"
                                    id="template-upload"
                                />
                                <label
                                    htmlFor="template-upload"
                                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <FileSpreadsheet className="w-8 h-8 text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500">
                                            {templateFile ? (
                                                <span className="font-semibold text-blue-600">{templateFile.name}</span>
                                            ) : (
                                                <span>Click to upload Template (.xlsx)</span>
                                            )}
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* 2. Data Files Upload */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-semibold mb-4 flex items-center">
                                <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">2</span>
                                Drag & Drop Data Files
                            </h2>

                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-sm text-gray-500 font-medium">Drag & Drop CSV or Excel files here</p>
                                <p className="text-xs text-gray-400 mt-1">or drag a folder of files</p>
                            </div>

                            {/* File List */}
                            {dataFiles.length > 0 && (
                                <div className="mt-4 max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {dataFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                            <div className="flex items-center truncate mr-3">
                                                <FileIcon size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                                                <span className="truncate text-gray-700">{file.name}</span>
                                            </div>
                                            <button
                                                onClick={() => removeDataFile(idx)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Process Button */}
                        <button
                            onClick={processFiles}
                            disabled={!templateFile || dataFiles.length === 0 || isProcessing}
                            className={`w-full py-4 rounded-xl font-semibold text-lg shadow-md transition-all
                ${!templateFile || dataFiles.length === 0
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                                }`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center justify-center">
                                    <Loader2 className="animate-spin mr-2" /> Processing...
                                </span>
                            ) : 'Process Files'}
                        </button>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                                {error}
                            </div>
                        )}

                    </div>

                    {/* RIGHT COLUMN: Output */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full min-h-[500px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold flex items-center">
                                <span className="bg-green-100 text-green-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">3</span>
                                Download Results
                            </h2>
                            {processedFiles.length > 0 && (
                                <button
                                    onClick={downloadAll}
                                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center font-medium shadow-sm"
                                >
                                    <Download size={16} className="mr-2" /> Download All
                                </button>
                            )}
                        </div>

                        {processedFiles.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                                <FileSpreadsheet size={48} className="mb-4 opacity-50" />
                                <p>Processed files will appear here</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {processedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-green-200 hover:shadow-sm transition-all group">
                                        <div className="flex items-center truncate mr-4">
                                            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mr-3 flex-shrink-0">
                                                <FileSpreadsheet size={20} />
                                            </div>
                                            <span className="font-medium text-gray-700 truncate">{file.name}</span>
                                        </div>
                                        <button
                                            onClick={() => downloadFile(file)}
                                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                            title="Download"
                                        >
                                            <Download size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
