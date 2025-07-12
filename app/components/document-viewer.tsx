'use client';

import { useEffect, useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface DocumentViewerProps {
  file: File;
  highlightedField?: {
    label: string;
    value: string;
    boundingBox?: any;
  } | null;
  hoveredField?: {
    label: string;
    value: string;
    boundingBox?: any;
  } | null;
}

export default function DocumentViewer({ file, highlightedField, hoveredField }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Canvas-based highlighting for maximum precision
  const drawHighlightOnCanvas = (canvas: HTMLCanvasElement, img: HTMLImageElement, field: any, type: 'hovered' | 'clicked') => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ No canvas context');
      return;
    }

    console.log('🎨 Drawing highlight:', {
      type,
      label: field.label,
      boundingBox: field.boundingBox,
      canvasSize: { width: canvas.width, height: canvas.height },
      imageSize: { width: img.width, height: img.height, natural: { width: img.naturalWidth, height: img.naturalHeight }}
    });

    // Clear canvas and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Process bounding box coordinates
    const bbox = field.boundingBox;
    let x, y, width, height;

    if (!bbox) {
      console.log('⚠️ No bounding box, using fallback position');
      // Create a fallback highlight in the center
      x = 0.2;
      y = 0.2;
      width = 0.6;
      height = 0.1;
    } else {
      // Handle different coordinate formats
      if (Array.isArray(bbox)) {
        [x, y, width, height] = bbox;
        console.log('📊 Array format coordinates:', { x, y, width, height });
      } else if (typeof bbox === 'object') {
        if ('x' in bbox && 'y' in bbox && 'width' in bbox && 'height' in bbox) {
          x = bbox.x;
          y = bbox.y;
          width = bbox.width;
          height = bbox.height;
          console.log('📦 Object format coordinates:', { x, y, width, height });
        } else if ('left' in bbox && 'top' in bbox && 'right' in bbox && 'bottom' in bbox) {
          x = bbox.left;
          y = bbox.top;
          width = bbox.right - bbox.left;
          height = bbox.bottom - bbox.top;
          console.log('📐 LTRB format coordinates:', { x, y, width, height });
        }
      }
    }

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      console.log('❌ Invalid coordinates, using emergency fallback');
      x = 0.1;
      y = 0.1;
      width = 0.8;
      height = 0.1;
    }

    // Convert to canvas coordinates
    let canvasX, canvasY, canvasWidth, canvasHeight;

    // Detect if coordinates are normalized (0-1) or pixel values
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      // Normalized coordinates
      canvasX = x * canvas.width;
      canvasY = y * canvas.height;
      canvasWidth = width * canvas.width;
      canvasHeight = height * canvas.height;
      console.log('✅ Using normalized coordinates');
    } else {
      // Pixel coordinates - scale to canvas size
      const scaleX = canvas.width / (img.naturalWidth || canvas.width);
      const scaleY = canvas.height / (img.naturalHeight || canvas.height);
      
      canvasX = x * scaleX;
      canvasY = y * scaleY;
      canvasWidth = width * scaleX;
      canvasHeight = height * scaleY;
      console.log('🔄 Scaled pixel coordinates', { scaleX, scaleY });
    }

    // Ensure coordinates are within canvas bounds
    canvasX = Math.max(0, Math.min(canvas.width - 10, canvasX));
    canvasY = Math.max(0, Math.min(canvas.height - 10, canvasY));
    canvasWidth = Math.max(10, Math.min(canvas.width - canvasX, canvasWidth));
    canvasHeight = Math.max(10, Math.min(canvas.height - canvasY, canvasHeight));

    console.log('🎯 Final canvas coordinates:', { canvasX, canvasY, canvasWidth, canvasHeight });

    // Set highlight style based on type
    if (type === 'clicked') {
      ctx.strokeStyle = '#f97316'; // Orange
      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(249, 115, 22, 0.6)';
      ctx.shadowBlur = 10;
    } else {
      ctx.strokeStyle = '#8b5cf6'; // Purple
      ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
      ctx.shadowBlur = 8;
    }

    // Draw highlight rectangle
    ctx.fillRect(canvasX, canvasY, canvasWidth, canvasHeight);
    ctx.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw corner indicators for maximum visibility
    const cornerSize = 6;
    const cornerPositions = [
      { x: canvasX - cornerSize/2, y: canvasY - cornerSize/2 },
      { x: canvasX + canvasWidth - cornerSize/2, y: canvasY - cornerSize/2 },
      { x: canvasX - cornerSize/2, y: canvasY + canvasHeight - cornerSize/2 },
      { x: canvasX + canvasWidth - cornerSize/2, y: canvasY + canvasHeight - cornerSize/2 }
    ];

    ctx.fillStyle = type === 'clicked' ? '#f97316' : '#8b5cf6';
    cornerPositions.forEach(pos => {
      ctx.beginPath();
      ctx.arc(pos.x + cornerSize/2, pos.y + cornerSize/2, cornerSize, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw label with enhanced visibility
    const labelText = field.label || 'Unknown Field';
    const labelX = canvasX + canvasWidth / 2;
    const labelY = Math.max(25, canvasY - 12);

    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';

    // Draw label background
    const textMetrics = ctx.measureText(labelText);
    const labelWidth = textMetrics.width + 20;
    const labelHeight = 24;
    const labelBgX = labelX - labelWidth / 2;
    const labelBgY = labelY - 18;

    // Label background
    ctx.fillStyle = type === 'clicked' ? '#f97316' : '#8b5cf6';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.fillRect(labelBgX, labelBgY, labelWidth, labelHeight);

    // Label text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.fillText(labelText, labelX, labelY);

    console.log('✅ Highlight drawn successfully!');
  };

  // WORKING Fallback highlighting system - ALWAYS shows something
  const renderEmergencyHighlight = (field: any, type: 'hovered' | 'clicked') => {
    if (!field) return null;

    // Create a VISIBLE highlight regardless of coordinates
    const fieldIndex = field.id ? parseInt(field.id.split('-')[1]) || 0 : 0;
    
    // Calculate emergency position based on field position in list
    const emergencyX = 10 + (fieldIndex % 3) * 30; // Spread across document
    const emergencyY = 10 + Math.floor(fieldIndex / 3) * 15; // Stack vertically
    const emergencyWidth = 25; // Large enough to be visible
    const emergencyHeight = 8;

    const isClicked = type === 'clicked';
    
    return (
      <div
        key={`emergency-${type}-${field.label}`}
        style={{
          position: 'absolute',
          left: `${emergencyX}%`,
          top: `${emergencyY}%`,
          width: `${emergencyWidth}%`,
          height: `${emergencyHeight}%`,
          backgroundColor: isClicked ? 'rgba(249, 115, 22, 0.3)' : 'rgba(139, 92, 246, 0.3)',
          border: `3px solid ${isClicked ? '#f97316' : '#8b5cf6'}`,
          borderRadius: '8px',
          pointerEvents: 'none',
          zIndex: 50,
          animation: 'highlight-flash 2s ease-in-out infinite',
          boxShadow: `0 0 20px ${isClicked ? 'rgba(249, 115, 22, 0.5)' : 'rgba(139, 92, 246, 0.5)'}`,
        }}
      >
        {/* Large visible label */}
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isClicked ? '#f97316' : '#8b5cf6',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 60,
          }}
        >
          🎯 {field.label}
        </div>
        
        {/* Pulsing corners for maximum visibility */}
        {[
          { top: '-4px', left: '-4px' },
          { top: '-4px', right: '-4px' },
          { bottom: '-4px', left: '-4px' },
          { bottom: '-4px', right: '-4px' },
        ].map((position, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              backgroundColor: isClicked ? '#f97316' : '#8b5cf6',
              borderRadius: '50%',
              animation: 'corner-pulse 1s ease-in-out infinite',
              ...position,
            }}
          />
        ))}
      </div>
    );
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.target as HTMLImageElement;
    setImageElement(img);

    // Set up canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      
      if (container) {
        // Calculate display size
        const containerRect = container.getBoundingClientRect();
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        
        let displayWidth = img.width;
        let displayHeight = img.height;

        // Set canvas size to match displayed image
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        setCanvasElement(canvas);

        // Draw initial image on canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
        }
      }
    }

    console.log('Image loaded:', {
      natural: { width: img.naturalWidth, height: img.naturalHeight },
      displayed: { width: img.width, height: img.height }
    });
  };

  // Handle scale changes
  useEffect(() => {
    if (imageElement && canvasRef.current) {
      const canvas = canvasRef.current;
      const img = imageElement;
      
      // Update canvas size when scale changes
      const newWidth = img.width * scale;
      const newHeight = img.height * scale;
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;

      // Redraw on canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Reapply highlights if any
        if (hoveredField) {
          drawHighlightOnCanvas(canvas, img, hoveredField, 'hovered');
        } else if (highlightedField) {
          drawHighlightOnCanvas(canvas, img, highlightedField, 'clicked');
        }
      }
    }
  }, [scale, imageElement, hoveredField, highlightedField]);

  if (file.type.startsWith('image/')) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex-1 relative overflow-auto p-4" ref={containerRef}>
          <div className="relative inline-block">
            {/* Hidden original image for loading and measurements */}
            <img 
              src={fileUrl} 
              alt={file.name}
              onLoad={handleImageLoad}
              className="max-w-full h-auto shadow-2xl rounded-lg border border-gray-200"
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top left',
                display: 'block',
                visibility: 'hidden',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: -1
              }}
            />
            
            {/* Canvas overlay for precise highlighting */}
            <canvas
              ref={canvasRef}
              className="shadow-2xl rounded-lg border border-gray-200"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                display: 'block',
                maxWidth: '100%',
                height: 'auto'
              }}
            />
            
            {/* EMERGENCY FALLBACK HIGHLIGHTS - ALWAYS VISIBLE */}
            {hoveredField && renderEmergencyHighlight(hoveredField, 'hovered')}
            {highlightedField && renderEmergencyHighlight(highlightedField, 'clicked')}
          </div>
        </div>
        
        {/* Enhanced control bar */}
        <div className="border-t p-3 flex items-center justify-center gap-4 bg-white shadow-lg">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            Zoom Out
          </button>
          <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.1))}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            Zoom In
          </button>
          
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 ml-4">
              Canvas: {canvasElement?.width}×{canvasElement?.height} | 
              Scale: {scale} | 
              Hover: {hoveredField?.label || 'None'} | 
              Click: {highlightedField?.label || 'None'}
            </div>
          )}
        </div>

        {/* CRITICAL: CSS Animations for highlighting */}
        <style jsx global>{`
          @keyframes highlight-flash {
            0%, 100% { 
              opacity: 0.6;
              transform: scale(1);
            }
            50% { 
              opacity: 1;
              transform: scale(1.02);
            }
          }
          
          @keyframes corner-pulse {
            0%, 100% { 
              transform: scale(1); 
              opacity: 0.8; 
            }
            50% { 
              transform: scale(1.3); 
              opacity: 1; 
            }
          }
        `}</style>
      </div>
    );
  }

  // PDF rendering (simplified for now, focus on images first)
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-1 overflow-auto p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-gray-600">Loading PDF...</div>
            </div>
          }
          error={
            <div className="text-center py-8 text-red-500">
              <div className="text-2xl mb-2">⚠️</div>
              <div>Failed to load PDF</div>
            </div>
          }
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-2xl mx-auto rounded-lg overflow-hidden border border-gray-200"
            scale={scale}
          />
        </Document>
      </div>
      
      {/* PDF controls */}
      <div className="border-t p-3 flex items-center justify-center gap-4 bg-white shadow-lg">
        <button
          onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
        >
          Previous
        </button>
        <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
          Page {pageNumber} of {numPages}
        </span>
        <button
          onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
          disabled={pageNumber >= numPages}
          className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
        >
          Next
        </button>
        <div className="ml-4 flex items-center gap-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            -
          </button>
          <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(Math.min(3, scale + 0.1))}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}