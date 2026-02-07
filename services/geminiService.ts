import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSocialPosts = async (
  topic: string, 
  tone: string
): Promise<any> => {
  const ai = getClient();
  
  const prompt = `
    Create 3 social media posts about the following topic: "${topic}".
    Tone: ${tone}.
    
    1. LinkedIn: Professional, structured, bullet points.
    2. Twitter: Short, punchy, under 280 chars.
    3. Facebook: Engaging, question-oriented.
    
    Return ONLY a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              content: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const processBotMessage = async (
  userMessage: string,
  context: string = "Standard e-commerce store context"
): Promise<{ reply: string, intent: string, sentiment: string }> => {
  const ai = getClient();

  const prompt = `
    Act as a customer service AI bot.
    Context: ${context}
    User Message: "${userMessage}"
    
    1. Analyze the intent (e.g., pricing, complaint, greeting, support).
    2. Analyze the sentiment (positive, neutral, negative).
    3. Generate a helpful response in English.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            intent: { type: Type.STRING },
            sentiment: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { reply: "I'm having trouble connecting.", intent: "error", sentiment: "neutral" };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const simulatePhoneCallResponse = async (
  transcribedText: string
): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    You are a phone support agent. The user just said: "${transcribedText}".
    Keep your response very brief (under 20 words) and conversational as if speaking.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || "I didn't catch that.";
};