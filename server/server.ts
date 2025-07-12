import path from 'path';
import dotenv from 'dotenv';
dotenv.config({
  path: path.resolve(__dirname, '../.env')  // ✅ explicitly load .env
});

console.log("🔐 OpenAI Key Loaded:", process.env.OPENAI_KEY ? "YES" : "NO");
console.log("HELLO:", process.env.HELLO);

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import * as Papaparse from 'papaparse';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || ''
});

// Store extracted data in memory
const extractedData = new Map<string, any>();

// REVOLUTIONARY 3-STEP COORDINATE EXTRACTION SYSTEM
// Step 1: Visual Grounding with Grid References
const VISUAL_GROUNDING_PROMPT = `You are a PRECISION COORDINATE EXPERT. I will provide you with an image that has a GRID OVERLAY for reference.

🎯 MISSION: Use the grid coordinates to provide PIXEL-PERFECT bounding box locations.

COORDINATE SYSTEM:
- The image is divided into a 10x10 grid (100 cells total)
- Each cell is numbered from 0-9 horizontally (X) and 0-9 vertically (Y)
- Grid coordinates help you measure EXACT positions
- Use the grid as your measurement ruler for precision

EXTRACTION PROTOCOL:
1. **IDENTIFY ALL TEXT ELEMENTS** using the grid as reference
2. **MEASURE PRECISE BOUNDARIES** for each text element
3. **CONVERT TO NORMALIZED COORDINATES** (0.0 to 1.0)
4. **VERIFY ACCURACY** by checking grid alignment

COORDINATE MEASUREMENT:
- X coordinate: Left edge position (0.0 = left, 1.0 = right)
- Y coordinate: Top edge position (0.0 = top, 1.0 = bottom)  
- Width: Horizontal span of text
- Height: Vertical span of text

Example: Text in grid cell (2,3) to (4,3) = {"x": 0.2, "y": 0.3, "width": 0.2, "height": 0.1}

REQUIRED JSON OUTPUT:
{
  "documentType": "invoice|receipt|form|contract|other",
  "extractedFields": [
    {
      "label": "exact field label",
      "value": "exact field value",
      "confidence": 0.95,
      "gridReference": "cells (2,3) to (4,3)",
      "boundingBox": {
        "x": 0.200,
        "y": 0.300,
        "width": 0.200,
        "height": 0.100
      }
    }
  ],
  "fullText": "complete text content"
}

🔍 CRITICAL: Use the grid lines as your precision ruler. Each grid cell = 0.1 units. BE EXTREMELY PRECISE!

ANALYZE THE GRIDDED IMAGE AND RETURN ULTRA-PRECISE COORDINATES.`;

// Step 2: Self-Correction and Refinement
const COORDINATE_REFINEMENT_PROMPT = `You are a COORDINATE QUALITY INSPECTOR. Review the provided bounding box coordinates and improve their accuracy.

🎯 MISSION: Refine coordinates to achieve PERFECT text alignment.

QUALITY CHECKLIST:
✓ Does the box perfectly frame the text?
✓ Is there minimal padding around text?
✓ Are coordinates within valid range (0.0-1.0)?
✓ Do width/height match text dimensions?

REFINEMENT INSTRUCTIONS:
- Adjust X/Y to better align with text edges
- Modify width/height for perfect text coverage
- Ensure no text is cut off or excluded
- Optimize for visual highlighting accuracy

COORDINATE PRECISION RULES:
- Use 3+ decimal places for accuracy
- Smaller boxes for individual words
- Larger boxes for label+value combinations
- Perfect rectangular alignment

INPUT: Original extraction with coordinates
OUTPUT: Refined coordinates with improvements

REFINE THE COORDINATES FOR MAXIMUM HIGHLIGHTING ACCURACY.`;

// Step 3: Revolutionary Grid Overlay Function
async function addGridOverlay(imageBuffer: Buffer): Promise<Buffer> {
  try {
    console.log('🔲 Adding precision grid overlay...');
    
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    // Create SVG grid overlay
    const gridSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="${width/10}" height="${height/10}" patternUnits="userSpaceOnUse">
            <path d="M ${width/10} 0 L 0 0 0 ${height/10}" fill="none" stroke="#ff0000" stroke-width="1" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        ${Array.from({length: 11}, (_, i) => 
          `<text x="${i * width/10 + 5}" y="15" fill="#ff0000" font-size="12" font-weight="bold">${i}</text>`
        ).join('')}
        ${Array.from({length: 11}, (_, i) => 
          `<text x="5" y="${i * height/10 + 15}" fill="#ff0000" font-size="12" font-weight="bold">${i}</text>`
        ).join('')}
      </svg>
    `;
    
    const gridBuffer = Buffer.from(gridSvg);
    
    // Composite grid onto image
    const result = await image
      .composite([{ input: gridBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();
    
    console.log('✅ Grid overlay added successfully');
    return result;
    
  } catch (error) {
    console.log('⚠️ Grid overlay failed, using original:', (error as Error).message);
    return imageBuffer;
  }
}

// Revolutionary 3-Step Extraction Process
async function extractFromImage(imageBuffer: Buffer, mimeType: string, fileName: string): Promise<any> {
  console.log(`🚀 Starting REVOLUTIONARY 3-step extraction for: ${fileName}`);
  
  try {
    // STEP 1: Add Grid Overlay for Visual Grounding
    const griddedImage = await addGridOverlay(imageBuffer);
    const griddedBase64 = griddedImage.toString('base64');
    
    console.log('📊 STEP 1: Visual Grounding with Grid');
    const step1Response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: VISUAL_GROUNDING_PROMPT
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${griddedBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.05
    });

    const step1Result = step1Response.choices[0]?.message?.content;
    console.log('📊 Step 1 raw response:', step1Result?.substring(0, 200) + '...');

    let step1Data;
    try {
      const jsonMatch = step1Result?.match(/\{[\s\S]*\}/);
      step1Data = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    } catch (parseError) {
      console.log('⚠️ Step 1 JSON parsing failed');
      step1Data = { extractedFields: [] };
    }

    // STEP 2: Self-Correction and Coordinate Refinement
    if (step1Data.extractedFields && step1Data.extractedFields.length > 0) {
      console.log('🔧 STEP 2: Coordinate Refinement');
      
      const step2Response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${COORDINATE_REFINEMENT_PROMPT}

ORIGINAL EXTRACTION TO REFINE:
${JSON.stringify(step1Data, null, 2)}

Please refine these coordinates for maximum accuracy. Return the same JSON structure with improved coordinates.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 3000,
        temperature: 0.05
      });

      const step2Result = step2Response.choices[0]?.message?.content;
      console.log('🔧 Step 2 raw response:', step2Result?.substring(0, 200) + '...');
      
      try {
        const jsonMatch = step2Result?.match(/\{[\s\S]*\}/);
        const refinedData = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
        if (refinedData.extractedFields && refinedData.extractedFields.length > 0) {
          step1Data = refinedData;
          console.log('✅ Coordinates refined successfully');
        }
      } catch (refineError) {
        console.log('⚠️ Step 2 refinement failed, using step 1 results');
      }
    }

    // STEP 3: Final Validation and Enhancement
    const finalData = validateAndEnhanceData(step1Data, fileName);
    console.log(`🎯 EXTRACTION COMPLETE: ${finalData.extractedFields?.length || 0} fields extracted`);
    
    return finalData;

  } catch (error) {
    console.error('❌ Revolutionary extraction failed:', error);
    
    // Emergency fallback with simple extraction
    console.log('🆘 Using emergency fallback extraction...');
    try {
      const fallbackResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all visible text from this image. Return JSON with this structure:
                {
                  "extractedFields": [
                    {
                      "label": "field name",
                      "value": "field value", 
                      "confidence": 0.8,
                      "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.1}
                    }
                  ]
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const fallbackResult = fallbackResponse.choices[0]?.message?.content || '{}';
      const fallbackMatch = fallbackResult.match(/\{[\s\S]*\}/);
      const fallbackData = JSON.parse(fallbackMatch ? fallbackMatch[0] : '{}');
      
      return validateAndEnhanceData(fallbackData, fileName);
      
    } catch (fallbackError) {
      console.error('❌ Emergency fallback failed:', fallbackError);
      return createErrorResponse(fileName);
    }
  }
}

// Enhanced validation with intelligent coordinate fixing
function validateAndEnhanceData(data: any, fileName: string): any {
  const validated = {
    documentType: data.documentType || "unknown",
    extractedFields: Array.isArray(data.extractedFields) ? data.extractedFields : [],
    tables: Array.isArray(data.tables) ? data.tables : [],
    logos: Array.isArray(data.logos) ? data.logos : [],
    signatures: Array.isArray(data.signatures) ? data.signatures : [],
    content: data.fullText || data.content || ""
  };

  // Advanced coordinate validation and enhancement
  validated.extractedFields = validated.extractedFields.map((field: any, index: number) => {
    const validatedField: any = {
      label: field.label || `Field ${index + 1}`,
      value: field.value || "",
      confidence: typeof field.confidence === 'number' ? Math.min(1, Math.max(0, field.confidence)) : 0.7,
      type: field.type || "text",
      position: field.position || "unknown"
    };

    // Revolutionary coordinate processing
    if (field.boundingBox && typeof field.boundingBox === 'object') {
      const bbox = field.boundingBox;
      
      // Smart coordinate normalization
      let x = Number(bbox.x) || 0;
      let y = Number(bbox.y) || 0;
      let width = Number(bbox.width) || 0.1;
      let height = Number(bbox.height) || 0.05;

      // Handle various coordinate formats intelligently
      if (x > 1 || y > 1 || width > 1 || height > 1) {
        // Pixel coordinates - normalize based on common document sizes
        const assumedWidth = Math.max(x + width, 1000);
        const assumedHeight = Math.max(y + height, 1400);
        
        x = x / assumedWidth;
        y = y / assumedHeight;
        width = width / assumedWidth;
        height = height / assumedHeight;
      }

      // Ensure coordinates are within valid bounds with padding
      x = Math.max(0.001, Math.min(0.98, x));
      y = Math.max(0.001, Math.min(0.98, y));
      width = Math.max(0.01, Math.min(0.98 - x, width));
      height = Math.max(0.01, Math.min(0.98 - y, height));

      // Intelligent coordinate enhancement based on field type
      if (field.label && field.label.toLowerCase().includes('total')) {
        // Totals are usually bottom-right, make them more prominent
        width = Math.max(width, 0.15);
        height = Math.max(height, 0.04);
      }
      
      if (field.label && field.label.toLowerCase().includes('invoice')) {
        // Invoice numbers are usually top-center, adjust accordingly
        y = Math.max(0.05, y);
        width = Math.max(width, 0.2);
      }

      validatedField.boundingBox = { x, y, width, height };
      
      console.log(`📍 Enhanced coordinates for "${field.label}":`, validatedField.boundingBox);
      
    } else {
      // Create intelligent fallback coordinates based on field index and type
      const rowHeight = 0.06;
      const startY = 0.1;
      const cols = 2;
      const colWidth = 0.45;
      
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      validatedField.boundingBox = {
        x: 0.05 + (col * 0.5),
        y: startY + (row * rowHeight),
        width: colWidth,
        height: 0.04
      };
      
      console.log(`🎯 Fallback coordinates for "${field.label}":`, validatedField.boundingBox);
    }

    return validatedField;
  });

  return validated;
}

// Create error response with visible error highlighting
function createErrorResponse(fileName: string): any {
  return {
    documentType: "error",
    extractedFields: [
      {
        label: "EXTRACTION ERROR",
        value: `Failed to process ${fileName}. Please try a higher quality image.`,
        confidence: 0.0,
        type: "error",
        boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.15 }
      }
    ],
    tables: [],
    logos: [],
    signatures: [],
    content: "",
    error: "Processing failed"
  };
}

// Keep original PDF extraction unchanged
async function extractFromText(text: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `Extract all label-value pairs from this document text. 
        Identify actual field labels and their corresponding values.
        Return JSON format: {"extractedFields": [{"label": "field name", "value": "field value", "confidence": 0.95}]}`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      ...parsed,
      content: text
    };
  } catch (e) {
    return {
      extractedFields: [],
      content: text
    };
  }
}

// Main extraction endpoint with revolutionary processing
app.post('/api/extract', upload.single('file'), async (req, res) => {
  console.log('🚀 REVOLUTIONARY EXTRACTION REQUEST RECEIVED');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📁 Processing: ${req.file.originalname} (${req.file.mimetype}, ${(req.file.size / 1024).toFixed(1)}KB)`);

    let extracted;
    const startTime = Date.now();
    
    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        extracted = await extractFromText(pdfData.text);
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        return res.status(400).json({ error: 'Failed to parse PDF' });
      }
    } else if (req.file.mimetype.startsWith('image/')) {
      // Use revolutionary 3-step extraction for images
      extracted = await extractFromImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const processingTime = Date.now() - startTime;
    console.log(`⚡ REVOLUTIONARY PROCESSING COMPLETED in ${processingTime}ms`);

    const id = Date.now().toString();
    extractedData.set(id, extracted);

    console.log(`🎯 SUCCESS: Extracted ${extracted.extractedFields?.length || 0} fields with revolutionary precision`);
    res.json({ id, data: extracted });

  } catch (error) {
    console.error('❌ Revolutionary extraction endpoint error:', error);
    res.status(500).json({ error: 'Failed to extract document' });
  }
});

// Keep existing download and chat endpoints unchanged
app.get('/api/download/:id/:format', (req, res) => {
  const { id, format } = req.params;
  const data = extractedData.get(id);
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }

  const exportData = data.extractedFields?.map((field: any) => ({
    Label: field.label,
    Value: field.value,
    Type: field.type || 'text',
    Confidence: field.confidence,
    Position: field.position || ''
  })) || [];

  if (format === 'csv') {
    const csv = Papaparse.unparse(exportData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=extracted.csv');
    res.send(csv);
  } else if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=extracted.xlsx');
    res.send(buffer);
  } else {
    res.status(400).json({ error: 'Invalid format' });
  }
});

app.post('/api/chat', express.json(), async (req, res) => {
  const { id, message } = req.body;
  const data = extractedData.get(id);
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Answer questions about this document: ${JSON.stringify(data)}`
        },
        { role: 'user', content: message }
      ],
      stream: true
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Chat failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 REVOLUTIONARY SERVER running on port ${PORT}`);
  console.log(`🎯 Ready for ULTRA-PRECISE coordinate extraction!`);
});