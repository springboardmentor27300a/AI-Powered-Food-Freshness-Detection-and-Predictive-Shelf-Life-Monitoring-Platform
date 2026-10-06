import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listBatches } from "../api/batches";
import { listFoodItems } from "../api/food";
import { analyzeImage, getModelStatus, uploadImage } from "../api/images";
import { generateReport } from "../api/reports";
import FreshnessBadge from "../components/FreshnessBadge";
import {
  friendlyError,
  friendlyModelStatus,
  friendlyPredictionMessage,
} from "../utils/errors";

export default function ImageUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBatch = searchParams.get("batch_id") || "";

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [foodItems, setFoodItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(preselectedBatch);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedFromCamera, setCapturedFromCamera] = useState(false);

  const [modelStatus, setModelStatus] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [report, setReport] = useState(null);

  const [stage, setStage] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    getModelStatus()
      .then(setModelStatus)
      .catch(() => setModelStatus({ status: "unavailable" }));

    listFoodItems({ page_size: 100 })
      .then((res) => setFoodItems(res.items || res || []))
      .catch(() => setFoodItems([]));

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!selectedFoodItem) {
      setBatches([]);
      return;
    }

    listBatches({
      food_item_id: selectedFoodItem,
      page_size: 100,
    })
      .then((res) => setBatches(res.items || res || []))
      .catch(() => setBatches([]));
  }, [selectedFoodItem]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function openCamera() {
    setCameraError("");
    setError("");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraOpen(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      setCameraError(
        "Camera permission was denied or the camera is not available."
      );
    }
  }

  function closeCamera() {
    stopCamera();
    setCameraOpen(false);
    setCameraError("");
  }

  function captureImage() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Please try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture the image. Please try again.");
          return;
        }

        const capturedFile = new File(
          [blob],
          `foodcare-camera-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
          }
        );

        setFile(capturedFile);
        setPreview(URL.createObjectURL(capturedFile));
        setCapturedFromCamera(true);
        setUploadedImage(null);
        setAnalysis(null);
        setReport(null);
        setError("");

        closeCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  function handleFileChange(f) {
    if (!f) return;

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCapturedFromCamera(false);
    setUploadedImage(null);
    setAnalysis(null);
    setReport(null);
    setError("");
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }

  async function handleAnalyze() {
    if (!selectedBatch || !file) {
      setError("Select a batch and an image first.");
      return;
    }

    setError("");

    try {
      setStage("uploading");

      const img = await uploadImage(selectedBatch, file);
      setUploadedImage(img);

      setStage("analyzing");

      const result = await analyzeImage(img.id);
      setAnalysis(result);

      setStage("idle");
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Upload or analysis failed. Please try again."
        )
      );
      setStage("idle");
    }
  }

  async function handleGenerateReport() {
    setError("");

    try {
      setStage("generating");

      const rpt = await generateReport({
        batch_id: selectedBatch,
        image_id: uploadedImage.id,
      });

      setReport(rpt);
      setStage("done");
    } catch (err) {
      setError(
        friendlyError(
          err,
          "Report generation failed. Please try again."
        )
      );
      setStage("idle");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Food Image Analysis
      </h1>

      <p className="mt-1 text-sm text-slate-500">
        Analyze a food image using FoodCare's freshness analysis workflow.
      </p>

      {modelStatus?.status === "available" && (
        <p className="mt-2 text-sm font-medium text-brand-700">
          AI freshness prediction is active.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        {/* Food item and batch */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">
              Food item
            </label>

            <select
              value={selectedFoodItem}
              onChange={(e) => {
                setSelectedFoodItem(e.target.value);
                setSelectedBatch("");
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select food item...</option>

              {foodItems.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500">
              Batch
            </label>

            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={!selectedFoodItem}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Select batch...</option>

              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Camera */}
        {cameraOpen ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-brand-200 bg-slate-900">
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />

              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-12">
                <button
                  type="button"
                  onClick={captureImage}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100"
                >
                  📸 Capture Image
                </button>

                <button
                  type="button"
                  onClick={closeCamera}
                  className="rounded-full bg-slate-800 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>

            {cameraError && (
              <div className="bg-red-50 px-4 py-3 text-sm text-red-700">
                {cameraError}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Image preview / upload area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition
                ${
                  dragActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-300 bg-slate-50"
                }`}
            >
              {preview ? (
                <div className="w-full">
                  <img
                    src={preview}
                    alt="Food preview"
                    className="mx-auto mb-4 h-52 w-52 rounded-xl object-cover shadow-sm"
                  />

                  {capturedFromCamera && (
                    <p className="mb-3 text-xs font-medium text-brand-700">
                      📷 Image captured from camera
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">
                    📷
                  </div>

                  <p className="text-sm font-medium text-slate-700">
                    Add a food image
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Upload an image or capture one using your camera
                  </p>
                </>
              )}

              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <label className="cursor-pointer rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  Browse File

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      handleFileChange(e.target.files?.[0])
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={openCamera}
                  className="rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  📷 Use Camera
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                JPEG, PNG or WEBP, up to 8MB
              </p>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Retake / change image */}
        {preview && !cameraOpen && !analysis && (
          <div className="mt-3 flex justify-center gap-3">
            <button
              type="button"
              onClick={openCamera}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              📷 Retake Photo
            </button>

            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setCapturedFromCamera(false);
                setError("");
              }}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Remove Image
            </button>
          </div>
        )}

        {/* Analyze */}
        <button
          onClick={handleAnalyze}
          disabled={
            !file ||
            !selectedBatch ||
            stage === "uploading" ||
            stage === "analyzing"
          }
          className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {stage === "uploading"
            ? "Uploading..."
            : stage === "analyzing"
            ? "Analyzing image..."
            : "Analyze Food Image"}
        </button>
      </div>

      {/* Analysis result */}
      {analysis && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-medium text-slate-900">
            Analysis Result
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                AI Freshness Prediction
              </h3>

              {analysis.cnn_prediction.status === "success" ? (
                <>
                  <p className="mt-1 text-2xl font-semibold capitalize text-slate-900">
                    {analysis.cnn_prediction.predicted_class}
                  </p>

                  <p className="text-sm text-slate-500">
                    Confidence:{" "}
                    {(
                      analysis.cnn_prediction.confidence * 100
                    ).toFixed(1)}
                    %
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  {friendlyPredictionMessage(
                    analysis.cnn_prediction
                  )}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                OpenCV Visual Analysis
              </h3>

              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {analysis.visual_analysis.overall_visual_score}
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / 100
                </span>
              </p>

              <p className="text-sm text-slate-500">
                {analysis.visual_analysis.summary}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {[
              "color_score",
              "texture_score",
              "dark_spot_score",
              "bruising_score",
              "damage_score",
            ].map((k) => (
              <div
                key={k}
                className="rounded-lg bg-slate-50 px-2 py-2"
              >
                <p className="text-slate-400">
                  {k
                    .replace("_score", "")
                    .replace("_", " ")}
                </p>

                <p className="font-semibold text-slate-800">
                  {analysis.visual_analysis[k]}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs italic text-slate-400">
            {analysis.visual_analysis.explanation}
          </p>

          <button
            onClick={handleGenerateReport}
            disabled={
              stage === "generating" || stage === "done"
            }
            className="mt-5 w-full rounded-md bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:bg-slate-300"
          >
            {stage === "generating"
              ? "Generating report..."
              : stage === "done"
              ? "Report generated"
              : "Generate Freshness Report"}
          </button>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/40 p-6 text-center">
          <p className="text-sm text-slate-500">
            Report {report.report_number}
          </p>

          <p className="mt-1 text-3xl font-bold text-slate-900">
            {report.freshness_score}
          </p>

          <div className="mt-1">
            <FreshnessBadge
              category={report.freshness_category}
            />
          </div>

          <button
            onClick={() =>
              navigate(`/reports/${report.id}`)
            }
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            View Full Report
          </button>
        </div>
      )}
    </div>
  );
}