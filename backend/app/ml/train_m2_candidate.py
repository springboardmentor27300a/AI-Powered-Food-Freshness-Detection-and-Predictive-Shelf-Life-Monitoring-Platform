"""Train an isolated M2 freshness candidate from a rights-verified manifest.

This command never modifies the production registry or the legacy M1/M2/M3
models. It refuses to train unless source-rights evidence, five-class labels,
per-image hashes, and group IDs are supplied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from collections.abc import Mapping
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset

from .m2_evaluation import EvaluationExample, evaluate_classification, select_confidence_threshold
from .m2_scoring import FRESHNESS_CLASSES
from .m2_training import M2ImageRecord, grouped_split, split_manifest_sha256, validate_training_records


class M2CandidateNetwork(nn.Module):
    def __init__(self, class_count: int = 5):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 24, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(24, 48, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True),
            nn.Conv2d(48, 96, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(96),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Linear(96, class_count)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        features = self.features(images).flatten(1)
        return self.classifier(features)


class ManifestImageDataset(Dataset):
    def __init__(self, records: list[dict[str, Any]], label_indices: Mapping[str, int]):
        self.records = records
        self.label_indices = label_indices

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        record = self.records[index]
        with Image.open(record["absolute_path"]) as source:
            image = source.convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
            values = np.asarray(image, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(values.transpose(2, 0, 1).copy())
        return tensor, self.label_indices[record["label"]]


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_manifest(path: Path, category: str, subtype: str) -> tuple[dict, list[dict], str]:
    raw = path.read_bytes()
    manifest_hash = _sha256(raw)
    manifest = json.loads(raw)
    if not isinstance(manifest, dict) or not isinstance(manifest.get("records"), list):
        raise ValueError("The training manifest must contain a records array.")
    if not all(
        isinstance(manifest.get(field), str) and manifest[field].strip()
        for field in ("dataset_id", "dataset_version")
    ):
        raise ValueError("The training manifest must include dataset_id and dataset_version.")
    source = manifest.get("source")
    required_source_fields = (
        "source_url",
        "license",
        "attribution",
        "allowed_use",
        "authoritative_license_url",
        "license_evidence_path",
        "license_evidence_sha256",
    )
    if not isinstance(source, dict) or any(
        not isinstance(source.get(field), str) or not source[field].strip()
        for field in required_source_fields
    ):
        raise ValueError("Manifest source must include URL, license, attribution, allowed use, and license evidence.")
    evidence_hash = source["license_evidence_sha256"].lower()
    if len(evidence_hash) != 64 or any(character not in "0123456789abcdef" for character in evidence_hash):
        raise ValueError("Manifest license_evidence_sha256 must be a SHA-256 digest.")

    root = path.resolve().parent
    evidence_path = (root / source["license_evidence_path"]).resolve()
    if root != evidence_path and root not in evidence_path.parents:
        raise ValueError("License evidence path must remain within the training manifest directory.")
    if not evidence_path.is_file() or _sha256(evidence_path.read_bytes()) != evidence_hash:
        raise ValueError("Archived authoritative license evidence is missing or its SHA-256 does not match.")
    records = []
    for record in manifest["records"]:
        if not isinstance(record, dict):
            raise ValueError("Every manifest record must be an object.")
        if record.get("category") != category or record.get("subtype", "").strip().lower() != subtype.strip().lower():
            continue
        relative_path = record.get("path")
        if not isinstance(relative_path, str) or not relative_path:
            raise ValueError("Every selected image record must have a relative path.")
        image_path = (root / relative_path).resolve()
        if root != image_path and root not in image_path.parents:
            raise ValueError("Image paths must remain within the training manifest directory.")
        if not image_path.is_file():
            raise ValueError(f"Manifest image is missing: {relative_path}")
        image_bytes = image_path.read_bytes()
        expected_hash = str(record.get("sha256", "")).lower()
        if _sha256(image_bytes) != expected_hash:
            raise ValueError(f"Image SHA-256 does not match manifest: {relative_path}")
        with Image.open(image_path) as image:
            image.verify()
        copied = dict(record)
        copied["absolute_path"] = str(image_path)
        records.append(copied)

    labels = {record.get("label") for record in records}
    if labels != set(FRESHNESS_CLASSES):
        raise ValueError("The selected category/subtype must contain all five official freshness labels.")
    return manifest, records, manifest_hash


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> tuple[list[EvaluationExample], list[dict[str, Any]]]:
    model.eval()
    examples = []
    outputs = []
    with torch.no_grad():
        for images, targets in loader:
            probabilities = torch.softmax(model(images.to(device)), dim=1).cpu()
            for target, row in zip(targets.tolist(), probabilities.tolist()):
                predicted = int(np.argmax(row))
                examples.append(EvaluationExample(
                    true_label=FRESHNESS_CLASSES[target],
                    predicted_label=FRESHNESS_CLASSES[predicted],
                    confidence=float(row[predicted]),
                ))
                outputs.append({
                    "true_label": FRESHNESS_CLASSES[target],
                    "probabilities": dict(zip(FRESHNESS_CLASSES, map(float, row))),
                })
    return examples, outputs


def train_candidate(args: argparse.Namespace) -> dict[str, Any]:
    manifest_path = Path(args.manifest).resolve()
    output_dir = Path(args.output_dir).resolve()
    manifest, selected, manifest_hash = _load_manifest(manifest_path, args.category, args.subtype)

    source = manifest["source"]
    for record in selected:
        if record.get("rights_status") != "verified_commercial_training":
            raise ValueError(f"Image {record.get('image_id', '<unknown>')} lacks verified commercial training rights.")
        if record.get("license") != source["license"]:
            raise ValueError("Image-level license must match the manifest's documented source license.")
        if record.get("group_id") is None or record.get("image_id") is None:
            raise ValueError("Every selected image requires image_id and group_id.")
    if len({record["sha256"].lower() for record in selected}) != len(selected):
        raise ValueError("Duplicate image hashes are not accepted as independent examples.")

    training_records = [
        M2ImageRecord(
            image_id=record["image_id"],
            sha256=record["sha256"].lower(),
            group_id=str(record["group_id"]),
            label=record["label"],
            category=record["category"],
            subtype=record["subtype"],
            rights_status=record["rights_status"],
            license=record["license"],
        )
        for record in selected
    ]
    validated = validate_training_records(training_records)
    record_by_id = {record["image_id"]: record for record in selected}
    split_records = grouped_split(validated, seed=args.seed)
    if any(not split for split in split_records.values()):
        raise ValueError("Group-aware split produced an empty partition; add more independent capture groups.")
    split_ids = {
        name: {record.image_id for record in records}
        for name, records in split_records.items()
    }
    for name, records in split_records.items():
        present = {record.label for record in records}
        if present != set(FRESHNESS_CLASSES):
            raise ValueError(f"The {name} split must contain all five classes; observed {sorted(present)}.")
    if split_ids["train"] & split_ids["validation"] or split_ids["train"] & split_ids["test"] or split_ids["validation"] & split_ids["test"]:
        raise ValueError("Image leakage detected across group-aware partitions.")
    split_groups = {
        name: {record.group_id for record in records}
        for name, records in split_records.items()
    }
    if any(
        split_groups[left] & split_groups[right]
        for left, right in (("train", "validation"), ("train", "test"), ("validation", "test"))
    ):
        raise ValueError("Capture-group leakage detected across partitions.")
    if output_dir.exists():
        raise FileExistsError(f"Refusing to overwrite existing candidate output: {output_dir}")

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    random.seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    torch.use_deterministic_algorithms(True, warn_only=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    label_indices = {label: index for index, label in enumerate(FRESHNESS_CLASSES)}
    datasets = {
        name: ManifestImageDataset(
            [record_by_id[record.image_id] for record in rows],
            label_indices,
        )
        for name, rows in split_records.items()
    }
    generator = torch.Generator().manual_seed(args.seed)
    loaders = {
        name: DataLoader(
            dataset,
            batch_size=args.batch_size,
            shuffle=name == "train",
            num_workers=0,
            generator=generator if name == "train" else None,
        )
        for name, dataset in datasets.items()
    }
    model = M2CandidateNetwork().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    loss_function = nn.CrossEntropyLoss()
    epoch_losses = []
    for _ in range(args.epochs):
        model.train()
        loss_total = 0.0
        sample_total = 0
        for images, targets in loaders["train"]:
            images, targets = images.to(device), targets.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(images), targets)
            loss.backward()
            optimizer.step()
            loss_total += float(loss.item()) * len(targets)
            sample_total += len(targets)
        epoch_losses.append(loss_total / sample_total)

    validation_examples, validation_outputs = _evaluate(model, loaders["validation"], device)
    validation_threshold = select_confidence_threshold(validation_examples, args.minimum_validation_precision)
    test_examples, test_outputs = _evaluate(model, loaders["test"], device)
    evaluation = evaluate_classification(test_examples)
    observed_labels = evaluation["confusion_matrix_labels"]
    confusion_matrix = [
        [
            evaluation["confusion_matrix"][observed_labels.index(actual)][observed_labels.index(predicted)]
            for predicted in FRESHNESS_CLASSES
        ]
        for actual in FRESHNESS_CLASSES
    ]
    model = model.cpu().eval()
    output_dir.mkdir(parents=True, exist_ok=False)
    model_path = output_dir / "candidate.pt"
    torch.jit.script(model).save(str(model_path))

    split_payload = {
        name: [
            {"image_id": record.image_id, "group_id": record.group_id, "sha256": record.sha256}
            for record in sorted(rows, key=lambda row: row.image_id)
        ]
        for name, rows in split_records.items()
    }
    split_hash = split_manifest_sha256(split_records)
    evaluation_payload = {
        "status": "candidate_only",
        "evaluation_date": date.today().isoformat(),
        "validation": {
            "sample_count": len(validation_examples),
            "minimum_precision_target": args.minimum_validation_precision,
            "confidence_threshold": validation_threshold,
            "calibration": evaluate_classification(validation_examples),
            "predictions": validation_outputs,
        },
        "independent_test": {
            "status": "measured_not_approved",
            **evaluation,
            "class_metrics": evaluation["labels"],
            "confusion_matrix": confusion_matrix,
            "confusion_matrix_labels": list(FRESHNESS_CLASSES),
            "predictions": test_outputs,
        },
        "calibration": {
            "status": "pending_independent_review",
            "method": "confidence threshold selected on validation set; ECE measured on independent test set",
            "confidence_threshold": validation_threshold,
            "expected_calibration_error": evaluation["expected_calibration_error"],
        },
    }
    model_hash = _sha256(model_path.read_bytes())
    _write_json(output_dir / "split_manifest.json", split_payload)
    _write_json(output_dir / "evaluation_report.json", evaluation_payload)
    metadata = {
        "candidate_status": "draft_not_approved",
        "category": args.category,
        "subtype": args.subtype,
        "labels": list(FRESHNESS_CLASSES),
        "label_semantics": {label: label for label in FRESHNESS_CLASSES},
        "architecture": "FreshGuardM2CandidateCNN-v1",
        "input": {"size": [224, 224], "color_mode": "RGB", "normalization": "divide_by_255"},
        "random_seed": args.seed,
        "training": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.learning_rate,
            "device": str(device),
            "epoch_mean_losses": epoch_losses,
        },
        "dependencies": {
            "python": __import__("platform").python_version(),
            "torch": torch.__version__,
            "numpy": np.__version__,
            "pillow": Image.__version__,
        },
        "data_provenance": {
            "dataset_id": manifest["dataset_id"],
            "dataset_version": manifest["dataset_version"],
            "source_url": source["source_url"],
            "license": source["license"],
            "attribution": source["attribution"],
            "allowed_use": source["allowed_use"],
            "authoritative_license_url": source["authoritative_license_url"],
            "license_evidence_sha256": source["license_evidence_sha256"],
            "manifest_sha256": manifest_hash,
        },
        "split_manifest_sha256": split_hash,
        "model_sha256": model_hash,
        "evaluation_report_sha256": _sha256((output_dir / "evaluation_report.json").read_bytes()),
        "approval_status": "draft",
    }
    _write_json(output_dir / "metadata.json", metadata)
    model_card = (
        f"# FreshGuard M2 Candidate Model Card\n\n"
        f"- Status: draft; not production-approved\n"
        f"- Scope: {args.category} / {args.subtype}\n"
        f"- Dataset: {manifest['dataset_id']} ({manifest['dataset_version']})\n"
        f"- Source: {source['source_url']}\n"
        f"- License: {source['license']}; attribution: {source['attribution']}\n"
        f"- Allowed use: {source['allowed_use']}\n"
        f"- Samples: {len(selected)}; grouped split SHA-256: {split_hash}\n"
        f"- Independent test: {evaluation['sample_count']} images; measured accuracy: {evaluation['accuracy']:.6f}\n"
        f"- Model SHA-256: {model_hash}\n"
        f"- Limits: image-based appearance only; not microbiological safety evidence.\n"
    )
    (output_dir / "MODEL_CARD.md").write_text(model_card, encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, help="JSON manifest with image paths, groups, labels, and rights evidence")
    parser.add_argument("--output-dir", required=True, help="New output directory for an isolated candidate model")
    parser.add_argument("--category", required=True, choices=(
        "Fruits", "Vegetables", "Dairy Products", "Meat & Poultry",
        "Seafood", "Bakery Products", "Packaged Foods", "Beverages",
    ))
    parser.add_argument("--subtype", required=True)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--minimum-validation-precision", type=float, default=0.95)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.learning_rate <= 0:
        parser.error("epochs and batch-size must be positive, and learning-rate must be greater than zero.")
    if not 0.0 <= args.minimum_validation_precision <= 1.0:
        parser.error("minimum-validation-precision must be within [0, 1].")
    metadata = train_candidate(args)
    print(json.dumps({
        "candidate_status": metadata["candidate_status"],
        "model_sha256": metadata["model_sha256"],
        "evaluation_report_sha256": metadata["evaluation_report_sha256"],
        "output_dir": str(Path(args.output_dir).resolve()),
    }, indent=2))


if __name__ == "__main__":
    main()
