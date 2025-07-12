'use client';

import { useState } from 'react';
import FileUpload from './components/file-upload';
import DocumentViewer from './components/document-viewer';
import ExtractionForm from './components/extraction-form';
import ChatPanel from './components/chat-panel';
import { Button } from './components/ui/button';
import { FileText, Download, MessageSquare, Sparkles, Zap, Check, Clock, AlertCircle, Trash2 } from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  type?: string;
  position?: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ExtractedData {
  id: string;
  data: {
    documentType?: string;
    keyValuePairs?: Array<{ key: string; value: string; confidence: number }>;
    extractedFields?: ExtractedField[];
    tables?: Array<any>;
    logos?: Array<any>;
    signatures?: Array<any>;
    content?: string;
    pages?: Array<any>;
  };
}

interface DocumentFile {
  file: File;
  id: string;
  status: 'pending' | 'extracting' | 'completed' | 'error';
  extractedData?: ExtractedData;
  error?: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [highlightedField, setHighlightedField] = useState<ExtractedField | null>(null);
  const [hoveredField, setHoveredField] = useState<ExtractedField | null>(null);

  const handleFilesSelected = (newFiles: File[]): void => {
    const newDocuments: DocumentFile[] = newFiles.map(file => ({
      file,
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending'
    }));
    
    setDocuments(prev => [...prev, ...newDocuments]);
    
    // Auto-select first document if none selected
    if (!selectedDocument && newDocuments.length > 0) {
      setSelectedDocument(newDocuments[0]);
    }
  };

  const handleExtractSingle = async (documentId: string): Promise<void> => {
    const document = documents.find(doc => doc.id === documentId);
    if (!document) return;

    // Update status to extracting
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId ? { ...doc, status: 'extracting' } : doc
    ));

    const formData = new FormData();
    formData.append('file', document.file);
    
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const extractedData = await res.json();
      
      // Update document with extracted data
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'completed', extractedData }
          : doc
      ));
      
    } catch (error) {
      console.error('Extraction failed:', error);
      
      // Update document with error status
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'error', error: 'Extraction failed' }
          : doc
      ));
    }
  };

  const handleExtractAll = async (): Promise<void> => {
    const pendingDocs = documents.filter(doc => doc.status === 'pending');
    
    // Extract all pending documents in parallel
    const extractionPromises = pendingDocs.map(doc => handleExtractSingle(doc.id));
    await Promise.allSettled(extractionPromises);
  };

  const handleDownload = async (format: 'csv' | 'xlsx', documentId?: string): Promise<void> => {
    try {
      let dataToDownload;
      let filename;

      if (documentId) {
        // Download single document
        const document = documents.find(doc => doc.id === documentId);
        if (!document?.extractedData) return;
        
        dataToDownload = document.extractedData;
        filename = `${document.file.name.split('.')[0]}_extracted.${format}`;
      } else {
        // Download all completed documents
        const completedDocs = documents.filter(doc => doc.status === 'completed' && doc.extractedData);
        if (completedDocs.length === 0) return;
        
        // Combine all extracted data
        dataToDownload = {
          id: 'combined',
          data: {
            extractedFields: completedDocs.flatMap(doc => 
              doc.extractedData?.data?.extractedFields?.map(field => ({
                ...field,
                documentName: doc.file.name
              })) || []
            ),
            tables: completedDocs.flatMap(doc => doc.extractedData?.data?.tables || []),
            content: completedDocs.map(doc => 
              `Document: ${doc.file.name}\n${doc.extractedData?.data?.content || ''}`
            ).join('\n\n')
          }
        };
        filename = `all_documents_extracted.${format}`;
      }

      const res = await fetch(`/api/download/${dataToDownload.id}/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToDownload)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file');
    }
  };

  const handleDeleteDocument = (documentId: string): void => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    
    // If deleted document was selected, select another one
    if (selectedDocument?.id === documentId) {
      const remainingDocs = documents.filter(doc => doc.id !== documentId);
      setSelectedDocument(remainingDocs.length > 0 ? remainingDocs[0] : null);
    }
  };

  const handleFieldClick = (field: ExtractedField): void => {
    setHighlightedField(field);
  };

  const handleFieldHover = (field: ExtractedField | null): void => {
    setHoveredField(field);
  };

  const getStatusIcon = (status: DocumentFile['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3 text-gray-400" />;
      case 'extracting': return <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed': return <Check className="w-3 h-3 text-green-500" />;
      case 'error': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: DocumentFile['status']) => {
    switch (status) {
      case 'pending': return 'border-gray-200 bg-white';
      case 'extracting': return 'border-blue-300 bg-blue-50';
      case 'completed': return 'border-green-300 bg-green-50';
      case 'error': return 'border-red-300 bg-red-50';
      default: return 'border-gray-200 bg-white';
    }
  };

  const completedDocuments = documents.filter(doc => doc.status === 'completed');
  const pendingDocuments = documents.filter(doc => doc.status === 'pending');

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Enhanced Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            IDP Pro
            <span className="text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-1 rounded-full font-normal">
              Multi-Document AI
            </span>
          </h1>
          
          <div className="flex items-center gap-3">
            <FileUpload onFilesSelected={handleFilesSelected} />
            
            <Button 
              onClick={handleExtractAll} 
              disabled={pendingDocuments.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Extract All ({pendingDocuments.length})
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => handleDownload('csv')} 
              disabled={completedDocuments.length === 0}
              className="border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-400 text-emerald-700 hover:text-emerald-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4 mr-2" />
              Export All CSV
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => handleDownload('xlsx')} 
              disabled={completedDocuments.length === 0}
              className="border-green-300 bg-gradient-to-r from-green-50 to-lime-50 hover:from-green-100 hover:to-lime-100 hover:border-green-400 text-green-700 hover:text-green-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95"
            >
              <Download className="w-4 h-4 mr-2" />
              Export All Excel
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setShowChat(!showChat)} 
              disabled={!selectedDocument?.extractedData}
              className="border-violet-300 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 hover:border-violet-400 text-violet-700 hover:text-violet-800 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 active:scale-95"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask AI Chat
            </Button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Enhanced Documents sidebar */}
        <div className="w-64 border-r border-gray-200/50 p-4 overflow-y-auto bg-white/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-gray-700">Documents</h3>
            </div>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
              {documents.length}
            </span>
          </div>
          
          {documents.length > 0 ? (
            documents.map((document) => (
              <div
                key={document.id}
                className={`mb-3 p-3 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-[1.02] ${
                  selectedDocument?.id === document.id 
                    ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50 shadow-md scale-[1.02]' 
                    : getStatusColor(document.status)
                }`}
                onClick={() => setSelectedDocument(document)}
              >
                <div className="flex items-start gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate" title={document.file.name}>
                      {document.file.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(document.file.size / 1024).toFixed(1)} KB
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {getStatusIcon(document.status)}
                      <span className="text-xs capitalize font-medium">
                        {document.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {document.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractSingle(document.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                      >
                        <Sparkles className="w-3 h-3" />
                      </Button>
                    )}
                    {document.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload('csv', document.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700"
                        title="Download CSV"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(document.id);
                      }}
                      className="h-6 w-6 p-0 hover:bg-red-100 text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {selectedDocument?.id === document.id && (
                  <div className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    Active Document
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No documents uploaded</div>
            </div>
          )}
        </div>

        {/* Split view */}
        <div className="flex-1 flex">
          {/* Left: Document viewer */}
          <div className="w-1/2 border-r border-gray-200/50 flex flex-col">
            <div className="p-3 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">
                  {selectedDocument ? selectedDocument.file.name : 'Original Document'}
                </span>
                {selectedDocument && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {getStatusIcon(selectedDocument.status)}
                    <span className="capitalize">{selectedDocument.status}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedDocument ? (
                <DocumentViewer 
                  file={selectedDocument.file} 
                  highlightedField={highlightedField}
                  hoveredField={hoveredField}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-gray-600 font-medium mb-2">Ready to Process</div>
                    <div className="text-gray-400 text-sm">Upload documents to begin extraction</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Extraction form */}
          <div className="w-1/2 flex flex-col">
            <div className="p-3 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-700">Extracted Data</span>
                  {selectedDocument?.extractedData?.data?.documentType && (
                    <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                      {selectedDocument.extractedData.data.documentType}
                    </span>
                  )}
                </div>
                {selectedDocument?.extractedData?.data?.extractedFields && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    {selectedDocument.extractedData.data.extractedFields.length} fields
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedDocument?.extractedData ? (
                <ExtractionForm 
                  data={{
                    id: selectedDocument.extractedData.id,
                    data: {
                      documentType: selectedDocument.extractedData.data?.documentType,
                      extractedFields: selectedDocument.extractedData.data?.extractedFields || [],
                      tables: selectedDocument.extractedData.data?.tables || [],
                      logos: selectedDocument.extractedData.data?.logos || [],
                      signatures: selectedDocument.extractedData.data?.signatures || [],
                      content: selectedDocument.extractedData.data?.content || ''
                    }
                  }} 
                  onUpdate={(updatedData) => {
                    setDocuments(prev => prev.map(doc => 
                      doc.id === selectedDocument.id 
                        ? { ...doc, extractedData: updatedData }
                        : doc
                    ));
                  }}
                  onFieldClick={handleFieldClick}
                  onFieldHover={handleFieldHover}
                />
              ) : selectedDocument?.status === 'extracting' ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
                    </div>
                    <div className="text-gray-600 font-medium mb-2">Extracting Data...</div>
                    <div className="text-gray-400 text-sm">Please wait while we analyze the document</div>
                  </div>
                </div>
              ) : selectedDocument?.status === 'error' ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                      <AlertCircle className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-gray-600 font-medium mb-2">Extraction Failed</div>
                    <div className="text-gray-400 text-sm">{selectedDocument.error}</div>
                    <Button 
                      onClick={() => handleExtractSingle(selectedDocument.id)}
                      className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    >
                      Retry Extraction
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-gray-600 font-medium mb-2">Ready to Extract</div>
                    <div className="text-gray-400 text-sm">
                      {selectedDocument 
                        ? 'Click the extract button to analyze this document' 
                        : 'Select a document to begin extraction'
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Chat panel */}
        {showChat && selectedDocument?.extractedData && (
          <div className="border-l border-gray-200/50 bg-white/90 backdrop-blur-sm">
            <ChatPanel 
              extractedDataId={selectedDocument.extractedData.id} 
              onClose={() => setShowChat(false)} 
            />
          </div>
        )}
      </div>
    </div>
  );
}