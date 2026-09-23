import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Поиск треков в открытом каталоге Internet Archive (без ключей и регистрации)
app.get("/api/search", async (req, res) => {
  const q = req.query.q || "music";
  try {
    const url = `https://archive.org/advancedsearch.php?q=mediatype:(audio)+AND+(${encodeURIComponent(q)})&fl[]=identifier&fl[]=title&fl[]=creator&rows=20&output=json`;
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
    const audioFile = files.find(
      (f) => f.format === "VBR MP3" || f.name?.endsWith(".mp3")
    );
    const imageFile = files.find(
      (f) => f.format === "JPEG" || f.format === "PNG" || f.name?.match(/\.(jpg|jpeg|png)$/i)
    );
    if (!audioFile) {
      return res.status(404).json({ error: "У этого трека нет аудиофайла" });
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
