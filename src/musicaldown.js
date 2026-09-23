import * as cheerio from "cheerio";

const BASE_URL = "https://musicaldown.com";
const PAGE_URL = "https://musicaldown.com/en";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    const base64 = (parts[1] || "").replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function decodeMuscdnImage(url) {
  try {
    const match = String(url || "").match(/\/a\/images\/([A-Za-z0-9+/=_-]+)/);
    const base64 = match ? match[1].replace(/-/g, "+").replace(/_/g, "/") : "";
    return base64 ? Buffer.from(base64, "base64").toString("utf-8") : url;
  } catch {
    return url;
  }
}

async function musicaldown(tiktokUrl) {
  const cleanUrl = String(tiktokUrl || "").trim();
  ensure(cleanUrl, "URL TikTok diperlukan");

  const pageRes = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  ensure(pageRes.ok, `HTTP Error ${pageRes.status}: Gagal memuat halaman MusicalDown`);

  const cookies = (pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const html = await pageRes.text();
  const $ = cheerio.load(html);
  const form = $("form#submit-form");
  ensure(form.length > 0, "Form pencarian tidak ditemukan");

  const action = form.attr("action") || "/download";
  const postUrl = new URL(action, BASE_URL).toString();

  const body = new URLSearchParams();
  form.find("input").each((_, el) => {
    const name = $(el).attr("name");
    const val = $(el).attr("value") || "";
    const id = $(el).attr("id");
    name && body.append(name, id === "link_url" ? cleanUrl : val);
  });

  const resPost = await fetch(postUrl, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE_URL,
      Referer: PAGE_URL
    },
    body: body.toString()
  });

  ensure(resPost.ok, `HTTP Error ${resPost.status}: Gagal mengirim request`);

  const resultHtml = await resPost.text();
  const $res = cheerio.load(resultHtml);

  const author = $res(".video-author").text().trim() || null;
  const description = $res(".video-desc").text().trim() || null;
  const avatarRaw = $res(".img-area img").attr("src") || null;
  const avatar = decodeMuscdnImage(avatarRaw);

  const styleAttr = $res(".video-header").attr("style") || "";
  const bgMatch = styleAttr.match(/url\(([^)]+)\)/);
  const coverRaw = bgMatch ? bgMatch[1].replace(/['"]/g, "") : null;
  const cover = decodeMuscdnImage(coverRaw);

  const downloads = [];
  $res("a[data-event], .card-action a").each((_, el) => {
    const href = $res(el).attr("href") || "";
    const label = $res(el).text().trim().replace(/\s+/g, " ");
    const isInvalid = !href || href === "/en" || href.startsWith("javascript") || href.startsWith("#");

    const token = href.includes("fastdl.muscdn.app/v3?token=")
      ? new URL(href).searchParams.get("token")
      : null;
    const payload = token ? decodeJwtPayload(token) : null;

    !isInvalid && downloads.push({
      label,
      proxyUrl: href,
      directUrl: payload ? (payload.url || payload.mp3 || payload.cover || null) : null,
      type: payload ? (payload.type || null) : null,
      filename: payload ? (payload.filename || null) : null
    });
  });

  const photoCards = [];
  $res(".card").each((_, el) => {
    const cardImgRaw = $res(el).find(".card-image img").attr("src") || null;
    const cardDownloadHref = $res(el).find(".card-action a").attr("href") || null;
    const token = cardDownloadHref && cardDownloadHref.includes("fastdl.muscdn.app/v3?token=")
      ? new URL(cardDownloadHref).searchParams.get("token")
      : null;
    const payload = token ? decodeJwtPayload(token) : null;

    (cardImgRaw || cardDownloadHref) && photoCards.push({
      thumbnail: decodeMuscdnImage(cardImgRaw),
      downloadUrl: cardDownloadHref,
      directUrl: payload ? (payload.cover || payload.url || null) : null,
      filename: payload ? (payload.filename || null) : null
    });
  });

  const isSlide = photoCards.length > 0;
  const videoDownloads = downloads.filter((d) => d.type === "video" || d.label.toLowerCase().includes("mp4"));
  const audioDownloads = downloads.filter((d) => d.type === "mp3" || d.label.toLowerCase().includes("mp3"));

  ensure(videoDownloads.length > 0 || photoCards.length > 0, "Video atau slide tidak ditemukan, privat, atau URL salah");

  return {
    success: true,
    targetUrl: cleanUrl,
    type: isSlide ? "slide" : "video",
    title: $res("title").text().replace(/\s*\|\s*Download Now!\s*/i, "").trim() || "TikTok Media",
    author,
    description,
    avatar,
    cover,
    video: videoDownloads,
    audio: audioDownloads[0] || null,
    images: photoCards
  };
}

export default { musicaldown };
