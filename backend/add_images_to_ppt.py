from pptx import Presentation
from pptx.util import Inches, Pt
import glob
import os

PRESENTATION = "FreshGuard_M2_Review_Presentation.pptx"
OUT = "FreshGuard_M2_Review_with_images.pptx"

def find_example_images(base_path, classes):
    results = {}
    for cls in classes:
        pattern = os.path.join(base_path, "dataset", "test", cls, "*")
        files = [f for f in glob.glob(pattern) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp'))]
        if files:
            results[cls] = files[0]
        else:
            results[cls] = None
    return results

def add_images_slide(prs, images_by_class):
    slide_layout = prs.slide_layouts[5]  # blank
    slide = prs.slides.add_slide(slide_layout)
    title_box = slide.shapes.title if hasattr(slide.shapes, 'title') else None
    try:
        slide.shapes.title.text = "Dataset examples (one per class)"
    except Exception:
        pass

    # grid positions: 3 columns x 2 rows
    margin_left = Inches(0.5)
    margin_top = Inches(1.0)
    col_spacing = Inches(3.0)
    row_spacing = Inches(3.0)
    img_w = Inches(2.6)
    img_h = Inches(2.2)

    classes = list(images_by_class.keys())
    for idx, cls in enumerate(classes):
        img_path = images_by_class[cls]
        col = idx % 3
        row = idx // 3
        left = margin_left + col * col_spacing
        top = margin_top + row * row_spacing
        if img_path and os.path.exists(img_path):
            pic = slide.shapes.add_picture(img_path, left, top, width=img_w)
        else:
            # add a placeholder textbox
            tx = slide.shapes.add_textbox(left, top, img_w, img_h)
            tf = tx.text_frame
            tf.text = f"(no image found)\n{cls}"
        # caption
        cap_left = left
        cap_top = top + img_h + Inches(0.05)
        cap = slide.shapes.add_textbox(cap_left, cap_top, img_w, Inches(0.4))
        p = cap.text_frame.paragraphs[0]
        p.text = cls
        p.font.size = Pt(12)

def main():
    # script assumes it's run from backend/ folder
    base_dataset = os.path.join('..', 'dataset')
    classes = [
        'freshapples', 'freshbanana', 'freshoranges',
        'rottenapples', 'rottenbanana', 'rottenoranges'
    ]
    images = find_example_images(base_dataset, classes)

    if not os.path.exists(PRESENTATION):
        print(f"Presentation {PRESENTATION} not found in current directory.")
        return

    prs = Presentation(PRESENTATION)
    add_images_slide(prs, images)
    prs.save(OUT)
    print(f"Saved {OUT}")

if __name__ == '__main__':
    main()
