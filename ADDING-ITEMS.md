# Adding Items to the Catalogue

## Process

1. **Receive the photo** — Orr sends a photo via Telegram. It gets saved to `media/inbound/`.
2. **Copy photo to images folder:**
   ```
   Copy-Item "media/inbound/file_XX---*.jpg" "stuff/images/<item-id>-real.jpg"
   ```
3. **Generate silhouette with Grok** using the `/v1/images/edits` endpoint (NOT `/v1/images/generations` — that one ignores the image!):
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
4. **Download the generated image** from the returned URL:
   ```
   Invoke-WebRequest -Uri "<url>" -OutFile "stuff/images/<item-id>-silhouette.jpg"
   ```
5. **Add the listing** to `stuff/data/items.json`:
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

```
python stuff/scripts/silhouette.py "stuff/images/<item-id>-real.jpg" "stuff/images/<item-id>-silhouette.jpg" "#<COLOR>"
```

This does simple brightness/saturation thresholding — works well for photos on plain light backgrounds (walls, floors), less well for busy/dark backgrounds.

Grid dimensions are responsive: **mobile = 4×4 (16 cells)**, **desktop = 6×6 (36 cells)**. On desktop the two plant categories (`garden` + `garden2`) are merged into a single "plants" section; on mobile they stay split. When a non-plant category overflows 16 items on mobile, split into a second category page with " ב'" suffix.

- **Grok endpoint**: Use `/v1/images/edits` (not `/v1/images/generations`). The generations endpoint ignores the image parameter.
- **Prompt**: `create a thumbnail for this image: the traced shape of this object in this flat color: #<COLOR> over this background color: #DDD6CA`
- **Cost**: $0.05 per image (quality model). $5 credits = ~100 images.
- **`price: null`** means no price shown. `price: 0` means "חינם" (free).
- **`thumbnail`** field is optional — if absent, the grid uses the main `images[0]`.
- **Grid is dynamic**: 4×4 = 16 cells on mobile, 6×6 = 36 cells on desktop. Empty cells show a dot pattern. Max items per section matches the grid size.
- **Desktop layout**: horizontal snap-scroll; each section is hero image + details (right) beside the thumbnail grid (left). Plant categories merge on desktop.
