import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("GEMINI_API_KEY is not set. AI features will not work.");
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

export async function refineNote(rawNote: string, project: string): Promise<string> {
  if (!ai) throw new Error("API ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в .env файл.");
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Вы — эксперт по SEO. Превратите следующую краткую заметку в профессиональное, лаконичное и официальное описание задачи для отчета.
    Проект: ${project}
    Заметка: ${rawNote}
    
    Верните ТОЛЬКО уточненный текст, без лишних слов. Ответ должен быть на русском языке.`,
  });
  return response.text || rawNote;
}

export async function generateReport(notes: { project: string; refined: string; timestamp: string }[]): Promise<string> {
  if (!ai) throw new Error("API ключ Gemini не настроен. Пожалуйста, добавьте GEMINI_API_KEY в .env файл.");

  const notesText = notes.map(n => `[${n.timestamp}] [${n.project}] ${n.refined}`).join('\n');
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Вы — эксперт по SEO. На основе следующего списка выполненных задач создайте профессиональный итоговый отчет.
    Сгруппируйте задачи по проектам, если их несколько. Используйте профессиональное форматирование (Markdown).
    Отчет должен быть на русском языке.
    
    Задачи:
    ${notesText}`,
  });
  return response.text || "Не удалось создать отчет.";
}
