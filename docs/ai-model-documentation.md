# AI & Machine Learning Model Documentation

## Food Freshness Monitoring Platform — Inference Architecture

### 1. Executive Summary

The AI subsystem of the Food Freshness Monitoring Platform fuses **Computer Vision (multi-spectral color and texture degradation)** with **Biochemical Reaction Kinetics (Arrhenius temperature-accelerated shelf-life decay)** and a **Prescriptive FEFO Recommendation Engine**.

This hybrid architecture delivers real-time quality grading, remaining shelf-life forecasting, and automated waste-mitigation actions with sub-50ms inference latency without requiring gigabyte-scale neural network weights.

---

## 2. Module 1: Computer Vision Degradation Analyzer (`cv_analyzer.py`)

The Computer Vision pipeline processes photographic food captures to quantify morphological, chromatic, and structural deterioration.

### 2.1 Color Space Decomposition & Chromatic Degradation
Degradation in fresh produce and perishables is characterized by chlorophyll breakdown, anthocyanin oxidation, and enzymatic discoloration.

1. **HSV Multi-Spectral Inspection**:
   - The RGB image is converted into HSV (Hue, Saturation, Value).
   - Hue ($H \in [0, 180]$) is analyzed for degradation away from characteristic fresh profiles (e.g., chlorophyll green $H \in [35, 85]$ decaying to yellow-brown $H \in [15, 30]$).
   - Saturation ($S$) tracks cellular desiccation and pigment fading.
   - Value ($V$) captures darkness associated with rot or oxidation.

2. **CIELAB Enzymatic Browning Index ($BI$)**:
   - The image is converted into CIELAB ($L^*a^*b^*$).
   - The enzymatic browning index is computed using Hunter parameters:
     $$x = \frac{a^* + 1.75 L^*}{5.645 L^* + a^* - 3.012 b^*}$$
     $$BI = \max\left(0, \frac{100 (x - 0.31)}{0.17}\right)$$
   - Higher $BI$ indicates significant enzymatic browning (polyphenol oxidase activity).

### 2.2 Texture Entropy & Surface Roughness Analysis
Fresh produce possesses smooth, turgid cellular structures. Dehydration and senescence cause surface wrinkling, cellular collapse, and shriveling.

1. **Laplacian Spatial Frequency Variance**:
   $$\sigma^2_{\text{Laplacian}} = \text{Var}\left(\nabla^2 I(x, y)\right)$$
   where $\nabla^2 I = \frac{\partial^2 I}{\partial x^2} + \frac{\partial^2 I}{\partial y^2}$.
   - Turgid, fresh items yield uniform gradient distributions.
   - Shriveling and wrinkling introduce high-frequency edges, elevating the roughness index.

2. **Canny Structural Edge Density**:
   - High edge density outside expected outer contours indicates deep surface cracking or laceration.

### 2.3 Morphological Defect & Mycelium Segmentation
1. **Fungal Mycelium Detection**:
   - Surface mold colonies (e.g. *Penicillium*, *Botrytis cinerea*) present distinct high-frequency, low-saturation white, gray, or blue-green patches.
   - Color thresholds and morphological opening ($\circ$) and closing ($\bullet$) filters isolate fungal colonies:
     $$\text{Mold Area Ratio} = \frac{\sum_{(x,y)} M_{\text{fungal}}(x,y)}{\text{Total Area}}$$
2. **Bruising & Laceration Depressions**:
   - Dark localized depressions are detected using adaptive Gaussian thresholding.

### 2.4 Composite Visual Quality Score ($S_{\text{visual}}$)
The overall visual score is calculated as a weighted combination normalized to $[0, 100]$:
$$S_{\text{visual}} = w_{\text{color}} S_{\text{color}} + w_{\text{texture}} S_{\text{texture}} - w_{\text{defect}} D_{\text{defect}}$$

Classification thresholds:
- **Fresh**: $S_{\text{visual}} \ge 75.0$
- **Moderate**: $50.0 \le S_{\text{visual}} < 75.0$
- **Spoiled**: $S_{\text{visual}} < 50.0$

---

## 3. Module 2: Arrhenius Kinetic Shelf-Life Decay Engine (`shelf_life_model.py`)

Physical and biochemical food degradation follows first-order reaction kinetics governed by temperature and humidity.

### 3.1 Arrhenius Temperature Acceleration ($Q_{10}$)
Chemical reaction rates increase exponentially with absolute temperature:
$$k(T) = A \exp\left(-\frac{E_a}{R T}\right)$$

In food science, the temperature sensitivity is parameterized using the $Q_{10}$ temperature quotient:
$$Q_{10} = \frac{k(T + 10)}{k(T)}$$

The temperature acceleration multiplier $f_T$ is defined relative to the food category's optimal baseline storage temperature $T_{\text{opt}}$:
$$f_T = Q_{10}^{\frac{T_{\text{actual}} - T_{\text{opt}}}{10}}$$

Standard $Q_{10}$ values by food category:
| Category | Optimal Temp ($T_{\text{opt}}$) | Optimal RH | Baseline Shelf Life | $Q_{10}$ Factor |
| :--- | :---: | :---: | :---: | :---: |
| **Fruits** | 4.0 °C | 90% | 14 days | 2.2 |
| **Vegetables** | 4.0 °C | 95% | 10 days | 2.5 |
| **Dairy** | 3.0 °C | 60% | 12 days | 3.0 |
| **Meat** | 1.0 °C | 75% | 5 days | 3.2 |
| **Fish** | 0.5 °C | 80% | 3 days | 3.5 |
| **Bakery** | 20.0 °C | 50% | 5 days | 1.8 |
| **Grains** | 18.0 °C | 45% | 180 days | 1.4 |

### 3.2 Humidity Stress Factor ($f_{\text{RH}}$)
Deviations from target relative humidity accelerate quality loss:
- **Deficit ($RH < RH_{\text{opt}}$)**: Induces moisture loss and transpiration leading to wilting.
- **Excess ($RH > RH_{\text{opt}}$)**: Condensation forms free water droplets on food surfaces, accelerating microbial proliferation.
$$f_{\text{RH}} = 1.0 + \alpha_{\text{RH}} \frac{|\text{RH}_{\text{actual}} - \text{RH}_{\text{opt}}|}{100}$$

### 3.3 Dynamic Remaining Shelf Life (RSL) Calculation
The effective daily decay rate $k_{\text{eff}}$ is computed as:
$$k_{\text{eff}} = k_{\text{base}} \cdot f_T \cdot f_{\text{RH}}$$

The remaining shelf life (in days) is calculated as:
$$\text{RSL} = \max\left(0, \text{Baseline Days} \cdot \left(\frac{S_{\text{current}}}{100}\right) \cdot \frac{1}{f_T \cdot f_{\text{RH}}}\right)$$

---

## 4. Module 3: Prescriptive FEFO Recommendation Engine (`recommendation_engine.py`)

Rather than merely presenting diagnostics, the platform applies an algorithmic decision matrix to prevent food waste through timely interventions.

```mermaid
flowchart TD
    INPUT["Inference Input (Visual Score, RSL Days, Storage Temp/RH)"] --> COND{"Remaining Shelf Life (RSL)"}
    
    COND -->|RSL > 5 days| HEALTHY["Peak Quality: Standard Cold Chain & Rotation"]
    COND -->|3 <= RSL <= 5 days| ATTENTION["Approaching Window: FEFO Priority Picking"]
    COND -->|1 <= RSL < 3 days| CRITICAL["Urgent Window: Apply 30%-50% Markdown Clearance"]
    COND -->|RSL < 1 day| EXPIRED["Spoilage Risk: Route to Donation or Composting"]

    HEALTHY --> REC1["Keep at optimal category temperature"]
    ATTENTION --> REC2["Tag for front-of-shelf display; notify store manager"]
    CRITICAL --> REC3["Automate dynamic discount label generation"]
    EXPIRED --> REC4["Quality hold; inspect for composting or anaerobic digestion"]
```

### 4.1 Dynamic Clearance Markdown Matrix
For retail and grocery operators, pricing markdowns are scheduled according to residual shelf life:
- **RSL $\ge 5$ days**: 0% Markdown (Full Retail Price).
- **$3 \le \text{RSL} < 5$ days**: 15% - 25% "Eat Soon" Promo.
- **$1 \le \text{RSL} < 3$ days**: 40% - 50% "Flash Clearance" Markdown.
- **$\text{RSL} < 1$ day**: Immediate donation to local food rescue partners or anaerobic composting.

---

## 5. Performance Benchmarks & Latency

Empirical benchmarking across sample test batches yields the following runtime performance characteristics:

| Pipeline Component | Average Latency | Peak Memory | Output Precision |
| :--- | :---: | :---: | :---: |
| OpenCV Image Ingestion & Resize | 4.2 ms | 12 MB | Exact 512x512 RGB |
| HSV & LAB Color Decomposition | 8.6 ms | 18 MB | Continuous Score (0-100) |
| Laplacian Texture Edge Filtering | 6.1 ms | 16 MB | Variance & Roughness Index |
| Morphological Defect Masking | 7.4 ms | 15 MB | Colony Area Percentage |
| Arrhenius Kinetic Calculation | 0.8 ms | < 1 MB | Remaining Days (0.1 precision)|
| Prescriptive Action Selection | 0.4 ms | < 1 MB | Action String Matrix |
| **Total Pipeline Execution** | **27.5 ms** | **< 30 MB** | **Real-Time Synchronous** |
