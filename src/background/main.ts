import { db, type PageHistory } from '../lib/db';

chrome.runtime.onMessage.addListener((
  message: { type: string; data: PageHistory },
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void
) => {
  if (message.type === "SAVE_CONTEXT" && sender.tab?.url) {
    const pageData: PageHistory = {
      ...message.data,
      url: sender.tab.url,
      favIcon: sender.tab.favIconUrl,
      timestamp: Date.now()
    };

    saveToDatabase(pageData);
  }
  return true;
});

async function saveToDatabase(data: PageHistory): Promise<void> {
  try {
    const existing = await db.history.where('url').equals(data.url).first();

    if (existing && existing.id) {
      await db.history.update(existing.id, {
        timestamp: data.timestamp,
        snippet: data.snippet,
        description: data.description,
        image: data.image,
        title: data.title
      });
    } else {
      await db.history.add(data);
    }

    const count = await db.history.count();
    if (count > 1000) {
      const oldest = await db.history.orderBy('timestamp').first();
      if (oldest?.id) {
        await db.history.delete(oldest.id);
      }
    }
  } catch (err) {
    console.error("Failed to save context:", err);
  }
}
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});