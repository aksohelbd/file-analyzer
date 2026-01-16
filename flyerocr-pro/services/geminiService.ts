
import { GoogleGenAI, Type } from "@google/genai";
import { ProductData } from "../types";

export const extractProductData = async (base64Image: string): Promise<ProductData[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Act as a Senior Data Automation Bot and OCR Expert. Perform IMMEDIATE and HIGH-PRECISION analysis on the provided flyer image.

    ### 1. Accuracy Check:
    If the image is blurry or technical artifacts make data unreadable, return: {"error": "blurry"}

    ### 2. Strict Extraction Rules:
    - English Description: 
       - Extract product name exactly as shown (e.g., "Cup Cake Box Assorted").
       - REMOVE characters: *, ", #.
       - SUFFIX RULE: Ensure exactly ONE space before adding units (e.g., " /kg", " /500gm", or " /Box").
    - Arabic Description (CRITICAL):
       - ONLY extract Arabic text if it is VISIBLY PRINTED in the image for that product.
       - NO AUTO-TRANSLATION: If no Arabic text is printed, return an empty string ("").
       - ARABIC SUFFIX: Capture core name and append measurement (e.g., " /كيلو" or " /علبة") with exactly ONE space if visible icons suggest them.
    - Qty (STRICT): 
       - Identify the quantity (e.g., 2 PCS, 3 Pack). 
       - If the quantity is 1, "Each", or not specified, return null. 
       - Only return numbers > 1.
    - Regular Price (STRICT):
       - Identify the "WAS" price. 
       - Remove ALL currency symbols (AED, SAR, $, etc.), tags, and ignore strike-through line artifacts.
       - If NOT visibly present, return an empty string ("").
       - NO ZEROES: Do not return "0.00" or "0" if missing.
    - Offer Price (STRICT):
       - Identify the "NOW" price.
       - Remove ALL currency symbols, tags, and text artifacts.
       - If NOT visibly present, return an empty string ("").
       - NO ZEROES: Do not return "0.00" or "0" if missing.

    ### 3. Formatting:
    - Visible prices must be formatted with exactly two decimal places (e.g., 10.00, 5.50).
    - Return ONLY a valid JSON array of objects.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1],
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          error: { type: Type.STRING, nullable: true },
          products: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                arabicDescription: { type: Type.STRING },
                qty: { type: Type.NUMBER, nullable: true },
                regularPrice: { type: Type.STRING },
                offerPrice: { type: Type.STRING },
              },
              required: ["description", "arabicDescription", "qty", "regularPrice", "offerPrice"],
            }
          }
        }
      }
    }
  });

  try {
    const text = response.text;
    const result = JSON.parse(text.trim());
    if (result.error === "blurry") {
      throw new Error("Analysis failed: The image is too blurry.");
    }
    return result.products as ProductData[];
  } catch (error: any) {
    console.error("Bot Analysis Error:", error);
    throw new Error(error.message || "Extraction failed.");
  }
};
