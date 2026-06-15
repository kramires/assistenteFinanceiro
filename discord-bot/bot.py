import os
import httpx
import discord

API_BASE          = os.environ.get("FINANCAS_API_URL", "http://financas-api:8001")
ADMIN_USERNAME    = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD    = os.environ["ADMIN_PASSWORD"]
ALLOWED_USER_ID   = int(os.environ["DISCORD_ALLOWED_USER_ID"])
ALLOWED_CHANNEL_ID = int(os.environ["DISCORD_CHANNEL_ID"])
DISCORD_TOKEN     = os.environ["DISCORD_BOT_TOKEN"]

_jwt: str | None = None


async def _refresh_token() -> str:
    global _jwt
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.post(
            f"{API_BASE}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        )
        resp.raise_for_status()
        _jwt = resp.json()["access_token"]
    return _jwt


def _headers() -> dict:
    return {"Authorization": f"Bearer {_jwt}"}


async def _post(path: str, **kwargs) -> httpx.Response:
    """POST com refresh automático de JWT em caso de 401."""
    async with httpx.AsyncClient(timeout=60) as http:
        resp = await http.post(f"{API_BASE}{path}", headers=_headers(), **kwargs)
        if resp.status_code == 401:
            await _refresh_token()
            resp = await http.post(f"{API_BASE}{path}", headers=_headers(), **kwargs)
    return resp


# ── Bot ───────────────────────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.message_content = True
bot = discord.Client(intents=intents)


@bot.event
async def on_ready():
    await _refresh_token()
    print(f"[financas-bot] online como {bot.user}")


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    if message.author.id != ALLOWED_USER_ID:
        return
    if message.channel.id != ALLOWED_CHANNEL_ID:
        return

    # Comando de ajuda
    if message.content.strip().lower() in ("!ajuda", "!help"):
        await message.reply(
            "**Assistente Financeiro**\n\n"
            "📝 **Texto** — escreva a transação diretamente\n"
            "> `almoço com cliente R$ 85 hoje`\n\n"
            "🎤 **Voz** — envie mensagem de voz ou arquivo de áudio\n"
            "> Whisper transcreve e a IA lança automaticamente\n\n"
            "🧾 **Nota** — envie foto de nota fiscal ou cupom\n"
            "> A IA extrai valor e descrição e lança\n\n"
            "_Sem prefixo de comando — tudo que você enviar é processado._"
        )
        return

    # Anexos: áudio ou imagem
    for att in message.attachments:
        ct = (att.content_type or "").split(";")[0].strip()
        ext = att.filename.rsplit(".", 1)[-1].lower() if "." in att.filename else ""

        is_audio = ct.startswith("audio/") or ext in ("mp3", "ogg", "webm", "wav", "m4a", "aac")
        is_image = ct.startswith("image/") or ext in ("jpg", "jpeg", "png", "webp", "gif", "heic")

        if is_audio:
            await _handle_audio(message, att, ct or "audio/ogg")
            return
        if is_image:
            await _handle_image(message, att, ct or "image/jpeg")
            return

    # Texto livre → lançamento por texto
    if message.content.strip():
        await _handle_texto(message)


async def _handle_texto(message: discord.Message):
    async with message.channel.typing():
        resp = await _post("/api/ia/lancar-texto", json={"texto": message.content})
    await _reply_result(message, resp, "📝")


async def _handle_audio(message: discord.Message, att: discord.Attachment, ct: str):
    aviso = await message.reply("🎤 Transcrevendo com Whisper...")
    audio = await att.read()
    resp = await _post("/api/ia/lancar-audio", files={"file": (att.filename, audio, ct)})
    await aviso.delete()
    await _reply_result(message, resp, "🎤")


async def _handle_image(message: discord.Message, att: discord.Attachment, ct: str):
    aviso = await message.reply("🧾 Lendo nota fiscal...")
    img = await att.read()
    resp = await _post("/api/nota/upload", files={"file": (att.filename, img, ct)})
    await aviso.delete()
    await _reply_result(message, resp, "🧾")


async def _reply_result(message: discord.Message, resp: httpx.Response, icon: str):
    if resp.status_code == 200:
        tx = resp.json()
        valor = tx["valor"]
        sinal = "+" if valor > 0 else ""
        await message.reply(
            f"{icon} **{tx['descricao']}**\n"
            f"💰 {sinal}R$ {abs(valor):.2f}  •  📅 {tx['data']}"
        )
    else:
        try:
            detail = resp.json().get("detail", "Erro desconhecido")
        except Exception:
            detail = f"HTTP {resp.status_code}"
        msg = " | ".join(detail) if isinstance(detail, list) else str(detail)
        await message.reply(f"❌ {msg}")


bot.run(DISCORD_TOKEN)
