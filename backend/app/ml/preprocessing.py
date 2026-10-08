"""
Image preprocessing pipeline for CNN model input.

Handles:
- Decoding uploaded image bytes
- Resizing to model input dimensions
- Normalization to [0, 1] or ImageNet statistics
- Augmentation for training
"""
import io
from typing import Optional

import cv2
import numpy as np

# ImageNet normalization stats (used for transfer-learning models)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406])
IMAGENET_STD = np.array([0.229, 0.224, 0.225])

TARGET_SIZE = (224, 224)


def decode_and_resize(image_bytes: bytes, size: tuple = TARGET_SIZE) -> np.ndarray:
    """Decode image bytes and resize to target size. Returns BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image. Ensure it is a valid JPEG/PNG file.")
    img = cv2.resize(img, size)
    return img


def preprocess_for_pytorch(
    image_bytes: bytes,
    normalize_imagenet: bool = True,
) -> np.ndarray:
    """
    Preprocess image for PyTorch model inference.
    Returns array of shape (1, 3, 224, 224) with float32 values.
    """
    img = decode_and_resize(image_bytes)
    # BGR -> RGB
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # HWC -> CHW
    img = img.transpose(2, 0, 1).astype(np.float32) / 255.0

    if normalize_imagenet:
        img = (img - IMAGENET_MEAN[:, None, None]) / IMAGENET_STD[:, None, None]

    return img[np.newaxis, ...]


def preprocess_for_tensorflow(
    image_bytes: bytes,
    normalize_imagenet: bool = True,
) -> np.ndarray:
    """
    Preprocess image for TensorFlow model inference.
    Returns array of shape (1, 224, 224, 3) with float32 values.
    """
    img = decode_and_resize(image_bytes)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0

    if normalize_imagenet:
        img = (img - IMAGENET_MEAN) / IMAGENET_STD

    return img[np.newaxis, ...]


def augment_training_image(img: np.ndarray) -> list[np.ndarray]:
    """Generate augmented versions of a training image."""
    augmented = [img]

    # Horizontal flip
    augmented.append(cv2.flip(img, 1))

    # Slight rotation
    h, w = img.shape[:2]
    for angle in [-15, 15]:
        matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        rotated = cv2.warpAffine(img, matrix, (w, h), borderMode=cv2.BORDER_REFLECT)
        augmented.append(rotated)

    # Brightness variation
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    for factor in [0.8, 1.2]:
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * factor, 0, 255)
        bright = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        augmented.append(bright)

    return augmented
