# ============================================================
# FOOD FRESHNESS MONITORING PLATFORM
# MODEL PREDICTION TEST
# ============================================================

from pathlib import Path

from app.services.prediction import predict_freshness


# ============================================================
# PROJECT PATH
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parent


# ============================================================
# TEST IMAGE
# ============================================================

# IMPORTANT:
# Yahan kisi ek image ka actual path dena hai.
#
# Example:
#
# TEST_IMAGE = (
#     BACKEND_DIR.parent
#     / "dataset"
#     / "test"
#     / "fresh"
#     / "some_image.jpg"
# )


TEST_IMAGE = (
    BACKEND_DIR.parent
    / "dataset"
    / "test"
    / "fresh"
)


# ============================================================
# FIND FIRST IMAGE
# ============================================================

def find_first_image(folder):

    supported_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    for file in folder.iterdir():

        if (
            file.is_file()
            and file.suffix.lower()
            in supported_extensions
        ):
            return file

    return None


# ============================================================
# MAIN TEST
# ============================================================

def main():

    print("=" * 60)
    print("FOOD FRESHNESS MODEL TEST")
    print("=" * 60)


    # --------------------------------------------------------
    # Check test folder
    # --------------------------------------------------------

    if not TEST_IMAGE.exists():

        print()
        print("❌ Test image/folder not found:")
        print(TEST_IMAGE)

        return


    # --------------------------------------------------------
    # If TEST_IMAGE is a folder,
    # automatically select first image.
    # --------------------------------------------------------

    image_path = TEST_IMAGE


    if TEST_IMAGE.is_dir():

        image_path = find_first_image(
            TEST_IMAGE
        )


    if image_path is None:

        print()
        print("❌ No image found in:")
        print(TEST_IMAGE)

        return


    # --------------------------------------------------------
    # Show selected image
    # --------------------------------------------------------

    print()
    print("Test image:")
    print(image_path)


    # --------------------------------------------------------
    # Run prediction
    # --------------------------------------------------------

    try:

        result = predict_freshness(
            food_name="Test Food",
            image_path=image_path,
        )


    except Exception as error:

        print()
        print("=" * 60)
        print("❌ PREDICTION FAILED")
        print("=" * 60)

        print()
        print(
            f"Error: {error}"
        )

        raise


    # --------------------------------------------------------
    # Display result
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("PREDICTION RESULT")
    print("=" * 60)

    print()
    print(
        f"Food Name       : "
        f"{result.get('food_name')}"
    )

    print(
        f"Freshness       : "
        f"{result.get('freshness_status')}"
    )

    print(
        f"Freshness Score : "
        f"{result.get('freshness_score')}/100"
    )

    print(
        f"Confidence      : "
        f"{result.get('confidence')}%"
    )

    print(
        f"Predicted Class : "
        f"{result.get('predicted_class')}"
    )

    print()
    print("=" * 60)
    print("✅ MODEL PREDICTION TEST COMPLETE")
    print("=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()