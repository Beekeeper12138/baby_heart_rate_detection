import { GoogleGenAI } from "@google/genai";
import { HistoryRecord } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize only if key exists to avoid immediate errors, though usage will fail if missing.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateHealthSummary = async (record: HistoryRecord): Promise<string> => {
  if (!ai) return "API Key not configured.";

  try {
    const prompt = `
      You are an expert pediatric health assistant. Analyze the following infant heart rate monitoring record:
      Date: ${record.date}
      Time: ${record.startTime} to ${record.endTime}
      Average Heart Rate: ${record.avgBpm} BPM
      Signal Quality: ${record.signalQuality}

      Please provide a brief, reassuring summary of this session in Chinese (Simplified). 
      Explain if the heart rate is within a normal range for an infant (usually 100-160 BPM depending on activity). 
      Keep it under 100 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate analysis at this time. Please check your network or API key.";
  }
};

export const generateLiveInsight = async (bpm: number, spo2: number, respRate: number): Promise<string> => {
  if (!ai) return "AI ready.";

  try {
    const prompt = `
      Provide a very short, single-sentence status check for an infant with the following vitals:
      HR: ${bpm} BPM, SpO2: ${spo2}%, Resp Rate: ${respRate}/min.
      Is this normal? (Yes/No/Attention needed). Language: Chinese.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed
      }
    });

    return response.text || "Monitoring...";
  } catch (error) {
    return "Monitoring active.";
  }
}
