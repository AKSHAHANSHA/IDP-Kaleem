'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { FileText, Image, Stamp, PenTool, X, Plus, Edit2, GripVertical } from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  type?: string;
  position?: string;
  confidence: number;
  boundingBox?: any;
  id?: string;
}

interface ExtractionFormProps {
  data: {
    id: string;
    data: {
      documentType?: string;
      extractedFields: ExtractedField[];
      tables: Array<any>;
      logos?: Array<any>;
      signatures?: Array<any>;
      content: string;
    };
  };
  onUpdate: (data: any) => void;
  onFieldClick?: (field: ExtractedField) => void;
  onFieldHover?: (field: ExtractedField | null) => void;
}

export default function ExtractionForm({ data, onUpdate, onFieldClick, onFieldHover }: ExtractionFormProps) {
  const [formData, setFormData] = useState(
    data.data.extractedFields.map((field, index) => ({
      ...field,
      id: field.id || `field-${index}`
    }))
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);

  const handleChange = (id: string, field: 'label' | 'value', value: string) => {
    const updated = formData.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    setFormData(updated);
    
    onUpdate({
      ...data,
      data: {
        ...data.data,
        extractedFields: updated
      }
    });
  };

  const addNewField = () => {
    const newField = {
      id: `field-${Date.now()}`,
      label: 'New Field',
      value: '',
      confidence: 1.0,
      type: 'text'
    };
    const updated = [...formData, newField];
    setFormData(updated);
    setEditingField(newField.id);
    
    onUpdate({
      ...data,
      data: {
        ...data.data,
        extractedFields: updated
      }
    });
  };

  const deleteField = (id: string) => {
    const updated = formData.filter(item => item.id !== id);
    setFormData(updated);
    
    onUpdate({
      ...data,
      data: {
        ...data.data,
        extractedFields: updated
      }
    });
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'logo':
        return <Image className="w-4 h-4" />;
      case 'signature':
        return <PenTool className="w-4 h-4" />;
      case 'stamp':
        return <Stamp className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const handleDragStart = (e: React.DragEvent, fieldId: string) => {
    setDraggedField(fieldId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetId) return;

    const draggedIndex = formData.findIndex(f => f.id === draggedField);
    const targetIndex = formData.findIndex(f => f.id === targetId);
    
    const updated = [...formData];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    
    setFormData(updated);
    setDraggedField(null);
    
    onUpdate({
      ...data,
      data: {
        ...data.data,
        extractedFields: updated
      }
    });
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-full">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Extracted Fields</h2>
        <button
          onClick={addNewField}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Special Elements */}
      {((data.data.logos?.length ?? 0) > 0 || (data.data.signatures?.length ?? 0) > 0) && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Special Elements</h3>
          <div className="grid grid-cols-1 gap-3">
            {data.data.logos?.map((logo: any, idx: number) => (
              <div key={`logo-${idx}`} className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl shadow-md border border-blue-100 hover:shadow-lg transition-all duration-300">
                <div className="p-2 bg-blue-500 rounded-lg text-white shadow-md">
                  <Image className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{logo.description}</span>
                  {logo.text && <Badge variant="secondary" className="ml-2">{logo.text}</Badge>}
                </div>
              </div>
            ))}
            {data.data.signatures?.map((sig: any, idx: number) => (
              <div key={`sig-${idx}`} className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-md border border-green-100 hover:shadow-lg transition-all duration-300">
                <div className="p-2 bg-green-500 rounded-lg text-white shadow-md">
                  <PenTool className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-gray-800">Signature {sig.signatory && `- ${sig.signatory}`}</span>
                  <Badge variant="secondary" className="ml-2">{sig.position}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Fields - Floating Widget Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
        {formData.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, item.id!)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item.id!)}
            onMouseEnter={() => {
              console.log('🔥 HOVER ENTER:', item.label, item.boundingBox);
              onFieldHover?.(item);
            }}
            onMouseLeave={() => {
              console.log('🔥 HOVER LEAVE:', item.label);
              onFieldHover?.(null);
            }}
            onClick={() => {
              console.log('🔥 CLICK:', item.label, item.boundingBox);
              onFieldClick?.(item);
            }}
            className={`group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border-2 border-transparent hover:border-purple-300 transform hover:scale-[1.02] ${
              draggedField === item.id ? 'opacity-50 rotate-2' : ''
            }`}
          >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30" />
          
          {/* Content */}
            <div className="relative p-5">
              {/* Header with drag handle and actions */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white shadow-md">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingField(item.id === editingField ? null : item.id!);
                    }}
                    className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteField(item.id!);
                    }}
                    className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Label Field */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Label</div>
                {editingField === item.id ? (
                  <Input
                    value={item.label || ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleChange(item.id!, 'label', e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingField(null);
                    }}
                    className="font-semibold bg-blue-50 border-blue-200 focus:border-blue-400 rounded-lg"
                    autoFocus
                  />
                ) : (
                  <div className="font-semibold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    {item.label || 'Untitled Field'}
                  </div>
                )}
              </div>
              
              {/* Value Field */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Value</div>
                {editingField === item.id ? (
                  <Input
                    value={item.value || ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleChange(item.id!, 'value', e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingField(null);
                    }}
                    className="font-mono text-sm bg-green-50 border-green-200 focus:border-green-400 rounded-lg"
                  />
                ) : (
                  <div className="font-mono text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200 min-h-[2.5rem] break-words">
                    {item.value || 'No value'}
                  </div>
                )}
              </div>

              {/* Footer with confidence and position */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full font-medium ${getConfidenceColor(item.confidence)}`}>
                    {(item.confidence * 100).toFixed(0)}% confident
                  </span>
                  {item.position && (
                    <Badge variant="outline" className="text-xs border-gray-300">
                      {item.position}
                    </Badge>
                  )}
                </div>
                <span className="text-blue-600 font-medium">
                  Highlight →
                </span>
              </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        ))}
        
        {formData.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📄</div>
            <div className="text-gray-500 text-lg font-medium mb-2">No fields extracted</div>
            <div className="text-gray-400 text-sm">Click "Extract" to process the document</div>
          </div>
        )}
      </div>

      {/* Tables Section */}
      {data.data.tables?.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-semibold mb-6 text-gray-700">Tables Found</h3>
          {data.data.tables.map((table: any, idx: number) => (
            <div key={idx} className="mb-6 bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-3 border-b border-gray-200">
                <div className="font-semibold text-gray-800">Table {idx + 1}</div>
              </div>
              {table.headers && (
                <div className="p-6 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        {table.headers.map((header: string, hidx: number) => (
                          <th key={hidx} className="px-4 py-3 text-left font-semibold bg-gray-100 text-gray-700 border-b border-gray-200">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows?.map((row: any[], ridx: number) => (
                        <tr key={ridx} className="hover:bg-gray-50 transition-colors">
                          {row.map((cell: string, cidx: number) => (
                            <td key={cidx} className="px-4 py-3 border-b border-gray-100 text-gray-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}