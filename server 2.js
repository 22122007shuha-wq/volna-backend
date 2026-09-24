import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
const PORT = process.env.PORT || 3000;

// Распознавание музыки по короткой аудиозаписи через AudD API
// Токен хранится в переменной окружения на Railway (Settings -> Variables -> AUDD_API_TOKEN),
// а не в коде — так он не виден в открытом репозитории.
app.post("/api/recognize", async (req, res) => {
  try {
    const token = process.env.AUDD_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "AUDD_API_TOKEN не настроен на сервере" });
    }
    const { audioBase64 } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({ error: "Нет аудиоданных" });
    }
    const base64Data = audioBase64.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer]);
    const form = new FormData();
    form.append("api_token", token);
    form.append("file", blob, "audio.webm");

    const r = await fetch("https://api.audd.io/", { method: "POST", body: form });
    const data = await r.json();

    if (data.status !== "success" || !data.result) {
      return res.json({ found: false });
    }
    res.json({
      found: true,
      title: data.result.title,
      artist: data.result.artist,
    });
  } catch (err) {
    res.status(500).json({ error: "Ошибка распознавания" });
  }
});

// Поиск треков в открытом каталоге Internet Archive (без ключей и регистрации)
// Ограничиваем поиск разделами, где почти всегда есть полноценные mp3-файлы:
// opensource_audio (независимая музыка), netlabels (нетлейблы), etree (концертные записи)
app.get("/api/search", async (req, res) => {
  const q = req.query.q || "music";
  try {
    const collectionFilter = "(collection:(opensource_audio) OR collection:(netlabels) OR collection:(etree))";
    const url = `https://archive.org/advancedsearch.php?q=mediatype:(audio)+AND+${collectionFilter}+AND+(${encodeURIComponent(q)})&fl[]=identifier&fl[]=title&fl[]=creator&rows=25&output=json`;
    const r = await fetch(url);
    const data = await r.json();
    const docs = data.response?.docs || [];
    const results = docs.map((d) => ({
      id: d.identifier,
      title: d.title || "Без названия",
      artist: d.creator || "Неизвестный исполнитель",
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Не удалось получить данные из каталога" });
  }
});

// Получить прямую ссылку на аудиофайл и обложку по identifier трека
app.get("/api/track/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const r = await fetch(`https://archive.org/metadata/${id}`);
    const data = await r.json();
    const files = data.files || [];
    const audioFile =
      files.find((f) => f.format === "VBR MP3") ||
      files.find((f) => f.name?.toLowerCase().endsWith(".mp3"));
    const imageFile = files.find(
      (f) => f.format === "JPEG" || f.format === "PNG" || f.name?.match(/\.(jpg|jpeg|png)$/i)
    );
    if (!audioFile) {
      return res.status(404).json({ error: "У этого трека нет доступного аудиофайла" });
    }
    res.json({
      streamUrl: `https://archive.org/download/${id}/${encodeURIComponent(audioFile.name)}`,
      coverUrl: imageFile ? `https://archive.org/download/${id}/${encodeURIComponent(imageFile.name)}` : null,
      duration: audioFile.length ? Math.round(parseFloat(audioFile.length)) : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Не удалось получить трек" });
  }
});

app.get("/", (req, res) => res.send("Volna backend работает"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
