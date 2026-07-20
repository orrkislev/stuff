# Adding Items to the Catalogue

## Process

1. **Receive the photo** — Orr sends a photo via Telegram. It gets saved to `media/inbound/`.
2. **Copy photo to images folder:**
   ```
   Copy-Item "media/inbound/file_XX---*.jpg" "stuff/images/<item-id>-real.jpg"
   ```
3. **Photo cleanup (if needed)** — if the photo is messy (clutter, dust, bad lighting, distracting background), clean it up using **Gemini image editing** (`google/gemini-3.1-flash-image-preview` or `gemini-3-pro-image-preview` for higher quality):
   - Prompt: `"Clean up this photo for a catalog listing: remove dust, clutter, and distracting background objects. Improve lighting slightly. Keep it natural and honest — don't make it look like a product ad, just a clean clear photo of the item."`
   - Overwrite `<item-id>-real.jpg` with the cleaned version.
   - **Skip if:** photo is already clean and well-lit. Use judgment — don't over-process.
   - **Alternative providers:** Grok Imagine (`xai/grok-imagine-image-quality`) or OpenAI (`openai/gpt-image-2`) can also be used if Gemini is unavailable or produces poor results.
4. **Ask for extra info (when it makes sense)** — after seeing the item, ask Orr about details that would help buyers but aren't visible in the photo. Don't ask about everything — only when relevant:
   - **Dimensions** (size, height, width) — especially for furniture, appliances, large items
   - **Condition** (new, like new, used, has scratches) — if not obvious from the photo
   - **Age / year purchased** — for electronics, furniture, appliances
   - **Brand / model** — if visible but unclear, or for electronics/furniture
   - **Material** — if not obvious (wood? metal? fabric type?)
   - **Working condition** — for electronics, appliances, anything mechanical
   - **Included accessories** — cables, remote, charger, etc.
   - Don't ask if Orr already mentioned these in his message. Don't nag — one batched question, not a form.
5. **Generate silhouette with Grok** using the `/v1/images/edits` endpoint (NOT `/v1/images/generations` — that one ignores the image!):
   ```powershell
   $key = (Get-Content "$env:USERPROFILE\.openclaw\secrets\xai-key.json" | ConvertFrom-Json).apiKey
   $imgBytes = [System.IO.File]::ReadAllBytes("stuff/images/<item-id>-real.jpg")
   $b64 = [System.Convert]::ToBase64String($imgBytes)

   Add-Type -AssemblyName System.Net.Http
   $client = New-Object System.Net.Http.HttpClient
   $client.DefaultRequestHeaders.Add("Authorization", "Bearer $key")
   $client.Timeout = [System.TimeSpan]::FromSeconds(120)

   $body = @{
     model = "grok-imagine-image-quality"
     prompt = "create a thumbnail for this image: the traced shape of this object in this flat color: #<COLOR> over this background color: #DDD6CA"
     image = @{
       url = "data:image/jpeg;base64,$b64"
       type = "image_url"
     }
   } | ConvertTo-Json -Depth 5

   $content = New-Object System.Net.Http.StringContent($body, [System.Text.Encoding]::UTF8, "application/json")
   $response = $client.PostAsync("https://api.x.ai/v1/images/edits", $content).Result
   $response.Content.ReadAsStringAsync().Result
   ```
6. **Download the generated image** from the returned URL:
   ```
   Invoke-WebRequest -Uri "<url>" -OutFile "stuff/images/<item-id>-silhouette.jpg"
   ```
7. **Add the listing** to `stuff/data/items.json`:
   ```json
   {
     "id": "<unique-id>",
     "title": "<Hebrew title>",
     "category": "<category-id>",
     "price": <number or null>,
     "status": "available",
     "description": "<Hebrew description or empty string>",
     "images": ["<item-id>-real.jpg"],
     "thumbnail": "<item-id>-silhouette.jpg"
   }
   ```

## Color Palette

Cycle through these colors for thumbnails (don't use the same color twice in a row):

| Color     | Hex       |
|-----------|-----------|
| Blue      | `#538094` |
| Dark Green| `#245238` |
| Gray      | `#77787A` |
| Navy      | `#34536A` |
| Orange    | `#AA4B27` |
| Wine      | `#80263E` |
| Gold      | `#B58D30` |

## Categories

| ID           | Name (Hebrew)    |
|--------------|------------------|
| livingroom   | סלון             |
| kitchen      | מטבח             |
| bedroom      | חדר שינה         |
| kids         | חדר ילדים        |
| books        | ספרים            |
| electronics  | אלקטרוניקה       |
| garden       | גינה ומרפסת      |
| decor        | עיצוב ונוי       |
| other        | שונות            |

## Fallback: Python Silhouette Script

If Grok is unavailable or the result is bad, use the background-removal script:

If Grok is unavailable or the result is bad, use the background-removal script:

```
python stuff/scripts/silhouette.py "stuff/images/<item-id>-real.jpg" "stuff/images/<item-id>-silhouette.jpg" "#<COLOR>"
```

This does simple brightness/saturation thresholding — works well for photos on plain light backgrounds (walls, floors), less well for busy/dark backgrounds.

## When to Ask for Extra Info

Not every item needs a question. Use these guidelines:

| Ask about... | When... |
|---|---|
| Dimensions | Furniture, appliances, rugs, mirrors, large decor |
| Condition | Not obvious from photo, or item looks worn |
| Brand/model | Electronics, appliances, recognizable furniture brands |
| Age | Electronics, appliances, mattresses |
| Material | Not clear from photo (e.g. "is this solid wood or veneer?") |
| Working condition | Anything with electronics, motors, or moving parts |
| Accessories | Electronics, appliances, tools — anything with cables/remotes/parts |

**Rules:**
- Ask in **one batched message**, not a form-like sequence of questions
- If Orr already said "selling our IKEA MALM dresser, 160cm" → don't ask for dimensions or brand
- If the photo clearly shows condition → don't ask
- Keep it conversational: "Nice chair — do you know the dimensions?"
- It's OK to skip questions for simple/obvious items (plants, books, small decor)

Grid dimensions are responsive: **mobile = 4×4 (16 cells)**, **desktop = 6×6 (36 cells)**. On desktop the two plant categories (`garden` + `garden2`) are merged into a single "plants" section; on mobile they stay split. When a non-plant category overflows 16 items on mobile, split into a second category page with " ב'" suffix.

- **Grok endpoint**: Use `/v1/images/edits` (not `/v1/images/generations`). The generations endpoint ignores the image parameter.
- **Prompt**: `create a thumbnail for this image: the traced shape of this object in this flat color: #<COLOR> over this background color: #DDD6CA`
- **Cost**: $0.05 per image (quality model). $5 credits = ~100 images.
- **`price: null`** means no price shown. `price: 0` means "חינם" (free).
- **`thumbnail`** field is optional — if absent, the grid uses the main `images[0]`.
- **Grid is dynamic**: 4×4 = 16 cells on mobile, 6×6 = 36 cells on desktop. Empty cells show a dot pattern. Max items per section matches the grid size.
- **Desktop layout**: horizontal snap-scroll; each section is hero image + details (right) beside the thumbnail grid (left). Plant categories merge on desktop.
