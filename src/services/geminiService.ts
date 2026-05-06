// Используем сторонний сервис RouterAI (OpenAI-совместимое API)
const API_URL = "https://routerai.ru/api/v1/chat/completions";

// ВНИМАНИЕ: Хардкодить ключи в коде небезопасно для публичных репозиториев.
// Рекомендуется перенести этот ключ в .env файл как VITE_ROUTERAI_API_KEY
const API_KEY = import.meta.env.VITE_ROUTERAI_API_KEY || "sk-idWLIk8WBHJJiwn-Y2oyMNdW0ckjsfIa";

async function callRouterAI(prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4.6",
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("RouterAI API Error:", errorText);
    throw new Error(`Ошибка API RouterAI: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function refineNote(rawNote: string, project: string): Promise<string> {
  try {
    const prompt = `Вы — эксперт по SEO. Превратите следующую краткую заметку в профессиональное, лаконичное и официальное описание задачи для отчета.
    Проект: ${project}
    Заметка: ${rawNote}
    
    Верните ТОЛЬКО уточненный текст, без лишних слов. Ответ должен быть на русском языке.`;
    
    const result = await callRouterAI(prompt);
    return result || rawNote;
  } catch (error) {
    console.error("Failed to refine note:", error);
    return rawNote; // Возвращаем оригинал в случае ошибки
  }
}

export async function generateReport(notes: { project: string; refined: string; timestamp: string }[]): Promise<string> {
  try {
    const notesText = notes.map(n => `[${n.timestamp}] [${n.project}] ${n.refined}`).join('\n');
    const prompt = `Вы — эксперт по SEO. На основе следующего списка выполненных задач создайте профессиональный итоговый отчет.
    
    Структура отчета:
    ### 📋 Краткое резюме (Summary)
    Выделите наиболее критические задачи, важные инсайты или достижения из списка.
    
    ### 🛠 Детальный список задач
    Сгруппируйте все задачи по проектам. Используйте маркированные списки.
    
    Используйте профессиональное форматирование Markdown и эмодзи для наглядности. Отчет должен быть на русском языке.
    
    Задачи для анализа:
    ${notesText}`;
    
    const result = await callRouterAI(prompt);
    return result || "Не удалось создать отчет.";
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw new Error("Не удалось связаться с RouterAI для генерации отчета.");
  }
}
