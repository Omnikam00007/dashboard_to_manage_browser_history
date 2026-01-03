interface PageContext {
  title: string;
  description: string;
  image: string;
  heading: string;
  snippet: string;
  timestamp: number;
}

const extractPageContext = (): PageContext => {
  const metaDescription =
    (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content;
  const previewImage =
    (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content ||
    (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href;

  const mainHeading = document.querySelector('h1')?.innerText;
  let contentText = "";

  const mainElement = document.querySelector('main') || document.querySelector('article') || document.body;
  const paragraphs = Array.from(mainElement.querySelectorAll('p'));

  const meaningfulParagraphs = paragraphs
    .map(p => p.innerText.trim())
    .filter(text =>
      text.length > 80 &&
      !text.toLowerCase().includes('cookie') &&
      !text.toLowerCase().includes('subscribe') &&
      !text.toLowerCase().includes('sign up') &&
      !text.toLowerCase().includes('login') &&
      !text.toLowerCase().includes('share this') &&
      !text.toLowerCase().includes('all rights reserved')
    );

  if (meaningfulParagraphs.length > 0) {
    contentText = meaningfulParagraphs.slice(0, 2).join(' ');
  } else {
    contentText = document.body.innerText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 60)
      .join(' ');
  }

  const bodySnippet = contentText
    .replace(/\s+/g, ' ')
    .substring(0, 300);

  return {
    title: document.title,
    description: metaDescription || bodySnippet || "No description available",
    image: previewImage || "",
    heading: mainHeading || "",
    snippet: bodySnippet + "...",
    timestamp: new Date().getTime()
  };
};

const pageData: PageContext = extractPageContext();

chrome.runtime.sendMessage({
  type: "SAVE_CONTEXT",
  data: pageData
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error("Context extraction failed (runtime error):", chrome.runtime.lastError);
  } else if (response && !response.success) {
    console.error("Context extraction failed (background error):", response.error);
  } else {
    // Optional: Log success if needed, or just be silent on success
    // console.log("Context saved successfully"); 
  }
});