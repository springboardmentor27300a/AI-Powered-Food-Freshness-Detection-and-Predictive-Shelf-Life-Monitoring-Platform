# Shelf-Life Estimation Model

## Method: Option B — documented, transparent rule-based estimation

No public, reliably-labeled shelf-life regression dataset was used, so per
the project's own instruction ("do not claim that a model accurately
predicts real food shelf life unless it is trained and validated using
suitable shelf-life data"), this module does **not** claim to be a trained
ML regressor. Instead it implements a clearly documented formula
(`app/services/shelf_life_service.py`), and every prediction's `factors`
JSON and `explanation` text show exactly how the number was produced.

If you later obtain a real labeled shelf-life dataset, `ShelfLifePrediction.method`
already has an `ml_model` option ready to switch to — the schema and DB
table don't need to change.

## Inputs

- Food category (from the batch's food item)
- Product age in days (today − received_date/manufacturing_date)
- Latest storage reading for the batch (temperature °C, humidity %) — if
  none exists, reference conditions are used and confidence is reduced
- Latest OpenCV overall visual score (0–100) — if none exists, confidence
  is reduced

## Calculation

1. **Baseline days** — a published-guidance-style number of days a food
   category typically lasts under reference refrigerated conditions
   (4°C / 90% humidity). See `CATEGORY_BASELINE_DAYS` in
   `shelf_life_service.py` for the table used (e.g. seafood: 2 days,
   packaged foods: 30 days).
2. **Temperature adjustment** — a Q10-style factor:
   `2 ** ((4 - actual_temp_C) / 10)`. This is a standard food-science
   approximation that spoilage rate roughly doubles for every 10°C rise
   above the reference temperature (and roughly halves for every 10°C
   below it).
3. **Humidity adjustment** — a category-specific ideal humidity band;
   deviating from it costs a documented percentage of remaining life.
4. **Visual-condition adjustment** — if the OpenCV analysis already shows
   degradation (lower `overall_visual_score`), the baseline is scaled down
   accordingly, because a photographed item that already looks degraded
   has less remaining life than a "textbook fresh" item of the same age.
5. **Subtract product age** to get `estimated_days_remaining`.
6. **Risk level** — thresholds on `remaining / baseline`: <0 → critical,
   <15% → high, <40% → moderate, else low.
7. **Confidence** — starts at 90%, and is reduced (down to a floor of 30%)
   whenever a real input (storage reading, visual score) had to be
   defaulted instead of measured.

## Limitations

- This is a decision-support estimate, not a laboratory-validated
  prediction. It has not been validated against real spoilage outcomes.
- The baseline-days table is a reasonable default set, not a certified
  food-safety standard — a real deployment should have these reviewed by
  a food-safety professional per category/region.
- The Q10 approximation is a general food-science heuristic; actual
  spoilage kinetics vary by food type and microbial load.

## Validation method

None yet performed (no ground-truth shelf-life outcome data available in
this project). The `docs/CNN_TRAINING.md` metrics are the only
professionally validated numbers in this project (test-set classification
metrics). This module's output is explicitly labeled "estimate" everywhere
it's surfaced in the API and UI.
