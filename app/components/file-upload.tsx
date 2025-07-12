'use client';

import { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Upload, File, Image, Check } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileUpload({ onFilesSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );
    
    if (validFiles.length > 0) {
      setUploading(true);
      
      // Simulate upload delay for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onFilesSelected(validFiles);
      setUploading(false);
    }
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Main Upload Button */}
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative overflow-hidden border-2 border-dashed border-blue-300 hover:border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2" />
            Processing...
          </>
        ) : (
          <>
            <Upload className={`w-4 h-4 mr-2 transition-transform duration-300 ${dragActive ? 'scale-110' : ''}`} />
            Upload Files
          </>
        )}
        
        {/* Animated Background */}
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 transition-opacity duration-300 ${
          dragActive ? 'opacity-100' : 'opacity-0'
        }`} />
      </Button>

      {/* Drag Overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-blue-400 border-dashed animate-bounce-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl animate-glow">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <div className="text-xl font-bold text-gray-800 mb-2">Drop Files Here</div>
              <div className="text-gray-600">PDF and image files supported</div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Success Animation */}
      {uploading && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-in">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}