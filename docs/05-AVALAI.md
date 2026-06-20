# یکپارچه‌سازی AvalAI — GPT-5.5 و Whisper

> نسخه ۱.۰ | لایه‌ی انتزاع قابل‌تعویض برای LLM و STT

## ۱. اصل طراحی
تمام منطق AI پشت دو اینترفیس قرار می‌گیرد تا Provider قابل‌تعویض باشد (AvalAI امروز،
هر Provider دیگر فردا) بدون تغییر در LangGraph یا دامنه.

```python
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str,
                       schema: type[BaseModel] | None = None,
                       temperature: float = 0.2) -> BaseModel | str: ...

class SpeechToTextProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes, language: str = "fa") -> "Transcript": ...
```

## ۲. پیاده‌سازی AvalAI

AvalAI سازگار با API استاندارد OpenAI است؛ بنابراین از `AsyncOpenAI` با `base_url` AvalAI استفاده می‌کنیم.

```python
from openai import AsyncOpenAI

class AvalAILLMProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str = "gpt-5.5"):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def complete(self, system, user, schema=None, temperature=0.2):
        if schema is not None:
            resp = await self._client.beta.chat.completions.parse(
                model=self._model, temperature=temperature,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                response_format=schema,
            )
            return resp.choices[0].message.parsed
        resp = await self._client.chat.completions.create(
            model=self._model, temperature=temperature,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}])
        return resp.choices[0].message.content


class AvalAIWhisperProvider(SpeechToTextProvider):
    def __init__(self, api_key: str, base_url: str, model: str = "whisper-1"):
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def transcribe(self, audio: bytes, language: str = "fa") -> Transcript:
        import io
        f = io.BytesIO(audio); f.name = "audio.mp3"
        resp = await self._client.audio.transcriptions.create(
            model=self._model, file=f, language=language,
            response_format="verbose_json")
        return Transcript(content=resp.text,
                          segments=[s.model_dump() for s in (resp.segments or [])],
                          language=language)
```

## ۳. تنظیمات (Environment)
```env
AVALAI_API_KEY=...
AVALAI_BASE_URL=https://api.avalai.ir/v1
AVALAI_LLM_MODEL=gpt-5.5
AVALAI_STT_MODEL=whisper-1
AI_LLM_TIMEOUT=60
AI_STT_TIMEOUT=120
```

## ۴. مدیریت هزینه و پایداری
- **Caching:** نتیجه‌ی استخراج بر اساس hash متن در Redis کش می‌شود (جلوگیری از پردازش مجدد).
- **Retry/Backoff:** ۳ تلاش با backoff نمایی؛ مدیریت خطای `429`/`5xx`.
- **Timeout:** جدا برای LLM و STT.
- **Fallback مدل:** در صورت اشباع GPT-5.5، تعویض خودکار به مدل سبک‌تر AvalAI با همان interface.
- **Token Guard:** کوتاه‌سازی متن‌های بسیار بلند قبل از ارسال (chunking + map-reduce برای تماس‌های طولانی).

## ۵. پرامپت‌ها (نمونه‌ی Extraction)
System prompt به فارسی، با دستور خروجی JSON ساختاریافته و schema اجباری (`with_structured_output`).

```text
تو یک تحلیلگر فروش آموزشی هستی. از متن مکالمه‌ی تلفنی، اطلاعات زیر را دقیق استخراج کن.
اگر اطلاعاتی موجود نیست، مقدار null بگذار. حدس نزن. خروجی فقط طبق schema.
فیلدها: نام کامل، نام دوره، هدف آموزشی، تمایل به ثبت‌نام، اعتراض‌ها،
دغدغه‌ی بودجه، تاریخ پیگیری ترجیحی، فوریت، سیگنال‌های خرید.
```

## ۶. افزودن Provider جدید
کلاس جدید `XProvider(LLMProvider)`/`XSTTProvider(SpeechToTextProvider)`، ثبت در Factory،
و تنظیم `AI_PROVIDER=x`. بدون تغییر در LangGraph یا Use Caseها.
